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
 * A filial with vehicles or users linked to it is never deleted out from
 * under them — the caller must supply destinoFilialId, and every vehicle
 * and user pointing at the filial being deleted is moved there first, in
 * the same transaction as the delete. A filial with nothing linked (0
 * veículos, 0 usuários) is removed directly, no destino needed.
 */
export async function deleteFilialAction(
  _prevState: DeleteFilialState,
  formData: FormData
): Promise<DeleteFilialState> {
  await requireUser(["ADMIN"]);
  const id = formData.get("id")?.toString();
  const destinoFilialId = formData.get("destinoFilialId")?.toString() || null;
  if (!id) return { error: "Filial inválida." };
  if (destinoFilialId && destinoFilialId === id) {
    return { error: "Escolha uma filial diferente para mover os vínculos." };
  }

  try {
    await db.transaction(async (tx) => {
      const [vCount] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(vehicles)
        .where(eq(vehicles.filialId, id));
      const [uCount] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.filialId, id));
      const hasLinks = vCount.count > 0 || uCount.count > 0;

      if (hasLinks) {
        if (!destinoFilialId) {
          throw new Error("MOVE_REQUIRED");
        }
        await tx
          .update(vehicles)
          .set({ filialId: destinoFilialId })
          .where(eq(vehicles.filialId, id));
        await tx
          .update(users)
          .set({ filialId: destinoFilialId })
          .where(eq(users.filialId, id));
      }

      await tx.delete(filiais).where(eq(filiais.id, id));
    });
    revalidatePath("/filiais");
    revalidatePath("/veiculos");
    revalidatePath("/usuarios");
  } catch (err) {
    unstable_rethrow(err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "MOVE_REQUIRED") {
      return {
        error:
          "Esta filial tem veículos ou usuários vinculados — escolha para qual filial mover antes de excluir.",
      };
    }
    return { error: "Erro ao excluir filial." };
  }
  return { error: null };
}
