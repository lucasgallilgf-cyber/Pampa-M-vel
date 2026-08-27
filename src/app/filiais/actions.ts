"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { filiais, vehicles, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export type FilialFormState = { error: string | null };

export async function createFilialAction(
  _prevState: FilialFormState,
  formData: FormData
): Promise<FilialFormState> {
  await requireUser(["ADMIN"]);
  const nome = formData.get("nome")?.toString().trim();
  const codigo = formData.get("codigo")?.toString().trim().toUpperCase();
  if (!nome || !codigo) {
    return { error: "Preencha nome e código da filial." };
  }

  try {
    await db.insert(filiais).values({ nome, codigo });
    revalidatePath("/filiais");
  } catch (err) {
    unstable_rethrow(err);
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique/i.test(msg)) {
      return { error: `Já existe uma filial com o código "${codigo}".` };
    }
    return { error: "Erro ao criar filial." };
  }
  redirect("/filiais");
}

export type DeleteFilialState = { error: string | null };

/**
 * Simple block-if-linked rule: a filial with any vehicle or user still
 * pointing at it cannot be deleted — reassign those records to another
 * filial first (via their own edit forms), then delete. A filial with
 * nothing linked (0 veículos, 0 usuários) is removed directly.
 */
export async function deleteFilialAction(
  _prevState: DeleteFilialState,
  formData: FormData
): Promise<DeleteFilialState> {
  await requireUser(["ADMIN"]);
  const id = formData.get("id")?.toString();
  if (!id) return { error: "Filial inválida." };

  const [vCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vehicles)
    .where(eq(vehicles.filialId, id));
  const [uCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.filialId, id));

  if (vCount.count > 0 || uCount.count > 0) {
    return {
      error:
        "Esta filial tem veículos ou usuários vinculados — mova-os para outra filial (editando cada um) antes de excluir.",
    };
  }

  try {
    await db.delete(filiais).where(eq(filiais.id, id));
    revalidatePath("/filiais");
  } catch (err) {
    unstable_rethrow(err);
    return { error: "Erro ao excluir filial." };
  }
  return { error: null };
}
