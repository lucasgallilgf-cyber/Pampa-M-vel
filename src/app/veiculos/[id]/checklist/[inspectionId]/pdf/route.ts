import { NextResponse } from "next/server";
import {
  requireUser,
  getAllowedFilialIds,
  canAccessFilial,
} from "@/lib/auth";
import { getInspectionDetail } from "@/lib/queries";
import { buildInspectionPdf } from "@/lib/inspectionPdf";

const OVERSIGHT_ROLES = ["ADMIN", "GERENTE", "SUPERVISOR"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; inspectionId: string }> }
) {
  const session = await requireUser();
  const { inspectionId } = await params;

  const data = await getInspectionDetail(inspectionId);
  if (!data) {
    return new NextResponse("Conferência não encontrada.", { status: 404 });
  }

  const allowedFilialIds = await getAllowedFilialIds(session);
  const isOversight =
    OVERSIGHT_ROLES.includes(session.role) &&
    canAccessFilial(allowedFilialIds, data.inspection.filialId);
  const isOwner = data.inspection.performedById === session.id;
  if (!isOversight && !isOwner) {
    return new NextResponse("Não autorizado.", { status: 403 });
  }

  const pdfBytes = await buildInspectionPdf(data);
  const filename = `checklist-${data.inspection.placa ?? inspectionId}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
