"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { occurrences, signatures, maintenanceRecords } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { SIGNATURE_ORDER } from "@/lib/domain";
import { storePhoto } from "@/lib/storage";

export type ActionState = { error: string | null; ok?: boolean };

export async function signOccurrenceAction(
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Sessão expirada." };

  const occurrenceId = formData.get("occurrenceId")?.toString();
  const role = formData.get("role")?.toString() as
    | "CONDUTOR"
    | "SUPERVISOR"
    | "GERENTE"
    | undefined;
  const signatureImage = formData.get("signatureImage");

  if (!occurrenceId || !role) {
    return { error: "Dados incompletos." };
  }
  if (!(signatureImage instanceof File) || signatureImage.size === 0) {
    return { error: "Desenhe a assinatura no quadro antes de confirmar." };
  }

  if (session.role !== "ADMIN" && session.role !== role) {
    return {
      error: `Apenas o perfil "${role}" pode registrar esta assinatura.`,
    };
  }

  const existing = await db
    .select()
    .from(signatures)
    .where(eq(signatures.occurrenceId, occurrenceId));

  const stepIndex = SIGNATURE_ORDER.indexOf(role);
  for (let i = 0; i < stepIndex; i++) {
    const requiredRole = SIGNATURE_ORDER[i];
    if (!existing.some((s) => s.role === requiredRole)) {
      return {
        error: `A assinatura de "${requiredRole}" precisa ocorrer primeiro.`,
      };
    }
  }
  if (existing.some((s) => s.role === role)) {
    return { error: "Esta etapa já foi assinada." };
  }

  const signatureImageUrl = await storePhoto(
    signatureImage,
    `assinaturas/${occurrenceId}`
  );

  await db.insert(signatures).values({
    occurrenceId,
    role,
    userId: session.id,
    userNameSnap: session.name,
    signatureImageUrl,
  });

  const totalSigned = existing.length + 1;
  if (totalSigned === SIGNATURE_ORDER.length) {
    await db
      .update(occurrences)
      .set({ status: "EM_ANDAMENTO" })
      .where(
        and(eq(occurrences.id, occurrenceId), eq(occurrences.status, "PENDENTE"))
      );
  }

  revalidatePath(`/ocorrencias/${occurrenceId}`);
  return { error: null, ok: true };
}

export async function resolveOccurrenceAction(
  occurrenceId: string,
  notes: string
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Sessão expirada." };
  if (!["ADMIN", "SUPERVISOR", "GERENTE"].includes(session.role)) {
    return { error: "Sem permissão para resolver ocorrências." };
  }

  const resolvedAt = new Date();
  await db
    .update(occurrences)
    .set({ status: "RESOLVIDA", resolvedAt, resolutionNotes: notes || null })
    .where(eq(occurrences.id, occurrenceId));

  await db
    .update(maintenanceRecords)
    .set({ status: "RESOLVIDA", resolvedAt, notes: notes || null })
    .where(eq(maintenanceRecords.occurrenceId, occurrenceId));

  revalidatePath(`/ocorrencias/${occurrenceId}`);
  revalidatePath("/manutencao");
  return { error: null, ok: true };
}
