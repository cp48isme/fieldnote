/**
 * The briefing drawn as a PDF, with `pdf-lib` (ADR-0010).
 *
 * THE PAGE. 595 by 792 points: A4's width and Letter's height, so the same page prints
 * unscaled on either — the guide warned that a layout surviving a phone screen and a
 * printer is the fiddly part, and a page that fits inside both papers is the plain
 * answer. Generous margins and a single column, which reads on a phone at fit-to-width.
 *
 * FONTS. The standard Helvetica pair, which cover WinAnsi — Western European Latin,
 * the typographic quotes and dashes — and nothing beyond. A character the font cannot
 * encode is drawn as "?" rather than failing the whole document; the representative
 * sees the mark on the page and knows which name to check. Embedding a full Unicode
 * font is a fifth package and a font file, deferred until a real roster needs it
 * (ADR-0010).
 *
 * IMAGES. JPEG and PNG, the two shapes the store holds (`image/jpeg` from the device
 * resize; `image/png` is what a fixture or a later site map may be). Drawn into a fixed
 * box beside the attendee's name, scaled to fit, never cropped.
 *
 * THE FOOTER. Every page, two lines: the event and the generation time with "Page n of
 * m" beside them, then the expected-attendance line whole. Drawn in a second pass once
 * the page count is known.
 */

import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts } from "pdf-lib";

import type { BriefingBlock, BriefingDocument, BriefingImage } from "./compose";

export const PAGE = { width: 595.28, height: 792 } as const;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const BOTTOM = MARGIN + 40; // room for the two-line footer
const PHOTO_BOX = { width: 72, height: 96 } as const;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.4, 0.4, 0.45);
const RULE = rgb(0.8, 0.8, 0.82);

const SIZE = {
  title: 20,
  subtitle: 10,
  heading: 13,
  label: 8.5,
  body: 10.5,
  footer: 8,
} as const;
const LEADING = 1.35;
const UNENCODABLE = "?";

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/** Characters the standard fonts cannot encode become a visible mark. */
function encodable(text: string, font: PDFFont): string {
  const set = new Set(font.getCharacterSet());
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0)!;
    out += set.has(code) ? char : UNENCODABLE;
  }
  return out;
}

/** Greedy word wrap at `width` points; a word longer than the line is split by character. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      let piece = "";
      for (const char of word) {
        if (font.widthOfTextAtSize(piece + char, size) <= width) {
          piece += char;
        } else {
          lines.push(piece);
          piece = char;
        }
      }
      line = piece;
    }
    lines.push(line);
  }
  return lines;
}

class Layout {
  page!: PDFPage;
  y = 0;

  constructor(
    readonly doc: PDFDocument,
    readonly fonts: Fonts,
  ) {
    this.newPage();
  }

  newPage(): void {
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - MARGIN;
  }

  ensure(height: number): void {
    if (this.y - height < BOTTOM) this.newPage();
  }

  space(points: number): void {
    this.y -= points;
  }

  /** Draws wrapped text at the current position, moving down; page breaks between lines. */
  text(
    raw: string,
    font: PDFFont,
    size: number,
    color = INK,
    x = MARGIN,
    width = CONTENT_WIDTH,
  ): void {
    const line = size * LEADING;
    for (const piece of wrap(encodable(raw, font), font, size, width)) {
      this.ensure(line);
      this.page.drawText(piece, { x, y: this.y - size, size, font, color });
      this.y -= line;
    }
  }

  rule(): void {
    this.ensure(8);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE.width - MARGIN, y: this.y },
      thickness: 0.5,
      color: RULE,
    });
    this.y -= 8;
  }
}

async function embed(doc: PDFDocument, image: BriefingImage): Promise<PDFImage | null> {
  const bytes = new Uint8Array(image.bytes);
  if (image.mediaType === "image/jpeg") return doc.embedJpg(bytes);
  if (image.mediaType === "image/png") return doc.embedPng(bytes);
  return null;
}

