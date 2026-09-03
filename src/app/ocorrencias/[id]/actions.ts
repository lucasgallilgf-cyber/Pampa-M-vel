"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { occurrences, maintenanceRecords } from "@/db/schema";
import { getSession, requireUser } from "@/lib/auth";
import { storePhoto } from "@/lib/storage";
import {
  recordOccurrenceSignature,
  createOrRefreshSignatureLink,
  reopenOccurrence,
} from "@/lib/queries";

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

  const signatureImageUrl = await storePhoto(
    signatureImage,
    `assinaturas/${occurrenceId}`
  );

  const result = await recordOccurrenceSignature({
    occurrenceId,
    role,
    userId: session.id,
    userNameSnap: session.name,
    signatureImageUrl,
  });
  if (result.error) return result;

  revalidatePath(`/ocorrencias/${occurrenceId}`);
  return { error: null, ok: true };
}

/**
 * Gera (ou renova) o link de assinatura sem login pra uma etapa —
 * pra mandar por WhatsApp. Só Admin/Supervisor/Gerente podem gerar.
 */
export async function createSignatureLinkAction(params: {
  occurrenceId: string;
  role: "CONDUTOR" | "SUPERVISOR" | "GERENTE";
  userId: string;
}): Promise<{ error: string | null; token?: string }> {
  const session = await requireUser(["ADMIN", "SUPERVISOR", "GERENTE"]);
  const { occurrenceId, role, userId } = params;
  if (!occurrenceId || !role || !userId) {
    return { error: "Dados incompletos." };
  }
  const token = await createOrRefreshSignatureLink({
    occurrenceId,
    role,
    userId,
    createdById: session.id,
  });
  revalidatePath(`/ocorrencias/${occurrenceId}`);
  return { error: null, token };
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

export async function reopenOccurrenceAction(
  occurrenceId: string
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Sessão expirada." };
  if (!["ADMIN", "SUPERVISOR", "GERENTE"].includes(session.role)) {
    return { error: "Sem permissão para reabrir ocorrências." };
  }

  await reopenOccurrence(occurrenceId);

  revalidatePath(`/ocorrencias/${occurrenceId}`);
  revalidatePath("/manutencao");
  return { error: null, ok: true };
}
