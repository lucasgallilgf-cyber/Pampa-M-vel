"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { vehicles, inspections, occurrences } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export type VehicleFormState = { error: string | null };

function parseVehicleForm(formData: FormData) {
  const placa = formData.get("placa")?.toString().trim().toUpperCase();
  const marca = formData.get("marca")?.toString().trim();
  const modelo = formData.get("modelo")?.toString().trim();
  const anoRaw = formData.get("anoFabricacao")?.toString();
  const filialId = formData.get("filialId")?.toString();
  const kmRaw = formData.get("kmAtual")?.toString();
  const assignedCondutorId = formData.get("assignedCondutorId")?.toString() || null;

  return {
    placa,
    marca,
    modelo,
    anoFabricacao: anoRaw ? parseInt(anoRaw, 10) : null,
    filialId,
    kmAtual: kmRaw ? parseInt(kmRaw, 10) : 0,
    assignedCondutorId,
  };
}

export async function createVehicleAction(
  _prevState: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  await requireUser(["ADMIN"]);
  const parsed = parseVehicleForm(formData);

  if (!parsed.placa || !parsed.marca || !parsed.modelo || !parsed.filialId) {
    return { error: "Preencha placa, marca, modelo e filial." };
  }
  if (Number.isNaN(parsed.kmAtual) || parsed.kmAtual < 0) {
    return { error: "Quilometragem inválida." };
  }
  const data = {
    placa: parsed.placa,
    marca: parsed.marca,
    modelo: parsed.modelo,
    anoFabricacao: parsed.anoFabricacao,
    filialId: parsed.filialId,
    kmAtual: parsed.kmAtual,
    assignedCondutorId: parsed.assignedCondutorId,
  };

  let vehicleId: string;
  try {
    const [row] = await db.insert(vehicles).values(data).returning();
    vehicleId = row.id;
    revalidatePath("/veiculos");
  } catch (err) {
    unstable_rethrow(err);
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique/i.test(msg)) {
      return { error: `Já existe um veículo com a placa "${data.placa}".` };
    }
    return { error: "Erro ao criar veículo." };
  }
  redirect(`/veiculos/${vehicleId}`);
}

export async function updateVehicleAction(
  _prevState: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  await requireUser(["ADMIN"]);
  const id = formData.get("id")?.toString();
  const active = formData.get("active") === "on";
  const parsed = parseVehicleForm(formData);

  if (!id || !parsed.placa || !parsed.marca || !parsed.modelo || !parsed.filialId) {
    return { error: "Preencha placa, marca, modelo e filial." };
  }
  if (Number.isNaN(parsed.kmAtual) || parsed.kmAtual < 0) {
    return { error: "Quilometragem inválida." };
  }
  const data = {
    placa: parsed.placa,
    marca: parsed.marca,
    modelo: parsed.modelo,
    anoFabricacao: parsed.anoFabricacao,
    filialId: parsed.filialId,
    kmAtual: parsed.kmAtual,
    assignedCondutorId: parsed.assignedCondutorId,
  };

  try {
    await db
      .update(vehicles)
      .set({ ...data, active })
      .where(eq(vehicles.id, id));
    revalidatePath("/veiculos");
    revalidatePath(`/veiculos/${id}`);
  } catch (err) {
    unstable_rethrow(err);
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique/i.test(msg)) {
      return { error: `Já existe um veículo com a placa "${data.placa}".` };
    }
    return { error: "Erro ao salvar veículo." };
  }
  redirect(`/veiculos/${id}`);
}

export type DeleteVehicleState = { error: string | null };

/**
 * Vehicles with any checklist/occurrence history are never hard-deleted —
 * the FK from inspections/occurrences to vehicles has no cascade, and more
 * importantly the user explicitly wants that history preserved. Those
 * vehicles must be deactivated instead (see the "Veículo ativo na frota"
 * checkbox in updateVehicleAction above). Only a vehicle with zero history
 * can be removed outright.
 */
export async function deleteVehicleAction(
  _prevState: DeleteVehicleState,
  formData: FormData
): Promise<DeleteVehicleState> {
  await requireUser(["ADMIN"]);
  const id = formData.get("id")?.toString();
  if (!id) return { error: "Veículo inválido." };

  const [{ count: inspCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inspections)
    .where(eq(inspections.vehicleId, id));
  const [{ count: occCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(occurrences)
    .where(eq(occurrences.vehicleId, id));

  if (inspCount > 0 || occCount > 0) {
    return {
      error:
        'Este veículo já tem checklist(s) ou ocorrência(s) registrados — não é possível excluir. Edite o veículo e desmarque "Veículo ativo na frota" para retirá-lo de uso sem perder o histórico.',
    };
  }

  try {
    await db.delete(vehicles).where(eq(vehicles.id, id));
    revalidatePath("/veiculos");
  } catch (err) {
    unstable_rethrow(err);
    return { error: "Erro ao excluir veículo." };
  }
  return { error: null };
}
