"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { setUserFiliaisAdicionais } from "@/lib/queries";

export type UserFormState = { error: string | null };

const ROLES = ["ADMIN", "GERENTE", "SUPERVISOR", "CONDUTOR"] as const;

export async function createUserAction(
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  await requireUser(["ADMIN"]);

  const name = formData.get("name")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();
  const role = formData.get("role")?.toString();
  const filialId = formData.get("filialId")?.toString() || null;

  if (!name || !email || !password || !role) {
    return { error: "Preencha nome, e-mail, senha e perfil." };
  }
  if (password.length < 6) {
    return { error: "A senha precisa ter pelo menos 6 caracteres." };
  }
  if (!ROLES.includes(role as (typeof ROLES)[number])) {
    return { error: "Perfil inválido." };
  }

  const filiaisAdicionais = formData.getAll("filiaisAdicionais").map((v) => v.toString());

  try {
    const [created] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash: hashSync(password, 10),
        role: role as (typeof ROLES)[number],
        filialId,
      })
      .returning({ id: users.id });
    await setUserFiliaisAdicionais(created.id, filiaisAdicionais);
    revalidatePath("/usuarios");
  } catch (err) {
    unstable_rethrow(err);
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique/i.test(msg)) {
      return { error: `Já existe um usuário com o e-mail "${email}".` };
    }
    return { error: "Erro ao criar usuário." };
  }
  redirect("/usuarios");
}

export async function updateUserAction(
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  await requireUser(["ADMIN"]);

  const id = formData.get("id")?.toString();
  const name = formData.get("name")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();
  const role = formData.get("role")?.toString();
  const filialId = formData.get("filialId")?.toString() || null;
  const active = formData.get("active") === "on";

  if (!id || !name || !email || !role) {
    return { error: "Preencha nome, e-mail e perfil." };
  }
  if (!ROLES.includes(role as (typeof ROLES)[number])) {
    return { error: "Perfil inválido." };
  }
  if (password && password.length < 6) {
    return { error: "A senha precisa ter pelo menos 6 caracteres." };
  }

  const filiaisAdicionais = formData.getAll("filiaisAdicionais").map((v) => v.toString());

  try {
    await db
      .update(users)
      .set({
        name,
        email,
        role: role as (typeof ROLES)[number],
        filialId,
        active,
        ...(password ? { passwordHash: hashSync(password, 10) } : {}),
      })
      .where(eq(users.id, id));
    await setUserFiliaisAdicionais(id, filiaisAdicionais);
    revalidatePath("/usuarios");
  } catch (err) {
    unstable_rethrow(err);
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique/i.test(msg)) {
      return { error: `Já existe um usuário com o e-mail "${email}".` };
    }
    return { error: "Erro ao salvar usuário." };
  }
  redirect("/usuarios");
}
