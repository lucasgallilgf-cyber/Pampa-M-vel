"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { signatureLinks, users } from "@/db/schema";
import { storePhoto } from "@/lib/storage";
import { recordOccurrenceSignature } from "@/lib/queries";

export type LinkActionState = { error: string | null; ok?: boolean };

/**
 * Confirma uma assinatura feita através do link público (sem login) — ver
 * SignatureLinkPanel/createSignatureLinkAction em /ocorrencias/[id]. Só o
 * token (imprevisível, 32 bytes) protege esta ação; por isso ele é
 * verificado aqui de novo (não confia em nada validado na página).
 */
export async function signViaLinkAction(
  formData: FormData
): Promise<LinkActionState> {
  const token = formData.get("token")?.toString();
  const signatureImage = formData.get("signatureImage");

  if (!token) return { error: "Link inválido." };
  if (!(signatureImage instanceof File) || signatureImage.size === 0) {
    return { error: "Desenhe a assinatura antes de confirmar." };
  }

  const [link] = await db
    .select()
    .from(signatureLinks)
    .where(eq(signatureLinks.token, token))
    .limit(1);
  if (!link) return { error: "Link inválido." };
  if (link.usedAt) return { error: "Este link já foi usado." };
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return { error: "Este link expirou. Peça para gerar um novo." };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, link.userId))
    .limit(1);
  if (!user) return { error: "Usuário do link não encontrado." };

  const signatureImageUrl = await storePhoto(
    signatureImage,
    `assinaturas/${link.occurrenceId}`
  );

  const result = await recordOccurrenceSignature({
    occurrenceId: link.occurrenceId,
    role: link.role,
    userId: user.id,
    userNameSnap: user.name,
    signatureImageUrl,
  });
  if (result.error) return result;

  await db
    .update(signatureLinks)
    .set({ usedAt: new Date() })
    .where(eq(signatureLinks.id, link.id));

  revalidatePath(`/ocorrencias/${link.occurrenceId}`);
  return { error: null, ok: true };
}
