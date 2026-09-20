# Course completion certificates

All 150 self-study courses can issue a PDF after an 80% exam pass: 34 core, 5 robotics,
6 vision, 10 HPC, 10 cybersecurity, 18 MATLAB, 20 AI agents, 18 computer/assembly, 13 C++/WinUI and 16 Qt/C++.
The shared exam presents the certificate form after a passing result. Existing records recover
on course load and at `/certificates`; `/certificates/:certificateId` is the public verifier.

## Meaning and issuance

The learner chooses a name and explicitly agrees to share their certificate name, course, score
and issue date with anyone holding its verification link. The server grades five submitted answers
against the current authored exam. It never trusts client scores, localStorage, read checks or
uploaded PDFs. Answer keys remain public study material: this is an **unproctored self-study
completion certificate** with a self-declared name, not an accredited qualification, identity
verification or proof of independent competence. The PDF and verifier explain that scope.

Issuance uses existing player JWT authentication, including guests. A unique constraint on
`(player_id, course_id, course_version)` makes duplicate/concurrent requests return the same
immutable name, score, date, title and PDF. Retakes do not replace a certificate. Older local
scores contain no answer evidence: a learner must pass in the current visit to issue a new record.
Offline courses remain usable, but certificates require the server. Guests retain public links;
claiming an account and logging in elsewhere recover ownership and downloads.

## API and data

- `POST /api/certificates` (auth): `{course_id,course_version,learner_name,answers,share_consent:true}`.
  Exactly five bounded question/option ids. Unknown fields, incomplete/invalid answers, unsupported
  names, scores under 80% and missing consent return 422. Version mismatch returns 409; missing
  course 404. Success/replay returns the certificate with HTTP 200.
- `GET /api/certificates/mine?course_id=` (auth) returns `{certificates:[...]}`, newest first.
- `GET /api/certificates/{uuid}` (public) returns the record or 404.
- `GET /api/certificates/{uuid}/pdf` (public) returns the saved PDF attachment or 404.

Public record: `{id,learner_name,course_id,course_version,course_title,course_path,percent,
issued_at,verification_url,pdf_sha256,assessment:'unproctored-self-study',status:'issued'}`.
It omits player ids, usernames, credentials and answer choices. UUID4 codes have no public
directory/name search. Certificate detail URLs are absent from the sitemap and disallowed by
robots.txt; public API responses carry no-store/noindex headers.

The additive `course_certificates` SQLAlchemy table stores these snapshots, a player foreign key
and exact PDF binary. Startup `create_all()` adds the table without changing existing tables.
Back it up with the database. Certificates have no expiry/revocation workflow. Campaign XP and
`vq.courses.v1` remain unchanged. `services/certificates.py` caches ten known catalogues from
`CONTENT_DIR`; restart after curriculum changes. `/api/courses` still exposes its 34-course catalogue.

## PDF and integrity

Pinned ReportLab 4.4.10 creates a landscape PDF with embedded bundled Vera fonts, literal text,
clickable verification URL and QR code. No network resources or HTML are rendered. Names are
normalized to NFC and limited to 2–80 printable supported glyphs; unsupported glyphs request
transliteration instead of silently producing missing characters. PDFs use English and canonical
course titles; interface text supports Indonesian and preserves state on language changes.

Set **`PUBLIC_APP_URL`** before issuing deployment certificates. It is the trusted frontend origin,
defaulting to `http://localhost:5173` in direct development or `http://localhost:8080` in Compose.
Use `https://pcb.nevatal.id` for that deployment. It must be HTTP(S), with no credentials, path,
query or fragment. Request Host/forwarding headers cannot change it. Changing this setting does
not rewrite previously issued PDFs.

The server stores the SHA-256 of the original PDF. The verifier can compare a selected PDF up to
2 MiB using browser Web Crypto; the file is never uploaded. Changed/re-saved bytes do not match.
This is record/file-integrity verification, not a PDF digital signature or identity attestation.
File checking needs HTTPS or localhost. The record and exact original remain downloadable.

## Verification

Backend tests issue/parse PDFs for all 150 courses, checking extracted names, titles, scores,
identifiers, clickable URLs and exact hashes. They cover rejected answers, version/auth/consent,
immutable replay, ownership, account recovery, catalogue changes, codes and untrusted Host headers.
Frontend tests cover form gating, submitted answers, downloads, locale/account changes, unavailable
records and actual Web Crypto matches/mismatches. See IMPLEMENTATION_STATUS.md for browser evidence.
