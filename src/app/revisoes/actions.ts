"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { upsertVehicleRevision } from "@/lib/queries";

export type RevisionActionState = { error: string | null; ok?: boolean };

export async function upsertVehicleRevisionAction(
  _prevState: RevisionActionState,
  formData: FormData
): Promise<RevisionActionState> {
  const session = await requireUser(["ADMIN", "GERENTE", "SUPERVISOR"]);

  const vehicleId = formData.get("vehicleId")?.toString();
  const kmAlvoRaw = formData.get("kmAlvo")?.toString();
  const status = formData.get("status")?.toString() as
    | "PENDENTE"
    | "FEITO"
    | undefined;
  const dataRevisaoRaw = formData.get("dataRevisao")?.toString();
  const kmRevisaoRaw = formData.get("kmRevisao")?.toString();
  const observacao = formData.get("observacao")?.toString().trim() || null;

  if (!vehicleId || !kmAlvoRaw || !status) {
    return { error: "Dados incompletos." };
  }
  const kmAlvo = parseInt(kmAlvoRaw, 10);
  if (Number.isNaN(kmAlvo)) return { error: "Marco de revisão inválido." };

  let dataRevisao: Date | null = null;
  let kmRevisao: number | null = null;

  if (status === "FEITO") {
    dataRevisao = dataRevisaoRaw ? new Date(`${dataRevisaoRaw}T12:00:00`) : new Date();
    if (kmRevisaoRaw) {
      kmRevisao = parseInt(kmRevisaoRaw, 10);
      if (Number.isNaN(kmRevisao) || kmRevisao < 0) {
        return { error: "Quilometragem da revisão inválida." };
      }
    }
  }

  try {
    await upsertVehicleRevision({
      vehicleId,
      kmAlvo,
      status,
      dataRevisao,
      kmRevisao,
      observacao,
      updatedById: session.id,
    });
    revalidatePath("/revisoes");
  } catch {
    return { error: "Erro ao salvar revisão." };
  }

  return { error: null, ok: true };
}
