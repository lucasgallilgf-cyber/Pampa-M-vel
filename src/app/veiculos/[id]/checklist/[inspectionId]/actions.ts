"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { inspections } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { deleteInspection } from "@/lib/queries";

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
