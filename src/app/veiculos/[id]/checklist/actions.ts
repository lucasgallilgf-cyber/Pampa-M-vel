"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  vehicles,
  inspections,
  inspectionItems,
  occurrences,
  maintenanceRecords,
  photos,
  checklistItemDefs,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { storePhoto } from "@/lib/storage";
import { upsertVehicleRevision } from "@/lib/queries";
import { REVISION_INTERVAL_KM } from "@/lib/domain";

type ItemStatus = "OK" | "AVARIA" | "NAO_APLICAVEL";

export type ChecklistFormState = { error: string | null };

export async function submitChecklistAction(
  _prevState: ChecklistFormState,
  formData: FormData
): Promise<ChecklistFormState> {
  try {
    await submitChecklist(formData);
    return { error: null };
  } catch (err) {
    unstable_rethrow(err);
    return {
      error: err instanceof Error ? err.message : "Erro ao salvar checklist.",
    };
  }
}

async function submitChecklist(formData: FormData) {
  const session = await getSession();
  const allowedRoles = ["ADMIN", "SUPERVISOR", "CONDUTOR"];
  if (!session || !allowedRoles.includes(session.role)) {
    throw new Error("Não autorizado a realizar checklist.");
  }

  const vehicleId = formData.get("vehicleId")?.toString();
  const kmRaw = formData.get("km")?.toString();
  if (!vehicleId || !kmRaw) throw new Error("Dados incompletos.");
  const km = parseInt(kmRaw, 10);
  if (Number.isNaN(km) || km < 0) throw new Error("Quilometragem inválida.");

  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, vehicleId))
    .limit(1);
  if (!vehicle) throw new Error("Veículo não encontrado.");
  if (session.role === "CONDUTOR" && vehicle.assignedCondutorId !== session.id) {
    throw new Error("Este veículo não está designado a você.");
  }
  if (km < vehicle.kmAtual) {
    throw new Error(
      `A quilometragem informada (${km}) é menor que a atual registrada (${vehicle.kmAtual}).`
    );
  }

  const itemDefs = await db
    .select()
    .from(checklistItemDefs)
    .where(eq(checklistItemDefs.active, true));

  type Pending = {
    itemDefId: string;
    label: string;
    status: ItemStatus;
    notes: string | null;
    files: File[];
  };

  const pending: Pending[] = itemDefs.map((def) => {
    const status = (formData.get(`status_${def.id}`)?.toString() ??
      "OK") as ItemStatus;
    const notes = formData.get(`notes_${def.id}`)?.toString().trim() || null;
    const files = formData
      .getAll(`photos_${def.id}`)
      .filter((f): f is File => f instanceof File && f.size > 0);
    return { itemDefId: def.id, label: def.label, status, notes, files };
  });

  const avariaItems = pending.filter((p) => p.status === "AVARIA");
  const hasAvaria = avariaItems.length > 0;

  const relato = formData.get("relato")?.toString().trim() || null;
  if (hasAvaria && !relato) {
    throw new Error(
      "Descreva o que aconteceu no campo \"Relato do ocorrido\" antes de enviar o checklist."
    );
  }

  const [inspection] = await db
    .insert(inspections)
    .values({
      vehicleId,
      performedById: session.id,
      km,
      status: hasAvaria ? "COM_AVARIA" : "OK",
    })
    .returning();

  let occurrenceId: string | null = null;
  if (hasAvaria) {
    const description = `Avaria identificada durante conferência mensal: ${avariaItems
      .map((a) => (a.notes ? `${a.label} (${a.notes})` : a.label))
      .join("; ")}.`;

    const [occurrence] = await db
      .insert(occurrences)
      .values({ inspectionId: inspection.id, vehicleId, description, relato })
      .returning();
    occurrenceId = occurrence.id;

    await db.insert(maintenanceRecords).values({
      occurrenceId: occurrence.id,
      vehicleId,
      description,
    });
  }

  for (const p of pending) {
    const [item] = await db
      .insert(inspectionItems)
      .values({
        inspectionId: inspection.id,
        itemDefId: p.itemDefId,
        status: p.status,
        notes: p.notes,
      })
      .returning();

    for (const file of p.files) {
      const url = await storePhoto(file, `inspecoes/${inspection.id}`);
      await db.insert(photos).values({
        url,
        inspectionItemId: item.id,
        occurrenceId: p.status === "AVARIA" ? occurrenceId : null,
      });
    }
  }

  await db
    .update(vehicles)
    .set({ kmAtual: km })
    .where(eq(vehicles.id, vehicleId));

  const revisaoFeita = formData.get("revisaoFeita")?.toString() === "on";
  if (revisaoFeita) {
    const kmAlvoRaw = formData.get("revisaoKmAlvo")?.toString();
    const kmAlvo = kmAlvoRaw ? parseInt(kmAlvoRaw, 10) : NaN;
    if (!Number.isNaN(kmAlvo) && kmAlvo > 0 && kmAlvo % REVISION_INTERVAL_KM === 0) {
      const revisaoObservacao =
        formData.get("revisaoObservacao")?.toString().trim() || null;
      await upsertVehicleRevision({
        vehicleId,
        kmAlvo,
        status: "FEITO",
        dataRevisao: new Date(),
        kmRevisao: km,
        observacao: revisaoObservacao,
        updatedById: session.id,
      });
    }
  }

  if (occurrenceId) {
    redirect(`/ocorrencias/${occurrenceId}`);
  } else {
    redirect(`/veiculos/${vehicleId}?checklist=ok`);
  }
}
