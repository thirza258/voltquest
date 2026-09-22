"""Community discussion operations; independent of HTTP transport.

Deletion is soft and has one meaning: ``is_deleted`` marks a post as *withdrawn by its author*.
A withdrawn opening post whose thread has no replies disappears completely; one that already has
replies keeps the thread readable with an empty body, because the replies are other people's work.
"""

from __future__ import annotations

from collections import deque
from datetime import timedelta
from threading import Lock
from time import monotonic

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.models import DiscussionPost, DiscussionThread, Player, Project, utcnow
from app.domain import community as rules
from app.domain import xp
from app.domain.errors import Conflict, InvalidInput, NotFound, PermissionDenied, TooManyRequests
from app.schemas.community import (
    AnswerIn,
    CategoryOut,
    PostOut,
    ReplyIn,
    ThreadIn,
    ThreadListOut,
    ThreadOut,
    ThreadPatch,
    ThreadSummaryOut,
)

EXCERPT_CHARS = 180
#: A resubmitted identical post within this window is treated as a double submit, not a new one.
DUPLICATE_WINDOW = timedelta(minutes=10)


class WriteBudget:
    """Bounded per-process write budget, mirroring ``services/assistant.py``.

    Per process, like the assistant's: it blunts accidental loops and casual flooding from one
    browser. It is not a substitute for moderation, and several workers each get their own budget.
    """

    def __init__(self, *, per_player: int, overall: int, window_seconds: int) -> None:
        self.lock = Lock()
        self.per_player = per_player
        self.overall = overall
        self.window_seconds = window_seconds
        self.recent: deque[tuple[float, str]] = deque()

    def spend(self, player_id: str) -> None:
        with self.lock:
            now = monotonic()
            while self.recent and self.recent[0][0] <= now - self.window_seconds:
                self.recent.popleft()
            if len(self.recent) >= self.overall or sum(
                player == player_id for _, player in self.recent
            ) >= self.per_player:
                raise TooManyRequests("community_rate_limited")
            self.recent.append((now, player_id))


thread_budget = WriteBudget(per_player=5, overall=120, window_seconds=600)
reply_budget = WriteBudget(per_player=30, overall=600, window_seconds=600)


# --------------------------------------------------------------------------- payloads


def author_payload(player: Player | None) -> dict:
    """The public identity beside a post. Never the username or credentials."""
    if player is None:
        return {"id": "", "display_name": "Former cadet", "level": 1}
    return {
        "id": player.id,
        "display_name": player.display_name,
        "level": xp.level_for_xp(player.xp)["level"],
    }


def excerpt_for(body: str) -> str:
    """A one-line preview of an opening post for the index."""
    flat = " ".join(body.split())
    return flat if len(flat) <= EXCERPT_CHARS else flat[: EXCERPT_CHARS - 1].rstrip() + "…"


def thread_summary(thread: DiscussionThread) -> dict:
    """``ThreadSummary`` — the list row, with the opening post reduced to an excerpt."""
    return {
        "id": thread.id,
        "author": author_payload(thread.author),
        "category": thread.category,
        "title": thread.title,
        "excerpt": "" if thread.is_deleted else excerpt_for(thread.body),
        "board": thread.board,
        "project_slug": thread.project_slug,
        "views": thread.views,
        "reply_count": thread.reply_count,
        "is_solved": thread.is_solved,
        "last_activity_at": thread.last_activity_at,
        "created_at": thread.created_at,
    }


def post_payload(post: DiscussionPost) -> dict:
    """One reply. A withdrawn reply keeps its place in the conversation with no text."""
    return {
        "id": post.id,
        "thread_id": post.thread_id,
        "author": author_payload(post.author),
        "body": "" if post.is_deleted else post.body,
        "is_answer": post.is_answer,
        "is_deleted": post.is_deleted,
        "edited_at": post.edited_at,
        "created_at": post.created_at,
    }


def thread_payload(thread: DiscussionThread) -> dict:
    """Full ``Thread`` response object with every reply in posting order."""
    return {
        **thread_summary(thread),
        "body": "" if thread.is_deleted else thread.body,
        "is_deleted": thread.is_deleted,
        "edited_at": thread.edited_at,
        "posts": [post_payload(post) for post in thread.posts],
    }


# --------------------------------------------------------------------------- loading


def _visible(thread_id: str, db: Session) -> DiscussionThread:
    """Load a thread anyone may read; a withdrawn opening post with no replies is gone."""
    thread = db.get(DiscussionThread, thread_id)
    if thread is None or (thread.is_deleted and thread.reply_count == 0):
        raise NotFound("Discussion not found")
    return thread


