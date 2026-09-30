from __future__ import annotations

import re
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "course" / "portugisisk-intensivkurs.pdf"
COURSE = ROOT / "course" / "portugisisk-intensivkurs"

NAVY = colors.HexColor("#10243E")
INK = colors.HexColor("#182231")
BLUE = colors.HexColor("#2364AA")
TEAL = colors.HexColor("#0F8B8D")
CREAM = colors.HexColor("#F7F3EA")
PALE = colors.HexColor("#EAF3F7")
GOLD = colors.HexColor("#E6A94B")
MUTED = colors.HexColor("#5E6B78")
WHITE = colors.white
LINE = colors.HexColor("#D7E0E7")


def normalize(text: str) -> str:
    return (
        text.replace("\u2011", "-")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("→", " -> ")
    )


def inline(text: str) -> str:
    text = normalize(text)
    text = escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`(.+?)`", r"<font name='Arial-Italic'>\1</font>", text)
    return text


FONT_DIR = Path("/System/Library/Fonts/Supplemental")
pdfmetrics.registerFont(TTFont("Arial", str(FONT_DIR / "Arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold", str(FONT_DIR / "Arial Bold.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Italic", str(FONT_DIR / "Arial Italic.ttf")))
pdfmetrics.registerFont(TTFont("Arial-BoldItalic", str(FONT_DIR / "Arial Bold Italic.ttf")))
pdfmetrics.registerFontFamily(
    "Arial",
    normal="Arial",
    bold="Arial-Bold",
    italic="Arial-Italic",
    boldItalic="Arial-BoldItalic",
)

base = getSampleStyleSheet()
STYLES = {
    "h1": ParagraphStyle(
        "h1",
        parent=base["Heading1"],
        fontName="Arial-Bold",
        fontSize=22,
        leading=26,
        textColor=NAVY,
        spaceBefore=4 * mm,
        spaceAfter=4 * mm,
    ),
    "h2": ParagraphStyle(
        "h2",
        parent=base["Heading2"],
        fontName="Arial-Bold",
        fontSize=14.5,
        leading=18,
        textColor=BLUE,
        spaceBefore=4 * mm,
        spaceAfter=2 * mm,
    ),
    "h3": ParagraphStyle(
        "h3",
        parent=base["Heading3"],
        fontName="Arial-Bold",
        fontSize=11.3,
        leading=14,
        textColor=TEAL,
        spaceBefore=3 * mm,
        spaceAfter=1.5 * mm,
    ),
    "body": ParagraphStyle(
        "body",
        parent=base["BodyText"],
        fontName="Arial",
        fontSize=9.4,
        leading=13.3,
        textColor=INK,
        spaceAfter=2.2 * mm,
    ),
    "bullet": ParagraphStyle(
        "bullet",
        parent=base["BodyText"],
        fontName="Arial",
        fontSize=9.2,
        leading=12.8,
        textColor=INK,
        leftIndent=5 * mm,
        firstLineIndent=-3.5 * mm,
        bulletIndent=1.5 * mm,
        spaceAfter=1.2 * mm,
    ),
    "number": ParagraphStyle(
        "number",
        parent=base["BodyText"],
        fontName="Arial",
        fontSize=9.2,
        leading=12.8,
        textColor=INK,
        leftIndent=6 * mm,
        firstLineIndent=-4.5 * mm,
        spaceAfter=1.2 * mm,
    ),
    "code": ParagraphStyle(
        "code",
        parent=base["Code"],
        fontName="Arial",
        fontSize=7.8,
        leading=10.8,
        textColor=INK,
        backColor=colors.HexColor("#F2F5F7"),
        borderColor=LINE,
        borderWidth=0.5,
        borderPadding=5,
        spaceAfter=1 * mm,
    ),
    "small": ParagraphStyle(
        "small",
        parent=base["BodyText"],
        fontName="Arial",
        fontSize=7.5,
        leading=10.2,
        textColor=MUTED,
    ),
    "callout": ParagraphStyle(
        "callout",
        parent=base["BodyText"],
        fontName="Arial-Bold",
        fontSize=10.5,
        leading=15,
        textColor=NAVY,
        backColor=PALE,
        borderColor=TEAL,
        borderWidth=0.8,
        borderPadding=8,
        spaceBefore=2 * mm,
        spaceAfter=4 * mm,
    ),
}


class CourseDoc(BaseDocTemplate):
    pass


def page_canvas(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, height - 13 * mm, width, 13 * mm, fill=1, stroke=0)
    canvas.setFont("Arial-Bold", 7.8)
    canvas.setFillColor(WHITE)
    canvas.drawString(17 * mm, height - 8.3 * mm, "PORTUGUÊS EM MOVIMENTO")
    canvas.setFont("Arial", 7.4)
    canvas.setFillColor(MUTED)
    canvas.drawString(17 * mm, 10 * mm, "Voice-first intensivkurs i europeisk portugisisk")
    canvas.drawRightString(width - 17 * mm, 10 * mm, str(doc.page))
    canvas.setStrokeColor(LINE)
    canvas.line(17 * mm, 14 * mm, width - 17 * mm, 14 * mm)
    canvas.restoreState()


def cover_canvas(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setFillColor(BLUE)
    canvas.circle(width - 30 * mm, height - 38 * mm, 47 * mm, fill=1, stroke=0)
    canvas.setFillColor(TEAL)
    canvas.circle(width - 12 * mm, 23 * mm, 36 * mm, fill=1, stroke=0)
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(2)
    canvas.line(22 * mm, 60 * mm, 105 * mm, 60 * mm)
    canvas.setFillColor(WHITE)
    canvas.setFont("Arial-Bold", 34)
    canvas.drawString(22 * mm, height - 78 * mm, "Português")
    canvas.drawString(22 * mm, height - 94 * mm, "em Movimento")
    canvas.setFont("Arial", 15)
    canvas.drawString(22 * mm, height - 111 * mm, "Et voice-first 12-ukers intensivkurs")
    canvas.setFont("Arial-Bold", 11)
    canvas.setFillColor(GOLD)
    canvas.drawString(22 * mm, height - 128 * mm, "EUROPEISK PORTUGISISK · PT-PT")
    canvas.setFillColor(WHITE)
    canvas.setFont("Arial", 10)
    canvas.drawString(22 * mm, 46 * mm, "Feltmanual · AI-tutor · progresjonssystem")
    canvas.setFont("Arial-Italic", 9)
    canvas.drawString(22 * mm, 37 * mm, "En feltmanual for et liv på portugisisk")
    canvas.restoreState()


def md_table(rows: list[list[str]], widths=None) -> Table:
    data = []
    for i, row in enumerate(rows):
        style = STYLES["small"] if i else ParagraphStyle(
            "tablehead",
            parent=STYLES["small"],
            fontName="Arial-Bold",
            textColor=WHITE,
            leading=9.4,
        )
        data.append([Paragraph(inline(cell.strip()), style) for cell in row])
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, CREAM]),
                ("GRID", (0, 0), (-1, -1), 0.35, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def parse_markdown(path: Path, skip_title: bool = False):
    lines = path.read_text(encoding="utf-8").splitlines()
    story = []
    paragraph = []
    code_mode = False
    code_lines = []
    i = 0

    def flush_paragraph():
        if paragraph:
            story.append(Paragraph(inline(" ".join(paragraph)), STYLES["body"]))
            paragraph.clear()

    while i < len(lines):
        line = lines[i].rstrip()
        if line.startswith("```"):
            flush_paragraph()
            if code_mode:
                for code_line in code_lines:
                    story.append(Paragraph(escape(normalize(code_line)) or "&nbsp;", STYLES["code"]))
                code_lines = []
            code_mode = not code_mode
            i += 1
            continue
        if code_mode:
            code_lines.append(line)
            i += 1
            continue
        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|?[\s:|-]+\|", lines[i + 1]):
            flush_paragraph()
            raw = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                raw.append([c for c in lines[i].strip().strip("|").split("|")])
                i += 1
            if len(raw) >= 2:
                raw.pop(1)
                count = len(raw[0])
                available = 176 * mm
                if count == 4:
                    widths = [13 * mm, 48 * mm, 55 * mm, 60 * mm]
                elif count == 8:
                    widths = [10 * mm] + [available / 7.5] * 7
                else:
                    widths = [available / count] * count
                story.extend([md_table(raw, widths), Spacer(1, 3 * mm)])
            continue
        if not line:
            flush_paragraph()
            i += 1
            continue
        heading = re.match(r"^(#{1,3})\s+(.+)$", line)
        if heading:
            flush_paragraph()
            level = len(heading.group(1))
            if skip_title and level == 1:
                i += 1
                continue
            story.append(Paragraph(inline(heading.group(2)), STYLES[f"h{level}"]))
            if level == 1:
                story.append(HRFlowable(width="100%", thickness=1.2, color=GOLD, spaceAfter=3 * mm))
            i += 1
            continue
        bullet = re.match(r"^-\s+(.+)$", line)
        if bullet:
            flush_paragraph()
            story.append(Paragraph("• " + inline(bullet.group(1)), STYLES["bullet"]))
            i += 1
            continue
        numbered = re.match(r"^(\d+)[.)]\s+(.+)$", line)
        if numbered:
            flush_paragraph()
            story.append(Paragraph(f"{numbered.group(1)}. " + inline(numbered.group(2)), STYLES["number"]))
            i += 1
            continue
        paragraph.append(line)
        i += 1
    flush_paragraph()
    return story


def research_section():
    story = [
        Paragraph("Forskningsgrunnlaget", STYLES["h1"]),
        HRFlowable(width="100%", thickness=1.2, color=GOLD, spaceAfter=3 * mm),
        Paragraph(
            "Det finnes ingen troverdig deklassifisert snarvei. Offentlig dokumenterte CIA- og FSI-prinsipper peker på et system: intensitet, oppdragsrelevans, muntlig-aural automatisering, individuell tilpasning, immersjon og ferdighetstesting. Kurset moderniserer dette med aktiv gjenhenting, spacing, perceptuell uttaletrening, korrigerende tilbakemelding og dialogbasert læring.",
            STYLES["callout"],
        ),
        Paragraph("Hva vi beholder fra intensiv statlig språkopplæring", STYLES["h2"]),
    ]
    principles = [
        ("Intensitet", "Hyppig, beskyttet tid og høy mengde aktiv respons."),
        ("Oppdragsrelevans", "Tren situasjonene og vokabularet som faktisk skal brukes."),
        ("Overlearning", "Automatiser et lite antall høyverdige mønstre under press."),
        ("Én-til-én", "Tilpass tempo, feilretting og støtte til den enkelte."),
        ("Immersjon", "Øk portugisiskandelen gradvis og bruk språket i virkeligheten."),
        ("Testing", "Mål usett oppdragsgjennomføring, ikke bare gjennomgått innhold."),
        ("Metodeblanding", "Ingen enkeltteknikk passer alle mål; kombiner det som virker."),
    ]
    for title, body in principles:
        story.append(Paragraph(f"<b>{title}:</b> {body}", STYLES["bullet"]))
    story.extend(
        [
            Paragraph("Hva forskningen legger til", STYLES["h2"]),
            md_table(
                [
                    ["Prinsipp", "Evidens", "Bruk i kurset"],
                    ["Spaced retrieval", "Meta-analyse av 48 L2-eksperimenter", "Samme dag, +1, +3, +7, +14 og +30"],
                    ["Lydoppfattelse", "Meta-analyse av 65 fonetikkstudier", "Hør forskjellen før og sammen med produksjon"],
                    ["Korreksjon", "Meta-analyse av 33 studier", "Maks tre prioriterte feil og ny bruk"],
                    ["Eksplisitte mønstre", "Meta-analyser av instruert L2", "Kort regelkontroll, deretter fri bruk"],
                    ["Dialogbasert CALL", "Tre-nivå meta-analyse", "Daglige oppdrag og forhandling om mening"],
                ],
                [43 * mm, 59 * mm, 74 * mm],
            ),
            Spacer(1, 3 * mm),
            Paragraph("Europeisk portugisisk krever et eget lydspor", STYLES["h2"]),
            Paragraph(
                "Ubetonte vokaler reduseres ofte kraftig i naturlig tale. En elev kan kjenne ordet skriftlig og likevel ikke oppfatte det. Derfor bruker kurset en lyttestige: helhetsforståelse uten tekst -> detaljer -> transkripsjon -> markering av trykk og reduksjoner -> gjentakelse -> ny taler -> gjenfortelling.",
                STYLES["body"],
            ),
            Paragraph("Realistisk 12-ukersmål", STYLES["h2"]),
            Paragraph(
                "Ved 2-3 fokuserte timer daglig, pluss portugisisk i hverdagen, er solid A2 og en begynnende B1-profil et ambisiøst planleggingsmål fra nybegynnernivå. Et jevnt B1-nivå i alle ferdigheter er mulig, men ikke garantert. FSI-benchmarket på 600-750 klasseromstimer gjelder et langt høyere profesjonelt mål og kan ikke oversettes direkte til CEFR.",
                STYLES["callout"],
            ),
        ]
    )
    return story


def sources_section():
    sources = [
        ("U.S. Department of State - Foreign Language Training", "https://2021-2025.state.gov/foreign-language-training/"),
        ("Foreign Affairs Manual - intensive language training", "https://fam.state.gov/FAM/13FAH01/13FAH010220.html"),
        ("CIA - foreign language training regulation, 1952", "https://www.cia.gov/readingroom/document/cia-rdp56-00403a000100060023-8"),
        ("CIA - future methods and programmed instruction", "https://www.cia.gov/readingroom/document/cia-rdp78-04724a000700010001-7"),
        ("CIA - long-range language-training plan, 1983", "https://www.cia.gov/readingroom/document/cia-rdp85b01152r000901240034-7"),
        ("CIA/FSI - standards and overlearning", "https://www.cia.gov/readingroom/document/cia-rdp61-00357r000100180003-9"),
        ("Language Transfer - official courses and method", "https://www.languagetransfer.org/courses"),
        ("Spacing meta-analysis", "https://onlinelibrary.wiley.com/doi/abs/10.1111/lang.12479"),
        ("L2 phonetic-training meta-analysis", "https://pubs.asha.org/doi/abs/10.1044/2024_JSLHR-24-00432"),
        ("Pronunciation-instruction meta-analysis", "https://eric.ed.gov/?id=EJ1067987"),
        ("Corrective-feedback meta-analysis", "https://onlinelibrary.wiley.com/doi/10.1111/j.1467-9922.2010.00561.x"),
        ("Dialogue-based CALL meta-analysis", "https://www.cambridge.org/core/journals/recall/article/dialoguebased-computer-assisted-language-learning-systems-for-second-language-speaking-development-a-threelevel-metaanalysis/31847710516602398819C5E594038E7B"),
        ("CEFR Companion Volume", "https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-companion-volume-and-its-language-versions"),
        ("CAPLE examinations", "https://caple.letras.ulisboa.pt/exames"),
        ("Camões online learning", "https://www.instituto-camoes.pt/activity/servicos-online/ensino-a-distancia/cursos-gerais-de-portugues/autoaprendizagem"),
        ("Practice Portuguese", "https://help.practiceportuguese.com/article/44-membership-benefits"),
    ]
    story = [
        Paragraph("Kilder og videre kalibrering", STYLES["h1"]),
        HRFlowable(width="100%", thickness=1.2, color=GOLD, spaceAfter=3 * mm),
        Paragraph(
            "Kildene nedenfor støtter metodikken. De skal brukes som kalibrering, ikke som en oppfordring til å samle mer materiale enn det som faktisk trenes muntlig.",
            STYLES["body"],
        ),
    ]
    for index, (name, url) in enumerate(sources, start=1):
        story.append(
            Paragraph(
                f"<b>{index}. {escape(name)}</b><br/><link href='{escape(url)}' color='#2364AA'>{escape(url)}</link>",
                STYLES["small"],
            )
        )
        story.append(Spacer(1, 1.6 * mm))
    story.extend(
        [
            Spacer(1, 4 * mm),
            Paragraph("Kvalitetsregel", STYLES["h2"]),
            Paragraph(
                "AI-tutoren er et volum- og tilpasningsverktøy, ikke den eneste uttaledommeren. Bruk ukentlig en kompetent pt-PT-taler eller verifisert morsmålsinnspilling for å kontrollere uttale, register og naturlighet.",
                STYLES["callout"],
            ),
        ]
    )
    return story


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = CourseDoc(
        str(OUT),
        pagesize=A4,
        leftMargin=17 * mm,
        rightMargin=17 * mm,
        topMargin=20 * mm,
        bottomMargin=18 * mm,
        title="Português em Movimento",
        author="Português em Movimento",
        subject="Voice-first 12-week European Portuguese intensive course",
    )
    frame = Frame(17 * mm, 17 * mm, A4[0] - 34 * mm, A4[1] - 36 * mm, id="body")
    cover = PageTemplate(id="cover", frames=[frame], onPage=cover_canvas)
    body = PageTemplate(id="body", frames=[frame], onPage=page_canvas)
    doc.addPageTemplates([cover, body])

    story = [Spacer(1, 220 * mm), PageBreak()]
    doc.handle_nextPageTemplate("body")
    story.extend(
        [
            Paragraph("Les dette først", STYLES["h1"]),
            HRFlowable(width="100%", thickness=1.2, color=GOLD, spaceAfter=3 * mm),
            Paragraph(
                "Dette er feltmanualen for et voice-first læringssystem. Stemmen er hovedarenaen. Dokumentet definerer systemet rundt stemmen: progresjon, oppdrag, tutoradferd, måling og støttemateriale som genereres ved behov.",
                STYLES["callout"],
            ),
            Paragraph("Operativ start", STYLES["h2"]),
            Paragraph("1. Åpne progresjonsloggen og fyll ut profil og tidsbudsjett.", STYLES["number"]),
            Paragraph("2. Gi voice-tutoren den faste instruksen i denne manualen.", STYLES["number"]),
            Paragraph("3. Gjennomfør dag 0 som en ærlig baseline uten hjelp.", STYLES["number"]),
            Paragraph("4. Tren seks fulle dager og bruk dag 7 til lett test, reparasjon og planlegging.", STYLES["number"]),
            Paragraph("5. Omkalibrer etter dag 7, uke 4 og uke 8. Ikke jag kalenderen dersom oppdragene ikke kan løses.", STYLES["number"]),
            Spacer(1, 3 * mm),
            Paragraph("Definisjon av fremgang", STYLES["h2"]),
            Paragraph(
                "Fremgang betyr at eleven forstår og fullfører stadig mer krevende, usette oppdrag på portugisisk. Å kjenne igjen en regel eller klare en øvd dialog er ikke nok. Et oppdrag er bestått når det kan gjentas uten manus og med en uventet variasjon.",
                STYLES["body"],
            ),
            PageBreak(),
        ]
    )
    story.extend(research_section())
    story.append(PageBreak())
    course_files = [
        "00-KURSPLAN.md",
        "02-FØRSTE-14-DAGER.md",
        "01-VOICE-TUTOR-PROMPT.md",
        "04-DAGLIG-ØKTGENERATOR.md",
        "03-PROGRESJONSLOGG.md",
    ]
    for index, filename in enumerate(course_files):
        story.extend(parse_markdown(COURSE / filename, skip_title=False))
        if index < len(course_files) - 1:
            story.extend([Spacer(1, 5 * mm), HRFlowable(width="100%", thickness=0.8, color=LINE), Spacer(1, 3 * mm)])
    story.append(PageBreak())
    story.extend(sources_section())
    doc.build(story)
    print(OUT)


if __name__ == "__main__":
    build()
