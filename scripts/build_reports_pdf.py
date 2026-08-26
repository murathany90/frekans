from __future__ import annotations

import argparse
import html
import re
from pathlib import Path
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer


PACKAGE = Path("docs/raporlar_tr_en/gridfreq_reports_package_12")
IMAGE_PATTERN = re.compile(r"^!\[([^]]*)\]\(([^)]+)\)$")
HEADING_PATTERN = re.compile(r"^(#{1,3})\s+(.+)$")


def find_font(name: str) -> Path:
    candidates = {
        "regular": (
            Path("C:/Windows/Fonts/arial.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        ),
        "bold": (
            Path("C:/Windows/Fonts/arialbd.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        ),
    }
    for candidate in candidates[name]:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(f"No Unicode {name} font found for PDF generation")


def register_fonts() -> tuple[str, str]:
    regular, bold = "GridFreq-Regular", "GridFreq-Bold"
    if regular not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(regular, str(find_font("regular"))))
        pdfmetrics.registerFont(TTFont(bold, str(find_font("bold"))))
    return regular, bold


def strip_front_matter(markdown: str) -> str:
    if not markdown.startswith("---\n"):
        return markdown
    _, _, remainder = markdown.partition("\n---\n")
    return remainder if remainder else markdown


def inline_markdown(value: str) -> str:
    escaped = html.escape(value, quote=False)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"`(.+?)`", r"<font face=\"Courier\">\1</font>", escaped)
    return escaped


def load_metadata(article_dir: Path) -> dict:
    import json

    return json.loads((article_dir / "metadata.json").read_text(encoding="utf-8"))


def styles() -> dict[str, ParagraphStyle]:
    regular, bold = register_fonts()
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("GridFreqTitle", parent=base["Title"], fontName=bold, fontSize=23, leading=28, textColor=colors.HexColor("#153960"), spaceAfter=12),
        "subtitle": ParagraphStyle("GridFreqSubtitle", parent=base["Normal"], fontName=regular, fontSize=12, leading=17, textColor=colors.HexColor("#536273"), spaceAfter=18),
        "h2": ParagraphStyle("GridFreqH2", parent=base["Heading2"], fontName=bold, fontSize=15, leading=19, textColor=colors.HexColor("#153960"), spaceBefore=14, spaceAfter=7),
        "h3": ParagraphStyle("GridFreqH3", parent=base["Heading3"], fontName=bold, fontSize=12, leading=16, textColor=colors.HexColor("#153960"), spaceBefore=10, spaceAfter=5),
        "body": ParagraphStyle("GridFreqBody", parent=base["BodyText"], fontName=regular, fontSize=10.2, leading=15.2, spaceAfter=8),
        "quote": ParagraphStyle("GridFreqQuote", parent=base["BodyText"], fontName=regular, fontSize=10.2, leading=15.2, leftIndent=12, borderColor=colors.HexColor("#4B8DBD"), borderWidth=2, borderPadding=8, textColor=colors.HexColor("#304B63"), spaceBefore=5, spaceAfter=12),
        "caption": ParagraphStyle("GridFreqCaption", parent=base["Normal"], fontName=regular, fontSize=8.5, leading=11, alignment=TA_CENTER, textColor=colors.HexColor("#536273"), spaceAfter=12),
    }


def image_story(image_path: Path, caption: str, style: ParagraphStyle) -> KeepTogether:
    image = Image(str(image_path))
    maximum_width = A4[0] - 3.2 * cm
    maximum_height = 15.5 * cm
    scale = min(maximum_width / image.imageWidth, maximum_height / image.imageHeight, 1)
    image.drawWidth *= scale
    image.drawHeight *= scale
    return KeepTogether([image, Spacer(1, 4), Paragraph(inline_markdown(caption), style)])


def article_story(article_dir: Path, article: dict, style_map: dict[str, ParagraphStyle]) -> tuple[str, list]:
    markdown = strip_front_matter((article_dir / "article.md").read_text(encoding="utf-8"))
    lines = markdown.splitlines()
    story = []
    title = article.get("title", "")
    for line in lines:
        heading = HEADING_PATTERN.match(line)
        if heading and len(heading.group(1)) == 1:
            title = heading.group(2).strip()
            break
    story.append(Paragraph(inline_markdown(title), style_map["title"]))

    paragraph: list[str] = []

    def flush() -> None:
        if paragraph:
            story.append(Paragraph(inline_markdown(" ".join(paragraph)), style_map["body"]))
            paragraph.clear()

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            flush()
            continue
        if line.startswith("**Alt başlık:**"):
            flush()
            subtitle = line.split(":", 1)[1].lstrip("*").strip()
            story.append(Paragraph(inline_markdown(subtitle), style_map["subtitle"]))
            continue
        image_match = IMAGE_PATTERN.match(line)
        if image_match:
            flush()
            image_path = article_dir / image_match.group(2)
            if not image_path.is_file():
                raise FileNotFoundError(f"Missing article image: {image_path}")
            story.append(image_story(image_path, image_match.group(1), style_map["caption"]))
            continue
        heading = HEADING_PATTERN.match(line)
        if heading:
            flush()
            level, heading_text = len(heading.group(1)), heading.group(2)
            if level == 1:
                continue
            story.append(Paragraph(inline_markdown(heading_text), style_map["h2" if level == 2 else "h3"]))
            continue
        if line.startswith(">"):
            flush()
            story.append(Paragraph(inline_markdown(line.lstrip("> ")), style_map["quote"]))
            continue
        paragraph.append(line)
    flush()
    return title, story


def output_path(article_dir: Path, metadata: dict, package_root: Path) -> Path:
    relative_pdf = metadata.get("pdf")
    if not isinstance(relative_pdf, str) or not relative_pdf:
        raise ValueError(f"Missing PDF path in {article_dir / 'metadata.json'}")
    target = (article_dir / relative_pdf).resolve()
    allowed = (package_root / "pdf").resolve()
    if allowed not in target.parents:
        raise ValueError(f"PDF output must stay under {allowed}: {target}")
    return target


def generate_reports_pdfs(package_root: Path = PACKAGE) -> list[Path]:
    package_root = package_root.resolve()
    style_map = styles()
    outputs: list[Path] = []
    for article_dir in sorted((package_root / "agent").glob("*")):
        if not article_dir.is_dir():
            continue
        metadata = load_metadata(article_dir)
        title, story = article_story(article_dir, metadata, style_map)
        target = output_path(article_dir, metadata, package_root)
        target.parent.mkdir(parents=True, exist_ok=True)
        document = SimpleDocTemplate(str(target), pagesize=A4, leftMargin=1.6 * cm, rightMargin=1.6 * cm, topMargin=1.6 * cm, bottomMargin=1.6 * cm, title=title, author="GridFreq")
        document.build(story)
        outputs.append(target)
    if len(outputs) != 12:
        raise ValueError(f"Expected 12 report PDFs, generated {len(outputs)}")
    return outputs


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate report PDFs from article.md source files.")
    parser.add_argument("--package", type=Path, default=PACKAGE)
    args = parser.parse_args()
    for output in generate_reports_pdfs(args.package):
        print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
