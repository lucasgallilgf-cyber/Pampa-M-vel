import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, vehicles, inspections, signatures } from "@/db/schema";
import { eq, ilike, inArray } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One-time cleanup for the now-reverted "auto-create condutor user on
 * import" feature (commit 1bbe57b), which briefly ran in production and
 * could have created placeholder logins like joao.silva@pendente.frota.
 *
 * For every such placeholder user still linked to a vehicle via
 * assignedCondutorId, the driver's name is preserved by copying it into
 * the vehicle's plain-text condutorNome field before the login link is
 * cleared — no vehicle loses its "who drives this" info. The placeholder
 * user is then deleted, unless it has real history attached (an
 * inspection or signature), in which case it's left alone and reported
 * instead of risking a failed delete or lost history.
 *
 * Usage: POST /api/cleanup-condutores-pendentes  with header
 * x-setup-secret: <SETUP_SECRET>
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SETUP_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "SETUP_SECRET não configurado no ambiente." },
      { status: 500 }
    );
  }
  const provided = req.headers.get("x-setup-secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const pendentes = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(ilike(users.email, "%@pendente.frota"));

  if (pendentes.length === 0) {
    return NextResponse.json({
      ok: true,
      encontrados: 0,
      veiculosAtualizados: 0,
      removidos: 0,
      pulados: [],
    });
  }

  const pendenteIds = pendentes.map((u) => u.id);
  const nameById = new Map(pendentes.map((u) => [u.id, u.name]));

  const linkedVehicles = await db
    .select({
      id: vehicles.id,
      assignedCondutorId: vehicles.assignedCondutorId,
      condutorNome: vehicles.condutorNome,
    })
    .from(vehicles)
    .where(inArray(vehicles.assignedCondutorId, pendenteIds));

  let veiculosAtualizados = 0;
  for (const v of linkedVehicles) {
    const nome = nameById.get(v.assignedCondutorId!) ?? null;
    await db
      .update(vehicles)
      .set({
        assignedCondutorId: null,
        condutorNome: v.condutorNome || nome,
      })
      .where(eq(vehicles.id, v.id));
    veiculosAtualizados++;
  }

  // These placeholder accounts never had usable credentials, so they
  // shouldn't have any inspection/signature history — but check instead of
  // assuming, so a delete never fails or silently drops real history.
  const [withInspections, withSignatures] = await Promise.all([
    db
      .select({ userId: inspections.performedById })
      .from(inspections)
      .where(inArray(inspections.performedById, pendenteIds)),
    db
      .select({ userId: signatures.userId })
      .from(signatures)
      .where(inArray(signatures.userId, pendenteIds)),
  ]);
  const blockedIds = new Set([
    ...withInspections.map((r) => r.userId),
    ...withSignatures.map((r) => r.userId),
  ]);

  const toDelete = pendenteIds.filter((id) => !blockedIds.has(id));
  const pulados = pendentes
    .filter((u) => blockedIds.has(u.id))
    .map((u) => ({ id: u.id, name: u.name, email: u.email }));

  let removidos = 0;
  if (toDelete.length > 0) {
    await db.delete(users).where(inArray(users.id, toDelete));
    removidos = toDelete.length;
  }

  return NextResponse.json({
    ok: true,
    encontrados: pendentes.length,
    veiculosAtualizados,
    removidos,
    pulados,
  });
}
