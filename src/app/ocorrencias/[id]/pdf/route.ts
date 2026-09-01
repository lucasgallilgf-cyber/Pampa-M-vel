import { NextResponse } from "next/server";
import { requireUser, canAccessFilial } from "@/lib/auth";
import { getOccurrenceDetail } from "@/lib/queries";
import { buildOccurrencePdf } from "@/lib/occurrencePdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireUser();
  const { id } = await params;

  const data = await getOccurrenceDetail(id);
  if (!data) {
    return new NextResponse("Ocorrência não encontrada.", { status: 404 });
  }
  if (!canAccessFilial(session, data.occurrence.filialId)) {
    return new NextResponse("Ocorrência não encontrada.", { status: 404 });
  }

  const pdfBytes = await buildOccurrencePdf(data);
  const filename = `ocorrencia-${data.occurrence.placa ?? id}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
