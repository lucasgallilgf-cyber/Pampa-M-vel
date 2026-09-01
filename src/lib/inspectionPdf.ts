import { PDFDocument, StandardFonts, type PDFImage } from "pdf-lib";
import { ITEM_STATUS_LABELS, formatKm } from "./domain";
import { PdfWriter, fetchAndEmbedImage, MUTED, RED, GREEN } from "./pdfWriter";

type InspectionDetail = {
  inspection: {
    id: string;
    km: number;
    status: "OK" | "COM_AVARIA";
    createdAt: string | Date;
    vehicleId: string;
    placa: string | null;
    modelo: string | null;
    filialNome: string | null;
    performedById: string;
    performedByNome: string | null;
    occurrenceId: string | null;
  };
  items: {
    id: string;
    status: "OK" | "AVARIA" | "NAO_APLICAVEL";
    notes: string | null;
    label: string | null;
    category: string | null;
    photos: { id: string; url: string }[];
  }[];
  signatures: {
    role: "CONDUTOR" | "SUPERVISOR" | "GERENTE";
    userNameSnap: string;
    signatureImageUrl: string | null;
    signedAt: string | Date;
  }[];
};

export async function buildInspectionPdf(
  data: InspectionDetail
): Promise<Uint8Array> {
  const { inspection, items, signatures } = data;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new PdfWriter(doc, font, bold);

  w.text("Relatório de Conferência (Checklist)", { size: 16, font: bold });
  w.space(2);
  w.text(
    `${inspection.placa ?? "—"} · ${inspection.modelo ?? "—"}${
      inspection.filialNome ? ` · ${inspection.filialNome}` : ""
    }`,
    { size: 11, color: MUTED }
  );
  w.text(
    `Data: ${new Date(inspection.createdAt).toLocaleDateString(
      "pt-BR"
    )} · ${formatKm(inspection.km)}`,
    { size: 10, color: MUTED }
  );
  w.text(`Condutor: ${inspection.performedByNome ?? "—"}`, {
    size: 10,
    color: MUTED,
  });

  const hasAvaria = inspection.status === "COM_AVARIA";
  w.text(`Status: ${hasAvaria ? "Avaria identificada" : "OK — sem avaria"}`, {
    size: 10,
    font: bold,
    color: hasAvaria ? RED : GREEN,
  });

  if (hasAvaria && inspection.occurrenceId) {
    w.space(2);
    w.text(
      "Esta conferência gerou uma ocorrência — o relato completo e as 3 assinaturas (condutor, supervisor e gerente) estão no PDF da ocorrência, não neste.",
      { size: 9, color: MUTED }
    );
  }

  const categories = Array.from(
    new Set(items.map((i) => i.category ?? "Outros"))
  );
  for (const category of categories) {
    w.heading(category);
    const catItems = items.filter((i) => (i.category ?? "Outros") === category);
    for (const item of catItems) {
      const statusLabel = ITEM_STATUS_LABELS[item.status];
      const color =
        item.status === "AVARIA"
          ? RED
          : item.status === "OK"
            ? GREEN
            : MUTED;
      w.text(
        `${item.label ?? "Item"} — ${statusLabel}${
          item.notes ? `: ${item.notes}` : ""
        }`,
        { size: 10, color }
      );
      if (item.photos.length > 0) {
        const embedded: { img: PDFImage }[] = [];
        for (const p of item.photos) {
          const img = await fetchAndEmbedImage(doc, p.url);
          if (img) embedded.push({ img });
        }
        if (embedded.length > 0) w.imageRow(embedded, 90);
      }
    }
  }

  // Assinatura de supervisor própria só existe pra conferência sem avaria —
  // as com avaria usam as 3 assinaturas do fluxo da Ocorrência (ver acima).
  if (!inspection.occurrenceId) {
    w.heading("Assinatura do supervisor");
    const sig = signatures.find((s) => s.role === "SUPERVISOR");
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
      w.text("PENDENTE — sem assinatura do supervisor registrada.", {
        size: 9,
        font: bold,
        color: RED,
      });
    }
  }

  return doc.save();
}
