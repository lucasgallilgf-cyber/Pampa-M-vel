import { PDFDocument, StandardFonts, type PDFImage } from "pdf-lib";
import {
  OCCURRENCE_STATUS_LABELS,
  SIGNATURE_ORDER,
  SIGNATURE_ROLE_LABELS,
  formatKm,
} from "./domain";
import { PdfWriter, fetchAndEmbedImage, MUTED, RED, GREEN } from "./pdfWriter";

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
    performedByNome: string | null;
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
  w.text(`Condutor: ${occurrence.performedByNome ?? "—"}`, {
    size: 10,
    color: MUTED,
  });

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
