from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_player, get_db
from app.db.models import Player
from app.schemas.certificates import CertificateIssue
from app.services import certificates as service

router = APIRouter(prefix="/certificates", tags=["certificates"])


@router.get("/mine")
def mine(course_id: str | None = Query(default=None, max_length=80), player: Player = Depends(get_current_player), db: Session = Depends(get_db)):
    return service.mine(db, player, course_id)


@router.post("")
def issue(body: CertificateIssue, player: Player = Depends(get_current_player), db: Session = Depends(get_db)):
    return service.issue(db, player, body)


@router.get("/{code}")
def verify(code: str, response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    return service.public_record(service.verified_record(db, code))


@router.get("/{code}/pdf")
def pdf(code: str, db: Session = Depends(get_db)):
    record = service.verified_record(db, code)
    return Response(content=record.pdf, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="voltquest-certificate-{record.id}.pdf"',
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow",
    })
