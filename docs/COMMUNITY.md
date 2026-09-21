# Community discussions

A discussion board for the people using VoltQuest: questions about a circuit that will not behave,
builds worth showing, and notes on the courses. Reading is public; writing uses the player identity
the app already issues. Read this before changing anything under `features/community`,
`app/services/community.py` or `app/domain/community.py`.

## Routes and surfaces

| Surface | Path |
| --- | --- |
| Board index | `/community`, with `?category= &board= &project= &q= &sort= &offset=` |
| One discussion | `/community/:threadId` |
| From a published project | `/showcase/:slug` → **Discuss** → `/community?project=<slug>` |

`Community` is the fifth item in the shared header nav and appears in the landing footer. A fifth
segment does not fit beside the logo and the right-hand cluster in a 640 px header, so the header's
`SegmentedControl` now starts at `md:` (768 px) instead of `sm:`, and 640–767 px uses the native
section `<select>` that mobile already used. **This changes the header on every route**, and it was
decided by measurement on paper, not in a browser — see "Verification performed". Both pages
are `React.lazy` chunks. `/community` is in the generated sitemap; `/community/:threadId` is not, and
`public/robots.txt` disallows `/community/` — individual threads are user-generated, like
`/showcase/:slug` and `/sandbox/:projectId`.

## Model

Two additive tables, created by the existing `create_all()` at startup. There is no migration tool
in this project, which is the same route `agent_access` and `course_certificates` took.

```
discussion_threads(id, author_id fk players, category, title, body, board null, project_slug null,
                   views, reply_count, is_solved, is_deleted, edited_at null, last_activity_at,
                   created_at, updated_at)
discussion_posts(id, thread_id fk discussion_threads, author_id fk players, body,
                 is_answer, is_deleted, edited_at null, created_at, updated_at)
```

The opening post lives on the thread; `discussion_posts` holds only replies. `reply_count` and
`last_activity_at` are denormalized so the index needs one query, and every reply create and
withdrawal maintains both. Deleting a player takes their threads and replies with them.

Sections are fixed in `app/domain/community.py` and are not content-authored:
`help`, `builds`, `hardware`, `firmware`, `courses`, `ideas`.

## What "deleted" means

`is_deleted` means **withdrawn by its author**, and it is the only deletion this feature has.

* A withdrawn reply keeps its place in the conversation and loses its text.
* A withdrawn question with no replies disappears: it leaves the index and its URL returns 404.
* A withdrawn question that already has replies stays readable with an empty body, because the
  replies are other people's work. It accepts no new replies and cannot be edited back open.

Nothing is hard-deleted, and no endpoint lets one player remove another player's post.

## Writing rules

Posting requires a player token, which the app issues to a guest automatically — the same rule
`/api/certificates` and `/api/assistant/chat` already use, and the same identity that can publish a
project to the public showcase. Anonymous writes are 401.

* Titles collapse to one line of whitespace, 4–120 characters.
* Bodies keep their line breaks and indentation, lose control characters and runs of blank lines,
  and are 2–8,000 characters.
* `board` must be one of the six supported ids. `project_slug` must match a project that is
  *currently published* to the showcase.
* Only the author may edit or withdraw a post; anyone else gets **403**, not 404 — the discussion is
  public and pretending otherwise would be a lie.
* Only the person who asked may accept an answer, at most one per discussion. Accepting a second
  reply moves the mark. Withdrawing the accepted reply clears it.
* Reposting the identical title and body, or the identical reply in the same discussion, within ten
  minutes is treated as a double submit and returns **409**.

## Rendering: text, never markup

`features/community/PostBody.jsx` rebuilds a post as React elements and never uses
`dangerouslySetInnerHTML` or a Markdown engine. It recognises exactly three things — triple-backtick
code fences, inline backticks, and bare `http(s)` URLs — and prints everything else verbatim with its
line breaks. Links are validated with `URL` for an http/https protocol and carry
`rel="nofollow noopener noreferrer"`. A post body is untrusted text and must stay that way; do not
add an HTML or Markdown renderer here.

## Abuse limits, and what they are not

Reading a discussion costs a constant number of queries (9 SELECTs, measured at 5 and 25 replies)
because `get_thread` re-selects with `selectinload` after the view-count commit rather than calling
`db.refresh`, which would leave the collections unloaded and fetch each reply's author separately.
A test asserts the count does not differ between a 2-reply and a 9-reply discussion.

`services/community.py` holds a `WriteBudget` mirroring the assistant's `RequestBudget`: five new
discussions and thirty replies per player per ten minutes, with overall per-process ceilings of 120
and 600. Exceeding either returns **429** `community_rate_limited`.

These bounds are **per process**. Several workers each get their own budget, and a restart clears
them. They blunt an accidental loop or one browser flooding the board; they are not moderation.

This build has **no** moderation queue, report button, block list, word filter, edit history, quoting,
mentions, notifications, e-mail, attachments, images, or per-thread pagination — a discussion returns
all of its replies in one response. A deployment that expects real volume or hostile traffic needs a
moderation story and shared-state rate limiting before it relies on this.

## Verification performed

`make check` equivalents run individually: 1,637 frontend tests in 95 files, 121 backend tests,
production build and a 556.9 KiB initial gzip payload against the 1,500 KiB budget. Twelve backend
tests cover the lifecycle, authorship, counters, accepted answers, withdrawal semantics, filters,
facets, sorting, pagination, input rules, duplicate submits, write budgets, the project link and the
constant query cost of reading a discussion.
Eleven frontend tests cover browsing, error recovery, composing, replying, accepting, editing,
withdrawal, the withdrawn-thread view, the untrusted-text renderer, UTC timestamp parsing and header
navigation.

`npx eslint src` currently fails on `src/features/qt/samples.js` with 19 pre-existing `no-undef`
errors, and the checked-in `public/sitemap.xml` was stale by seventeen `/qt` URLs before this change.
Both predate this feature; the sitemap is regenerated here, the Qt lint errors are not addressed.

**Not performed:** no browser session exercised these pages, so the layout, the mobile width and the
real network path are unverified. That includes the header breakpoint move above: no headless browser
is available in this workspace, jsdom has no layout engine, and the fix was chosen from measured
element widths rather than observation. **Check the header at 640 px, 767 px and 768 px in a real
browser before release** — it affects every route, not only `/community`. No multi-worker deployment was run, so the per-process budgets were
only exercised in a single process. No load, spam or abuse testing was done.
