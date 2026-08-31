"use server";

import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { checklistItemDefs } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export type ChecklistItemFormState = { error: string | null };

/**
 * Adds a new item to the standard checklist — it starts showing up in
 * every checklist from now on (existing/past checklists are untouched,
 * since inspection_items snapshot each item by id at the time it was
 * filled in). Category is free text: reuse an existing one (via the
 * datalist in the form) or type a new one to start a new section.
 */
export async function createChecklistItemAction(
  _prevState: ChecklistItemFormState,
  formData: FormData
): Promise<ChecklistItemFormState> {
  await requireUser(["ADMIN"]);
  const label = formData.get("label")?.toString().trim();
  const category = formData.get("category")?.toString().trim();
  if (!label || !category) {
    return { error: "Preencha o nome do item e a categoria." };
  }

  try {
    const [{ maxOrder }] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${checklistItemDefs.order}), -1)::int` })
      .from(checklistItemDefs);

    await db.insert(checklistItemDefs).values({
      label,
      category,
      order: maxOrder + 1,
    });
    revalidatePath("/checklist-itens");
  } catch (err) {
    unstable_rethrow(err);
    return { error: "Erro ao criar item de checklist." };
  }
  return { error: null };
}

export type ToggleActiveState = { error: string | null };

/**
 * Deactivating an item just flips a flag — it stops appearing in new
 * checklists but every past inspection_item that already references it
 * (by id, not by name) keeps its history intact. This is why items are
 * never hard-deleted here: undoing a deactivation brings it right back.
 */
export async function toggleChecklistItemActiveAction(
  _prevState: ToggleActiveState,
  formData: FormData
): Promise<ToggleActiveState> {
  await requireUser(["ADMIN"]);
  const id = formData.get("id")?.toString();
  const nextActive = formData.get("nextActive")?.toString() === "true";
  if (!id) return { error: "Item inválido." };

  try {
    await db
      .update(checklistItemDefs)
      .set({ active: nextActive })
      .where(eq(checklistItemDefs.id, id));
    revalidatePath("/checklist-itens");
  } catch (err) {
    unstable_rethrow(err);
    return { error: "Erro ao atualizar item." };
  }
  return { error: null };
}