def _authored(thread_id: str, player: Player, db: Session) -> DiscussionThread:
    """The caller's own thread. Readable by everyone, writable only by its author."""
    thread = _visible(thread_id, db)
    if thread.author_id != player.id:
        raise PermissionDenied("Only the author can change this discussion")
    return thread


def _open_thread(thread_id: str, db: Session) -> DiscussionThread:
    """A thread that still accepts replies."""
    thread = _visible(thread_id, db)
    if thread.is_deleted:
        raise InvalidInput("This discussion was withdrawn by its author")
    return thread


# --------------------------------------------------------------------------- reads


def _filters(category: str, board: str, project: str, q: str) -> list:
    where = []
    if category.strip():
        where.append(DiscussionThread.category == rules.normalize_category(category))
    if board.strip():
        where.append(DiscussionThread.board == board.strip())
    if project.strip():
        where.append(DiscussionThread.project_slug == project.strip().lower())
    if q.strip():
        pattern = f"%{q.strip().lower()[: rules.MAX_SEARCH_CHARS]}%"
        where.append(
            or_(
                func.lower(DiscussionThread.title).like(pattern),
                func.lower(DiscussionThread.body).like(pattern),
            )
        )
    return where


#: A withdrawn opening post is only hidden once nobody has replied to it.
_LIVE = or_(DiscussionThread.is_deleted.is_(False), DiscussionThread.reply_count > 0)

_ORDERS = {
    "active": (DiscussionThread.last_activity_at.desc(), DiscussionThread.id.desc()),
    "recent": (DiscussionThread.created_at.desc(), DiscussionThread.id.desc()),
    "popular": (
        DiscussionThread.reply_count.desc(),
        DiscussionThread.views.desc(),
        DiscussionThread.last_activity_at.desc(),
        DiscussionThread.id.desc(),
    ),
}


def list_threads(
    *,
    category: str,
    board: str,
    project: str,
    q: str,
    sort: str,
    limit: int,
    offset: int,
    db: Session,
) -> ThreadListOut:
    """Discussions with search, category/board/project filters, sorting and pagination.

    The category counts are a facet: they honour every filter *except* the selected category,
    so switching sections shows how many discussions each one actually holds for this search.
    """
    facet_where = [_LIVE, *_filters("", board, project, q)]
    where = [_LIVE, *_filters(category, board, project, q)]
    total = db.scalar(select(func.count(DiscussionThread.id)).where(*where)) or 0
    rows = db.scalars(
        select(DiscussionThread)
        .where(*where)
        .options(selectinload(DiscussionThread.author))
        .order_by(*_ORDERS.get(sort, _ORDERS["active"]))
        .limit(limit)
        .offset(offset)
    ).all()
    counts = dict(
        db.execute(
            select(DiscussionThread.category, func.count(DiscussionThread.id))
            .where(*facet_where)
            .group_by(DiscussionThread.category)
        ).all()
    )
    return ThreadListOut(
        items=[ThreadSummaryOut(**thread_summary(row)) for row in rows],
        total=int(total),
        categories=[
            CategoryOut(id=key, label=rules.CATEGORY_LABELS[key], threads=int(counts.get(key, 0)))
            for key in rules.CATEGORIES
        ],
    )


def get_thread(*, thread_id: str, db: Session) -> ThreadOut:
    """Read one discussion with its replies and count the view."""
    thread = _visible(thread_id, db)
    thread.views += 1
    db.add(thread)
    db.commit()
    # Reload eagerly after the commit, not with db.refresh(): refreshing the row alone leaves the
    # collections unloaded, so building the payload would fetch every reply author one at a time.
    # A discussion returns all of its replies, so that cost grows with the conversation.
    thread = db.scalars(
        select(DiscussionThread)
        .where(DiscussionThread.id == thread.id)
        .options(
            selectinload(DiscussionThread.author),
            selectinload(DiscussionThread.posts).selectinload(DiscussionPost.author),
        )
        .execution_options(populate_existing=True)
    ).one()
    return ThreadOut(**thread_payload(thread))


# --------------------------------------------------------------------------- writes


def _published_project(slug: str, db: Session) -> None:
    """A thread may only point at a project that is actually on the public showcase."""
    if db.scalar(select(Project.id).where(Project.share_slug == slug, Project.is_public.is_(True))) is None:
        raise InvalidInput("project_slug does not match a published showcase project")


