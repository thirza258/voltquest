"""A self-contained PDF with embedded fonts, clickable verification and a QR code."""

from io import BytesIO
from pathlib import Path
from unicodedata import normalize

import reportlab
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

from app.domain.errors import InvalidInput

FONT_DIR = Path(reportlab.__file__).parent / "fonts"
pdfmetrics.registerFont(TTFont("VQRegular", str(FONT_DIR / "Vera.ttf")))
pdfmetrics.registerFont(TTFont("VQBold", str(FONT_DIR / "VeraBd.ttf")))


def certificate_name(value: str) -> str:
    value = normalize("NFC", value.strip())
    if not 2 <= len(value) <= 80 or any(not char.isprintable() for char in value):
        raise InvalidInput("Use a certificate name of 2 to 80 printable characters.")
    glyphs = pdfmetrics.getFont("VQRegular").face.charToGlyph
    if any(ord(char) not in glyphs for char in value):
        raise InvalidInput("Some name characters are unavailable in the PDF font. Please use a transliterated name.")
    return value


def build_certificate(record) -> bytes:
    buffer = BytesIO()
    width, height = landscape(A4)
    canvas = Canvas(buffer, pagesize=(width, height), pageCompression=1, invariant=1)
    canvas.setTitle(f"VoltQuest certificate - {record.course_title}")
    canvas.setAuthor("VoltQuest")
    canvas.setSubject("Unproctored self-study course completion")
    teal, ink, muted = HexColor("#0f766e"), HexColor("#172f36"), HexColor("#51646a")
    canvas.setFillColor(HexColor("#fafbf8")); canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setFillColor(teal); canvas.rect(0, 0, 20, height, fill=1, stroke=0)
    canvas.setStrokeColor(HexColor("#bdcdc6")); canvas.setLineWidth(1)
    canvas.rect(37, 30, width - 67, height - 60, fill=0, stroke=1)

    def centered(text, y, size=14, font="VQRegular", color=ink, available=680):
        size = min(size, available / max(pdfmetrics.stringWidth(text, font, 1), 1))
        canvas.setFont(font, size); canvas.setFillColor(color)
        canvas.drawCentredString(width / 2, y, text)

    centered("VOLTQUEST", height - 80, 19, "VQBold", teal)
    centered("CERTIFICATE OF COMPLETION", height - 136, 26, "VQBold")
    centered("This certifies that", height - 174, 12, color=muted)
    centered(record.learner_name, height - 215, 30, "VQBold")
    centered("has passed the self-study exam for", height - 251, 12, color=muted)
    # Wrap long authored course titles; user strings are always literal canvas text.
    lines, line = [], ""
    for word in record.course_title.split():
        candidate = f"{line} {word}".strip()
        if line and pdfmetrics.stringWidth(candidate, "VQBold", 19) > 660:
            lines.append(line); line = word
        else:
            line = candidate
    lines.append(line)
    for index, line in enumerate(lines):
        centered(line, height - 289 - index * 25, 19, "VQBold", teal)
    centered(f"Score: {record.percent}%    |    Pass mark: 80%    |    Course version: {record.course_version}", 232, 11)
    centered(f"Issued {record.issued_at.strftime('%d %B %Y')} (UTC)", 207, 11, color=muted)
    canvas.setStrokeColor(HexColor("#cda95b")); canvas.line(78, 182, width - 68, 182)
    canvas.setFillColor(ink); canvas.setFont("VQBold", 10)
    canvas.drawString(80, 157, "VERIFY THIS CERTIFICATE")
    canvas.setFont("VQRegular", 9); canvas.drawString(80, 138, f"Certificate ID: {record.id}")
    canvas.setFont("VQRegular", min(9, 570 / pdfmetrics.stringWidth(record.verification_url, "VQRegular", 1)))
    canvas.setFillColor(teal); canvas.drawString(80, 118, record.verification_url)
    canvas.linkURL(record.verification_url, (78, 111, 657, 134), relative=0, thickness=0)
    qr = QrCodeWidget(record.verification_url, barLevel="M")
    x0, y0, x1, y1 = qr.getBounds()
    drawing = Drawing(86, 86, transform=[86 / (x1-x0), 0, 0, 86 / (y1-y0), 0, 0])
    drawing.add(qr); renderPDF.draw(drawing, canvas, width-150, 96)
    centered("Unproctored self-study exam. Learner name is self-declared.", 75, 9, color=muted)
    centered("This is not an accredited qualification. Verify the record and original PDF at the link above.", 58, 8, color=muted)
    canvas.showPage(); canvas.save()
    return buffer.getvalue()
