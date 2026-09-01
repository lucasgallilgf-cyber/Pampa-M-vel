"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { inspections, occurrences, signatures } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { deleteInspection } from "@/lib/queries";
import { storePhoto } from "@/lib/storage";

export type DeleteInspectionState = { error: string | null };

export async function deleteInspectionAction(
  _prevState: DeleteInspectionState,
  formData: FormData
): Promise<DeleteInspectionState> {
  try {
    const session = await getSession();
    if (!session) redirect("/login");

    const inspectionId = formData.get("id")?.toString();
    if (!inspectionId) return { error: "Conferência inválida." };

    const [inspection] = await db
      .select({ performedById: inspections.performedById })
      .from(inspections)
      .where(eq(inspections.id, inspectionId))
      .limit(1);
    if (!inspection) return { error: "Conferência não encontrada." };

    const isAdmin = session.role === "ADMIN";
    if (!isAdmin && inspection.performedById !== session.id) {
      return {
        error: "Você só pode excluir conferências feitas por você mesmo.",
      };
    }

    const deleted = await deleteInspection(inspectionId);
    if (!deleted) return { error: "Conferência não encontrada." };

    redirect(session.role === "CONDUTOR" ? "/meu-veiculo" : `/veiculos/${deleted.vehicleId}`);
  } catch (err) {
    unstable_rethrow(err);
    return {
      error: err instanceof Error ? err.message : "Erro ao excluir conferência.",
    };
  }
}

export type SignInspectionState = { error: string | null; ok?: boolean };

/**
 * Assinatura de supervisor para uma conferência SEM avaria — quando há
 * avaria, a assinatura acontece no fluxo já existente da Ocorrência
 * (condutor + supervisor + gerente, em ordem). Aqui é só uma etapa única:
 * um SUPERVISOR (ou ADMIN) confirma que revisou o checklist.
 */
export async function signInspectionAction(
  formData: FormData
): Promise<SignInspectionState> {
  const session = await getSession();
  if (!session) return { error: "Sessão expirada." };
  if (session.role !== "ADMIN" && session.role !== "SUPERVISOR") {
    return {
      error: "Apenas um supervisor (ou admin) pode assinar esta conferência.",
    };
  }

  const inspectionId = formData.get("inspectionId")?.toString();
  const signatureImage = formData.get("signatureImage");
  if (!inspectionId) return { error: "Dados incompletos." };
  if (!(signatureImage instanceof File) || signatureImage.size === 0) {
    return { error: "Desenhe a assinatura no quadro antes de confirmar." };
  }

  const [inspection] = await db
    .select({ vehicleId: inspections.vehicleId })
    .from(inspections)
    .where(eq(inspections.id, inspectionId))
    .limit(1);
  if (!inspection) return { error: "Conferência não encontrada." };

  const [occurrence] = await db
    .select({ id: occurrences.id })
    .from(occurrences)
    .where(eq(occurrences.inspectionId, inspectionId))
    .limit(1);
  if (occurrence) {
    return {
      error:
        "Esta conferência tem avaria — a assinatura é feita na página da ocorrência.",
    };
  }

  const existing = await db
    .select()
    .from(signatures)
    .where(
      and(
        eq(signatures.inspectionId, inspectionId),
        eq(signatures.role, "SUPERVISOR")
      )
    );
  if (existing.length > 0) {
    return { error: "Esta conferência já foi assinada." };
  }

  const signatureImageUrl = await storePhoto(
    signatureImage,
    `assinaturas/checklist-${inspectionId}`
  );

  await db.insert(signatures).values({
    inspectionId,
    role: "SUPERVISOR",
    userId: session.id,
    userNameSnap: session.name,
    signatureImageUrl,
  });

  revalidatePath(`/veiculos/${inspection.vehicleId}/checklist/${inspectionId}`);
  return { error: null, ok: true };
}