def create_thread(*, body: ThreadIn, player: Player, db: Session) -> ThreadOut:
    """Start a discussion."""
    if body.project_slug:
        _published_project(body.project_slug, db)
    duplicate = db.scalar(
        select(DiscussionThread.id).where(
            DiscussionThread.author_id == player.id,
            DiscussionThread.title == body.title,
            DiscussionThread.body == body.body,
            DiscussionThread.created_at >= utcnow() - DUPLICATE_WINDOW,
        )
    )
    if duplicate is not None:
        raise Conflict("You already posted this discussion")
    thread_budget.spend(player.id)
    now = utcnow()
    thread = DiscussionThread(
        author_id=player.id,
        category=body.category,
        title=body.title,
        body=body.body,
        board=body.board,
        project_slug=body.project_slug,
        last_activity_at=now,
    )
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return ThreadOut(**thread_payload(thread))


def update_thread(*, thread_id: str, body: ThreadPatch, player: Player, db: Session) -> ThreadOut:
    """Edit your own discussion. The board and project link are fixed once posted."""
    thread = _authored(thread_id, player, db)
    if thread.is_deleted:
        raise InvalidInput("A withdrawn discussion cannot be edited")
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise InvalidInput("No changes were supplied")
    for field, value in changes.items():
        setattr(thread, field, value)
    thread.edited_at = utcnow()
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return ThreadOut(**thread_payload(thread))


def delete_thread(*, thread_id: str, player: Player, db: Session) -> None:
    """Withdraw your own discussion. Replies from other people survive it."""
    thread = _authored(thread_id, player, db)
    thread.is_deleted = True
    db.add(thread)
    db.commit()


def create_reply(*, thread_id: str, body: ReplyIn, player: Player, db: Session) -> PostOut:
    """Reply to a discussion and mark it active."""
    thread = _open_thread(thread_id, db)
    # Compared in SQL, not Python: SQLite reads timestamps back without their UTC offset.
    duplicate = db.scalar(
        select(DiscussionPost.id).where(
            DiscussionPost.thread_id == thread.id,
            DiscussionPost.author_id == player.id,
            DiscussionPost.is_deleted.is_(False),
            DiscussionPost.body == body.body,
            DiscussionPost.created_at >= utcnow() - DUPLICATE_WINDOW,
        )
    )
    if duplicate is not None:
        raise Conflict("You already posted this reply")
    reply_budget.spend(player.id)
    post = DiscussionPost(thread_id=thread.id, author_id=player.id, body=body.body)
    thread.reply_count += 1
    thread.last_activity_at = utcnow()
    db.add_all([post, thread])
    db.commit()
    db.refresh(post)
    return PostOut(**post_payload(post))


def _authored_post(post_id: str, player: Player, db: Session) -> DiscussionPost:
    post = db.get(DiscussionPost, post_id)
    if post is None or post.is_deleted:
        raise NotFound("Reply not found")
    if post.author_id != player.id:
        raise PermissionDenied("Only the author can change this reply")
    return post


def update_reply(*, post_id: str, body: ReplyIn, player: Player, db: Session) -> PostOut:
    """Edit your own reply."""
    post = _authored_post(post_id, player, db)
    post.body = body.body
    post.edited_at = utcnow()
    db.add(post)
    db.commit()
    db.refresh(post)
    return PostOut(**post_payload(post))


def delete_reply(*, post_id: str, player: Player, db: Session) -> None:
    """Withdraw your own reply, keeping its place in the conversation."""
    post = _authored_post(post_id, player, db)
    thread = post.thread
    post.is_deleted = True
    if post.is_answer:
        post.is_answer = False
        thread.is_solved = False
    thread.reply_count = max(0, thread.reply_count - 1)
    db.add_all([post, thread])
    db.commit()


def mark_answer(*, thread_id: str, post_id: str, body: AnswerIn, player: Player, db: Session) -> ThreadOut:
    """Accept (or un-accept) one reply as the answer. At most one per discussion."""
    thread = _authored(thread_id, player, db)
    if thread.is_deleted:
        raise InvalidInput("A withdrawn discussion cannot be edited")
    post = db.get(DiscussionPost, post_id)
    if post is None or post.thread_id != thread.id or post.is_deleted:
        raise NotFound("Reply not found")
    for other in thread.posts:
        other.is_answer = False
    post.is_answer = body.is_answer
    thread.is_solved = body.is_answer
    db.add_all([post, thread])
    db.commit()
    db.refresh(thread)
    return ThreadOut(**thread_payload(thread))
