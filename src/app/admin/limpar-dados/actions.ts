"use server";

import { revalidatePath } from "next/cache";
import { ne } from "drizzle-orm";
import { db } from "@/db";
import {
  filiais,
  vehicles,
  users,
  inspections,
  occurrences,
  maintenanceRecords,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";

export type ClearDataState = {
  error: string | null;
  done?: boolean;
  cleared?: string[];
};

const CONFIRM_PHRASE = "LIMPAR DADOS";

/**
 * Selective wipe of example/test data, used once before importing the real
 * fleet spreadsheet. Each checkbox on the form is one of these categories;
 * the admin picks which to erase. The current admin's own user row is never
 * touched, and checklistItemDefs (the fixed checklist questionnaire) is app
 * configuration, never example data — it's never touched either.
 *
 * The categories aren't independent in the database: a row can't be deleted
 * while something still points at it with no ON DELETE CASCADE. Rather than
 * rejecting a combination that would hit a foreign-key error, we silently
 * widen the selection to whatever it structurally requires, and report back
 * exactly what ended up erased so the admin isn't surprised:
 *   - Filiais requires Veículos and Usuários to go too (both reference
 *     filialId with no cascade).
 *   - Veículos requires Checklists to go too (inspections.vehicleId, no
 *     cascade).
 *   - Usuários requires Checklists to go too (inspections.performedById, no
 *     cascade) — since every remaining user but the admin is being removed,
 *     any inspection performed by one of them would otherwise block it.
 *   - Checklists requires Ocorrências to go too (occurrences.inspectionId,
 *     no cascade).
 * Deleting Ocorrências also cascades their signatures and photos
 * automatically (schema-level onDelete: "cascade"); deleting Checklists
 * cascades inspectionItems, which cascades their photos too.
 *
 * Runs in a single transaction: either everything computed above is gone,
 * or (on any error) nothing is.
 *
 * Note: this does not delete the actual photo/signature files sitting in
 * Vercel Blob storage — only the database rows that reference them. Those
 * become orphaned files; harmless, but worth knowing.
 */
export async function clearExampleDataAction(
  _prevState: ClearDataState,
  formData: FormData
): Promise<ClearDataState> {
  const session = await requireUser(["ADMIN"]);
  const confirmText = formData.get("confirmText")?.toString().trim();

  if (confirmText !== CONFIRM_PHRASE) {
    return {
      error: `Digite exatamente "${CONFIRM_PHRASE}" para confirmar.`,
    };
  }

  let filiaisSel = formData.get("filiais") === "on";
  let veiculosSel = formData.get("veiculos") === "on";
  let usuariosSel = formData.get("usuarios") === "on";
  let checklistsSel = formData.get("checklists") === "on";
  let ocorrenciasSel = formData.get("ocorrencias") === "on";

  if (
    !filiaisSel &&
    !veiculosSel &&
    !usuariosSel &&
    !checklistsSel &&
    !ocorrenciasSel
  ) {
    return { error: "Selecione ao menos uma categoria para apagar." };
  }

  // Widen the selection to whatever the foreign keys require.
  if (filiaisSel) {
    veiculosSel = true;
    usuariosSel = true;
  }
  if (veiculosSel || usuariosSel) {
    checklistsSel = true;
  }
  if (checklistsSel) {
    ocorrenciasSel = true;
  }

  const cleared: string[] = [];

  try {
    await db.transaction(async (tx) => {
      // Order matters: children without ON DELETE CASCADE go before parents.
      if (ocorrenciasSel) {
        await tx.delete(maintenanceRecords);
        await tx.delete(occurrences);
      }
      if (checklistsSel) {
        await tx.delete(inspections);
      }
      if (veiculosSel) {
        await tx.delete(vehicles);
      }
      if (usuariosSel) {
        await tx.delete(users).where(ne(users.id, session.id));
      }
      if (filiaisSel) {
        await tx.delete(filiais);
      }
    });

    if (filiaisSel) cleared.push("filiais");
    if (veiculosSel) cleared.push("veículos");
    if (usuariosSel) cleared.push("usuários");
    if (checklistsSel) cleared.push("checklists");
    if (ocorrenciasSel) cleared.push("ocorrências/avarias");

    revalidatePath("/filiais");
    revalidatePath("/veiculos");
    revalidatePath("/usuarios");
    revalidatePath("/manutencao");
    revalidatePath("/ocorrencias");
    revalidatePath("/");
  } catch {
    return { error: "Erro ao limpar os dados. Nada foi apagado." };
  }

  return { error: null, done: true, cleared };
}
