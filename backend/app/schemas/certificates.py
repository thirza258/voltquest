"""Certificate issuance accepts exam answers, never a client-provided score."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

ShortId = Annotated[str, StringConstraints(min_length=1, max_length=100, strict=True)]


class CertificateIssue(BaseModel):
    model_config = ConfigDict(extra="forbid")

    course_id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9-]+$")
    course_version: int = Field(ge=1, le=100000, strict=True)
    learner_name: str = Field(min_length=2, max_length=80, strict=True)
    answers: dict[ShortId, ShortId] = Field(min_length=5, max_length=5)
    share_consent: Literal[True]
