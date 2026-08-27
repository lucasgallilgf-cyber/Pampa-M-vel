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
};

const CONFIRM_PHRASE = "LIMPAR DADOS";

/**
 * Wipes every filial, vehicle, user (except the admin running this), and
 * their checklist/occurrence/maintenance history — used once, before the
 * real fleet spreadsheet is imported, to clear out the example/test data
 * this app was set up with. checklistItemDefs (the fixed list of checklist
 * questions) is NOT touched — that's app configuration, not example data.
 *
 * Deletion order matters: child rows with no ON DELETE CASCADE to their
 * parent must go first, or Postgres rejects the delete with a foreign key
 * violation.
 *   maintenanceRecords -> occurrences (no cascade)
 *   occurrences -> inspections (no cascade) — deleting occurrences also
 *     cascades their signatures and photos automatically (schema-level
 *     onDelete: "cascade" on those two tables)
 *   inspections -> vehicles (no cascade) — deleting inspections also
 *     cascades inspectionItems, which cascades their photos
 *   vehicles -> filiais / users (no cascade)
 *   users -> filiais (no cascade), except the current admin's own row
 *   filiais last
 *
 * Runs in a single transaction: either everything above is gone, or (on
 * any error) nothing is.
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

  try {
    await db.transaction(async (tx) => {
      await tx.delete(maintenanceRecords);
      await tx.delete(occurrences);
      await tx.delete(inspections);
      await tx.delete(vehicles);
      await tx.delete(users).where(ne(users.id, session.id));
      await tx.delete(filiais);
    });

    revalidatePath("/filiais");
    revalidatePath("/veiculos");
    revalidatePath("/usuarios");
    revalidatePath("/manutencao");
    revalidatePath("/ocorrencias");
    revalidatePath("/");
  } catch {
    return { error: "Erro ao limpar os dados. Nada foi apagado." };
  }

  return { error: null, done: true };
}