async function drawCard(
  layout: Layout,
  block: BriefingBlock & { kind: "card" },
): Promise<void> {
  const { fonts, doc } = layout;
  const embedded = block.image ? await embed(doc, block.image) : null;
  const textX = embedded ? MARGIN + PHOTO_BOX.width + 12 : MARGIN;
  const textWidth = CONTENT_WIDTH - (textX - MARGIN);

  // Keep the card's head together with its photo: the title and photo box on one page.
  const titleLine = SIZE.body * LEADING;
  layout.ensure(Math.max(titleLine * 2, embedded ? PHOTO_BOX.height : 0) + 4);
  const top = layout.y;

  if (embedded) {
    const scale = Math.min(
      PHOTO_BOX.width / embedded.width,
      PHOTO_BOX.height / embedded.height,
      1,
    );
    const width = embedded.width * scale;
    const height = embedded.height * scale;
    layout.page.drawImage(embedded, {
      x: MARGIN,
      y: top - height,
      width,
      height,
    });
  }

  layout.text(block.title, fonts.bold, SIZE.body, INK, textX, textWidth);
  for (const line of block.lines) {
    layout.text(line, fonts.regular, SIZE.body, INK, textX, textWidth);
  }
  if (embedded && top - layout.y < PHOTO_BOX.height) {
    layout.y = top - PHOTO_BOX.height;
  }
  layout.space(10);
}

export async function renderBriefing(document: BriefingDocument): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(encodable(document.title, await doc.embedFont(StandardFonts.Helvetica)));
  doc.setProducer("Fieldnote");
  doc.setCreator("Fieldnote");
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const layout = new Layout(doc, fonts);

  layout.text(document.title, fonts.bold, SIZE.title);
  layout.text(document.subtitle, fonts.regular, SIZE.subtitle, MUTED);
  layout.space(10);

  for (const section of document.sections) {
    layout.ensure(SIZE.heading * LEADING * 3);
    layout.space(6);
    layout.text(section.heading.toUpperCase(), fonts.bold, SIZE.heading);
    layout.rule();
    for (const block of section.blocks) {
      if (block.kind === "paragraph") {
        layout.text(block.text, fonts.regular, SIZE.body);
        layout.space(6);
      } else if (block.kind === "field") {
        layout.text(block.label.toUpperCase(), fonts.bold, SIZE.label, MUTED);
        layout.text(block.text, fonts.regular, SIZE.body);
        layout.space(6);
      } else {
        await drawCard(layout, block);
      }
    }
    layout.space(8);
  }

  // Footer, second pass.
  const pages = doc.getPages();
  const footerLine = SIZE.footer * LEADING;
  pages.forEach((page, index) => {
    const count = `Page ${index + 1} of ${pages.length}`;
    const countWidth = fonts.regular.widthOfTextAtSize(count, SIZE.footer);
    const draw = (text: string, x: number, y: number) =>
      page.drawText(encodable(text, fonts.regular), {
        x,
        y,
        size: SIZE.footer,
        font: fonts.regular,
        color: MUTED,
      });
    page.drawLine({
      start: { x: MARGIN, y: MARGIN + footerLine * 2 + 4 },
      end: { x: PAGE.width - MARGIN, y: MARGIN + footerLine * 2 + 4 },
      thickness: 0.5,
      color: RULE,
    });
    const [first] = wrap(
      encodable(document.footer.event, fonts.regular),
      fonts.regular,
      SIZE.footer,
      CONTENT_WIDTH - countWidth - 12,
    );
    draw(first ?? "", MARGIN, MARGIN + footerLine);
    draw(count, PAGE.width - MARGIN - countWidth, MARGIN + footerLine);
    const [second] = wrap(
      encodable(document.footer.attendance, fonts.regular),
      fonts.regular,
      SIZE.footer,
      CONTENT_WIDTH,
    );
    draw(second ?? "", MARGIN, MARGIN);
  });

  return doc.save();
}
