"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { filiais } from "@/db/schema";
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
