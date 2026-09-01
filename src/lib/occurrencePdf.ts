import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type PDFImage,
} from "pdf-lib";
import {
  OCCURRENCE_STATUS_LABELS,
  SIGNATURE_ORDER,
  SIGNATURE_ROLE_LABELS,
  formatKm,
} from "./domain";

const PAGE_WIDTH = 595.28; // A4, pt
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = rgb(0.09, 0.11, 0.15);
const MUTED = rgb(0.4, 0.44, 0.51);
const RED = rgb(0.72, 0.11, 0.11);
const GREEN = rgb(0.02, 0.45, 0.31);

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (para.trim().length === 0) {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

class PdfWriter {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;

  constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  ensureSpace(height: number) {
    if (this.y - height < MARGIN) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  text(
    str: string,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {}
  ) {
    const size = opts.size ?? 10;
    const font = opts.font ?? this.font;
    const color = opts.color ?? INK;
    const lines = wrapText(str, font, size, CONTENT_WIDTH);
    for (const line of lines) {
      this.ensureSpace(size + 5);
      this.page.drawText(line, {
        x: MARGIN,
        y: this.y - size,
        size,
        font,
        color,
      });
      this.y -= size + 5;
    }
  }

  heading(str: string) {
    this.ensureSpace(22);
    this.y -= 8;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.5,
      color: rgb(0.85, 0.87, 0.9),
    });
    this.y -= 12;
    this.text(str, { size: 11, font: this.bold, color: MUTED });
  }

  space(h: number) {
    this.y -= h;
  }

  imageRow(images: { img: PDFImage; label?: string }[], boxSize = 130) {
    const gap = 10;
    const perRow = Math.max(
      1,
      Math.floor((CONTENT_WIDTH + gap) / (boxSize + gap))
    );
    for (let i = 0; i < images.length; i += perRow) {
      const row = images.slice(i, i + perRow);
      this.ensureSpace(boxSize + 16);
      let x = MARGIN;
      const rowY = this.y;
      for (const { img } of row) {
        const scale = Math.min(boxSize / img.width, boxSize / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        this.page.drawImage(img, {
          x: x + (boxSize - w) / 2,
          y: rowY - boxSize + (boxSize - h) / 2,
          width: w,
          height: h,
        });
        this.page.drawRectangle({
          x,
          y: rowY - boxSize,
          width: boxSize,
          height: boxSize,
          borderColor: rgb(0.85, 0.87, 0.9),
          borderWidth: 0.5,
        });
        x += boxSize + gap;
      }
      this.y = rowY - boxSize - 14;
    }
  }
}

async function fetchAndEmbedImage(
  doc: PDFDocument,
  url: string
): Promise<PDFImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "";
    try {
      if (contentType.includes("png")) return await doc.embedPng(bytes);
      return await doc.embedJpg(bytes);
    } catch {
      // Content-Type mentiu ou não veio — tenta os dois formatos na unha.
      try {
        return await doc.embedJpg(bytes);
      } catch {
        return await doc.embedPng(bytes);
      }
    }
  } catch {
    return null;
  }
}

type OccurrenceDetail = {
  occurrence: {
    id: string;
    placa: string | null;
    modelo: string | null;
    filialNome: string | null;
    km: number | null;
    createdAt: string | Date;
    status: "PENDENTE" | "EM_ANDAMENTO" | "RESOLVIDA";
    description: string;
    relato: string | null;
    resolvedAt: string | Date | null;
    resolutionNotes: string | null;
  };
  avariaItems: { id: string; label: string | null; notes: string | null }[];
  photos: { id: string; url: string }[];
  signatures: {
    role: "CONDUTOR" | "SUPERVISOR" | "GERENTE";
    userNameSnap: string;
    signatureImageUrl: string | null;
    signedAt: string | Date;
  }[];
};

export async function buildOccurrencePdf(
  data: OccurrenceDetail
): Promise<Uint8Array> {
  const { occurrence, avariaItems, photos, signatures } = data;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new PdfWriter(doc, font, bold);

  w.text("Relatório de Ocorrência", { size: 16, font: bold });
  w.space(2);
  w.text(
    `${occurrence.placa ?? "—"} · ${occurrence.modelo ?? "—"}${
      occurrence.filialNome ? ` · ${occurrence.filialNome}` : ""
    }`,
    { size: 11, color: MUTED }
  );
  w.text(
    `Data: ${new Date(occurrence.createdAt).toLocaleDateString("pt-BR")}` +
      (occurrence.km != null ? ` · ${formatKm(occurrence.km)}` : ""),
    { size: 10, color: MUTED }
  );

  const allSigned = SIGNATURE_ORDER.every((r) =>
    signatures.some((s) => s.role === r)
  );
  w.text(
    `Status: ${OCCURRENCE_STATUS_LABELS[occurrence.status]}${
      allSigned ? "" : " · ASSINATURAS PENDENTES"
    }`,
    { size: 10, font: bold, color: allSigned ? GREEN : RED }
  );

  if (occurrence.relato) {
    w.heading("Relato do ocorrido");
    w.text(occurrence.relato, { size: 10 });
  }

  w.heading("Itens com avaria");
  if (avariaItems.length === 0) {
    w.text("Nenhum item marcado com avaria.", { size: 10, color: MUTED });
  } else {
    for (const item of avariaItems) {
      w.text(
        `• ${item.label ?? "Item"}${item.notes ? ` — ${item.notes}` : ""}`,
        { size: 10 }
      );
    }
  }

  if (photos.length > 0) {
    w.heading("Evidências fotográficas");
    const embedded: { img: PDFImage }[] = [];
    for (const p of photos) {
      const img = await fetchAndEmbedImage(doc, p.url);
      if (img) embedded.push({ img });
    }
    if (embedded.length > 0) w.imageRow(embedded);
    else w.text("Não foi possível carregar as fotos.", { size: 9, color: MUTED });
  }

  w.heading("Resolução");
  if (occurrence.status === "RESOLVIDA") {
    w.text(
      `Resolvida em ${
        occurrence.resolvedAt
          ? new Date(occurrence.resolvedAt).toLocaleDateString("pt-BR")
          : "—"
      }.`,
      { size: 10, color: GREEN }
    );
    if (occurrence.resolutionNotes) {
      w.text(occurrence.resolutionNotes, { size: 10 });
    }
  } else {
    w.text("Ainda não resolvida / manutenção pendente.", {
      size: 10,
      color: RED,
    });
  }

  w.heading("Assinaturas");
  for (const role of SIGNATURE_ORDER) {
    const sig = signatures.find((s) => s.role === role);
    w.text(SIGNATURE_ROLE_LABELS[role], { size: 10, font: bold });
    if (sig) {
      w.text(
        `Assinado por ${sig.userNameSnap} em ${new Date(
          sig.signedAt
        ).toLocaleString("pt-BR")}`,
        { size: 9, color: GREEN }
      );
      if (sig.signatureImageUrl) {
        const img = await fetchAndEmbedImage(doc, sig.signatureImageUrl);
        if (img) w.imageRow([{ img }], 110);
      }
    } else {
      w.text("PENDENTE — sem assinatura registrada.", {
        size: 9,
        font: bold,
        color: RED,
      });
    }
    w.space(4);
  }

  if (!allSigned) {
    w.space(6);
    w.text(
      "Atenção: este documento ainda não tem as 3 assinaturas obrigatórias (condutor, supervisor e gerente). Sem o termo assinado por todos, o RH pode ser acionado para tratativa/desconto conforme a política interna.",
      { size: 9, font: bold, color: RED }
    );
  }

  return doc.save();
}
