import { db } from "@/db";
import {
  vehicles,
  filiais,
  inspections,
  inspectionItems,
  checklistItemDefs,
  occurrences,
  users,
  signatures,
  signatureLinks,
  maintenanceRecords,
  photos,
  userFiliais,
  vehicleTransfers,
  vehicleRevisions,
} from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { eq, and, gte, lt, sql, desc, or, ilike, ne, inArray } from "drizzle-orm";
import { currentMonthRange, SIGNATURE_ORDER, SIGNATURE_ROLE_LABELS } from "./domain";
import { createToken } from "./id";

export async function listVehicles(
  opts: {
    filialId?: string;
    q?: string;
    modelo?: string;
    centroCusto?: string;
    status?: "conferido" | "pendente";
    avarias?: "com" | "sem";
  } = {}
) {
  const { start, end } = currentMonthRange();
  const { filialId, q, modelo, centroCusto, status, avarias } = opts;

  const conferidoExpr = sql<boolean>`bool_or(${inspections.createdAt} >= ${start.toISOString()}::timestamptz and ${inspections.createdAt} < ${end.toISOString()}::timestamptz)`;
  const avariasAbertasExpr = sql<number>`count(distinct case when ${occurrences.status} != 'RESOLVIDA' then ${occurrences.id} end)::int`;

  const rows = await db
    .select({
      id: vehicles.id,
      placa: vehicles.placa,
      modelo: vehicles.modelo,
      marca: vehicles.marca,
      kmAtual: vehicles.kmAtual,
      centroCusto: vehicles.centroCusto,
      filialNome: filiais.nome,
      filialId: vehicles.filialId,
      condutorNome: vehicles.condutorNome,
      lastInspectionAt: sql<string | null>`max(${inspections.createdAt})`,
      conferidoEsteMes: conferidoExpr,
      avariasAbertas: avariasAbertasExpr,
    })
    .from(vehicles)
    .leftJoin(filiais, eq(vehicles.filialId, filiais.id))
    .leftJoin(inspections, eq(inspections.vehicleId, vehicles.id))
    .leftJoin(occurrences, eq(occurrences.vehicleId, vehicles.id))
    .where(
      and(
        filialId ? eq(vehicles.filialId, filialId) : undefined,
        modelo ? eq(vehicles.modelo, modelo) : undefined,
        centroCusto
          ? centroCusto === "__SEM__"
            ? or(
                sql`${vehicles.centroCusto} is null`,
                sql`trim(${vehicles.centroCusto}) = ''`
              )
            : eq(vehicles.centroCusto, centroCusto)
          : undefined,
        q
          ? or(ilike(vehicles.placa, `%${q}%`), ilike(vehicles.modelo, `%${q}%`))
          : undefined
      )
    )
    .groupBy(vehicles.id, filiais.nome)
    .having(
      and(
        status === "conferido" ? sql`${conferidoExpr} = true` : undefined,
        status === "pendente" ? sql`${conferidoExpr} = false` : undefined,
        avarias === "com" ? sql`${avariasAbertasExpr} > 0` : undefined,
        avarias === "sem" ? sql`${avariasAbertasExpr} = 0` : undefined
      )
    )
    .orderBy(vehicles.placa);

  return rows;
}

export async function listDistinctModelos() {
  const rows = await db
    .selectDistinct({ modelo: vehicles.modelo })
    .from(vehicles)
    .orderBy(vehicles.modelo);
  return rows.map((r) => r.modelo).filter((m) => !!m && m.trim() !== "");
}

export async function listDistinctCentrosCusto() {
  const rows = await db
    .selectDistinct({ centroCusto: vehicles.centroCusto })
    .from(vehicles)
    .orderBy(vehicles.centroCusto);
  return rows
    .map((r) => r.centroCusto)
    .filter((c): c is string => !!c && c.trim() !== "");
}

export async function listFiliais() {
  return db.select().from(filiais).orderBy(filiais.nome);
}

export async function getFilialById(id: string) {
  const [row] = await db.select().from(filiais).where(eq(filiais.id, id)).limit(1);
  return row ?? null;
}

export async function listFiliaisWithCounts() {
  const rows = await db
    .select({
      id: filiais.id,
      nome: filiais.nome,
      codigo: filiais.codigo,
      empresa: filiais.empresa,
      veiculos: sql<number>`count(distinct ${vehicles.id})::int`,
      usuarios: sql<number>`count(distinct ${users.id})::int`,
    })
    .from(filiais)
    .leftJoin(vehicles, eq(vehicles.filialId, filiais.id))
    .leftJoin(users, eq(users.filialId, filiais.id))
    .groupBy(filiais.id)
    .orderBy(filiais.nome);
  return rows;
}

export async function listUsers(opts: { role?: string } = {}) {
  const { role } = opts;
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      filialId: users.filialId,
      filialNome: filiais.nome,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(filiais, eq(users.filialId, filiais.id))
    .where(
      role
        ? eq(users.role, role as "ADMIN" | "GERENTE" | "SUPERVISOR" | "CONDUTOR")
        : undefined
    )
    .orderBy(users.name);

  // Filiais adicionais (além da principal) que cada usuário também atende —
  // ver comentário em userFiliais no schema. Buscado à parte e mesclado em
  // memória para não duplicar linhas de usuário por filial extra.
  const extraRows = await db
    .select({
      userId: userFiliais.userId,
      filialNome: filiais.nome,
    })
    .from(userFiliais)
    .leftJoin(filiais, eq(userFiliais.filialId, filiais.id));

  const extraByUser = new Map<string, string[]>();
  for (const r of extraRows) {
    if (!r.filialNome) continue;
    const list = extraByUser.get(r.userId) ?? [];
    list.push(r.filialNome);
    extraByUser.set(r.userId, list);
  }

  return rows.map((u) => ({
    ...u,
    outrasFiliais: extraByUser.get(u.id) ?? [],
  }));
}

export async function getUserById(id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function listUserFiliaisIds(userId: string) {
  const rows = await db
    .select({ filialId: userFiliais.filialId })
    .from(userFiliais)
    .where(eq(userFiliais.userId, userId));
  return rows.map((r) => r.filialId);
}

/**
 * Substitui por completo o conjunto de filiais adicionais de um usuário
 * (fora a filial principal em users.filialId). Chamado ao criar/editar um
 * usuário — apaga o que existia e insere a nova seleção do formulário.
 */
export async function setUserFiliaisAdicionais(
  userId: string,
  filialIds: string[]
) {
  await db.delete(userFiliais).where(eq(userFiliais.userId, userId));
  const unique = Array.from(new Set(filialIds)).filter(Boolean);
  if (unique.length === 0) return;
  await db.insert(userFiliais).values(unique.map((filialId) => ({ userId, filialId })));
}

export async function listCondutores() {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.role, "CONDUTOR"), eq(users.active, true)))
    .orderBy(users.name);
}

export async function getVehicleForEdit(id: string) {
  const [row] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, id))
    .limit(1);
  return row ?? null;
}

export async function listVehiclesForCondutor(userId: string) {
  const { start, end } = currentMonthRange();
  const rows = await db
    .select({
      id: vehicles.id,
      placa: vehicles.placa,
      modelo: vehicles.modelo,
      marca: vehicles.marca,
      kmAtual: vehicles.kmAtual,
      filialNome: filiais.nome,
      conferidoEsteMes: sql<boolean>`bool_or(${inspections.createdAt} >= ${start.toISOString()}::timestamptz and ${inspections.createdAt} < ${end.toISOString()}::timestamptz)`,
    })
    .from(vehicles)
    .leftJoin(filiais, eq(vehicles.filialId, filiais.id))
    .leftJoin(inspections, eq(inspections.vehicleId, vehicles.id))
    .where(and(eq(vehicles.assignedCondutorId, userId), eq(vehicles.active, true)))
    .groupBy(vehicles.id, filiais.nome)
    .orderBy(vehicles.placa);
  return rows;
}

export async function getVehicleDetail(id: string) {
  const [vehicle] = await db
    .select({
      id: vehicles.id,
      placa: vehicles.placa,
      modelo: vehicles.modelo,
      marca: vehicles.marca,
      anoFabricacao: vehicles.anoFabricacao,
      kmAtual: vehicles.kmAtual,
      filialId: vehicles.filialId,
      filialNome: filiais.nome,
      assignedCondutorId: vehicles.assignedCondutorId,
      assignedCondutorNome: users.name,
      centroCusto: vehicles.centroCusto,
      condutorNome: vehicles.condutorNome,
    })
    .from(vehicles)
    .leftJoin(filiais, eq(vehicles.filialId, filiais.id))
    .leftJoin(users, eq(vehicles.assignedCondutorId, users.id))
    .where(eq(vehicles.id, id))
    .limit(1);

  if (!vehicle) return null;

  const inspectionRows = await db
    .select({
      id: inspections.id,
      km: inspections.km,
      status: inspections.status,
      createdAt: inspections.createdAt,
      performedByNome: users.name,
      avariasCount: sql<number>`(select count(*) from ${inspectionItems} where ${inspectionItems.inspectionId} = ${inspections.id} and ${inspectionItems.status} = 'AVARIA')::int`,
    })
    .from(inspections)
    .leftJoin(users, eq(inspections.performedById, users.id))
    .where(eq(inspections.vehicleId, id))
    .orderBy(desc(inspections.createdAt));

  const occurrenceRows = await db
    .select({
      id: occurrences.id,
      description: occurrences.description,
      status: occurrences.status,
      createdAt: occurrences.createdAt,
    })
    .from(occurrences)
    .where(eq(occurrences.vehicleId, id))
    .orderBy(desc(occurrences.createdAt));

  return { vehicle, inspections: inspectionRows, occurrences: occurrenceRows };
}

export async function listChecklistItemDefs() {
  return db
    .select()
    .from(checklistItemDefs)
    .where(eq(checklistItemDefs.active, true))
    .orderBy(checklistItemDefs.order);
}

/**
 * Admin management view: every item def (active or not), so a deactivated
 * item stays visible with a way to bring it back. Ordered by category then
 * order so it reads the same way the checklist itself is grouped.
 */
export async function listAllChecklistItemDefs() {
  return db
    .select()
    .from(checklistItemDefs)
    .orderBy(checklistItemDefs.category, checklistItemDefs.order);
}

export async function getInspectionDetail(id: string) {
  const [inspection] = await db
    .select({
      id: inspections.id,
      km: inspections.km,
      status: inspections.status,
      createdAt: inspections.createdAt,
      vehicleId: inspections.vehicleId,
      placa: vehicles.placa,
      modelo: vehicles.modelo,
      filialId: vehicles.filialId,
      filialNome: filiais.nome,
      performedById: inspections.performedById,
      performedByNome: users.name,
      occurrenceId: sql<string | null>`(select id from ${occurrences} where ${occurrences.inspectionId} = ${inspections.id} limit 1)`,
    })
    .from(inspections)
    .leftJoin(vehicles, eq(inspections.vehicleId, vehicles.id))
    .leftJoin(filiais, eq(vehicles.filialId, filiais.id))
    .leftJoin(users, eq(inspections.performedById, users.id))
    .where(eq(inspections.id, id))
    .limit(1);

  if (!inspection) return null;

  // Assinatura do supervisor só existe para conferências sem avaria — as com
  // avaria usam o fluxo de assinaturas da própria Ocorrência (condutor +
  // supervisor + gerente), então nem consulta aqui pra não confundir.
  const signatureRows = inspection.occurrenceId
    ? []
    : await db
        .select()
        .from(signatures)
        .where(eq(signatures.inspectionId, id));

  const items = await db
    .select({
      id: inspectionItems.id,
      status: inspectionItems.status,
      notes: inspectionItems.notes,
      label: checklistItemDefs.label,
      category: checklistItemDefs.category,
    })
    .from(inspectionItems)
    .leftJoin(checklistItemDefs, eq(inspectionItems.itemDefId, checklistItemDefs.id))
    .where(eq(inspectionItems.inspectionId, id));

  // As fotos ficam salvas por item do checklist (tanto de itens "OK" quanto
  // "Avaria") — só as de avaria também aparecem na página de Ocorrência.
  // Aqui trazemos todas, para exibir o checklist completo com todas as fotos
  // tiradas na conferência.
  const itemIds = items.map((i) => i.id);
  const itemPhotos =
    itemIds.length > 0
      ? await db
          .select({
            id: photos.id,
            url: photos.url,
            inspectionItemId: photos.inspectionItemId,
          })
          .from(photos)
          .where(inArray(photos.inspectionItemId, itemIds))
      : [];

  const photosByItem = new Map<string, { id: string; url: string }[]>();
  for (const p of itemPhotos) {
    if (!p.inspectionItemId) continue;
    const list = photosByItem.get(p.inspectionItemId) ?? [];
    list.push({ id: p.id, url: p.url });
    photosByItem.set(p.inspectionItemId, list);
  }

  const itemsWithPhotos = items.map((item) => ({
    ...item,
    photos: photosByItem.get(item.id) ?? [],
  }));

  return { inspection, items: itemsWithPhotos, signatures: signatureRows };
}

/**
 * Registra uma transferência (linha em vehicleTransfers) se a filial e/ou
 * centro de custo realmente mudaram — chamado tanto pela edição completa do
 * veículo quanto pelo botão dedicado "Transferir". Não faz nada se nada
 * mudou (evita linhas de histórico vazias quando o resto do cadastro é
 * editado sem trocar filial/centro de custo).
 */
export async function recordVehicleTransferIfChanged(params: {
  vehicleId: string;
  beforeFilialId: string | null;
  afterFilialId: string | null;
  beforeCentroCusto: string | null;
  afterCentroCusto: string | null;
  transferredById: string;
}) {
  const {
    vehicleId,
    beforeFilialId,
    afterFilialId,
    beforeCentroCusto,
    afterCentroCusto,
    transferredById,
  } = params;
  const filialMudou = beforeFilialId !== afterFilialId;
  const centroCustoMudou = (beforeCentroCusto ?? null) !== (afterCentroCusto ?? null);
  if (!filialMudou && !centroCustoMudou) return;

  await db.insert(vehicleTransfers).values({
    vehicleId,
    fromFilialId: beforeFilialId,
    toFilialId: afterFilialId,
    fromCentroCusto: beforeCentroCusto,
    toCentroCusto: afterCentroCusto,
    transferredById,
  });
}

/**
 * Histórico de transferências de filial/centro de custo de um veículo (ver
 * vehicleTransfers no schema) — um registro por vez que o cadastro do
 * veículo teve filial ou centro de custo alterados em Editar veículo.
 */
export async function listVehicleTransfers(vehicleId: string) {
  const fromFiliais = alias(filiais, "from_filiais");
  const toFiliais = alias(filiais, "to_filiais");

  return db
    .select({
      id: vehicleTransfers.id,
      createdAt: vehicleTransfers.createdAt,
      fromFilialNome: fromFiliais.nome,
      toFilialNome: toFiliais.nome,
      fromCentroCusto: vehicleTransfers.fromCentroCusto,
      toCentroCusto: vehicleTransfers.toCentroCusto,
      transferredByNome: users.name,
    })
    .from(vehicleTransfers)
    .leftJoin(fromFiliais, eq(vehicleTransfers.fromFilialId, fromFiliais.id))
    .leftJoin(toFiliais, eq(vehicleTransfers.toFilialId, toFiliais.id))
    .leftJoin(users, eq(vehicleTransfers.transferredById, users.id))
    .where(eq(vehicleTransfers.vehicleId, vehicleId))
    .orderBy(desc(vehicleTransfers.createdAt));
}

/**
 * Últimas conferências feitas por um usuário (qualquer veículo), usada na
 * tela "Meu veículo" para o condutor conseguir abrir e, se precisar,
 * excluir um checklist que ele mesmo fez errado.
 */
export async function listRecentInspectionsByUser(userId: string, limit = 5) {
  const rows = await db
    .select({
      id: inspections.id,
      km: inspections.km,
      status: inspections.status,
      createdAt: inspections.createdAt,
      vehicleId: inspections.vehicleId,
      placa: vehicles.placa,
      modelo: vehicles.modelo,
    })
    .from(inspections)
    .leftJoin(vehicles, eq(inspections.vehicleId, vehicles.id))
    .where(eq(inspections.performedById, userId))
    .orderBy(desc(inspections.createdAt))
    .limit(limit);

  return rows;
}

/**
 * Exclui uma conferência (checklist) inteira: itens, fotos, e a
 * ocorrência/registro de manutenção gerados por ela, se houver (uma
 * conferência com avaria cria uma ocorrência, que por sua vez bloqueia a
 * exclusão da conferência via chave estrangeira até ser removida primeiro).
 * Depois recalcula a quilometragem atual do veículo a partir das
 * conferências que sobraram — se essa era a única/mais recente, a
 * quilometragem anterior não fica registrada em lugar nenhum, então nesse
 * caso ela é mantida como está (o admin pode ajustar em "Editar veículo").
 */
export async function deleteInspection(inspectionId: string) {
  return db.transaction(async (tx) => {
    const [inspection] = await tx
      .select({
        id: inspections.id,
        vehicleId: inspections.vehicleId,
        performedById: inspections.performedById,
      })
      .from(inspections)
      .where(eq(inspections.id, inspectionId))
      .limit(1);
    if (!inspection) return null;

    const [occurrence] = await tx
      .select({ id: occurrences.id })
      .from(occurrences)
      .where(eq(occurrences.inspectionId, inspectionId))
      .limit(1);

    if (occurrence) {
      await tx
        .delete(maintenanceRecords)
        .where(eq(maintenanceRecords.occurrenceId, occurrence.id));
      await tx.delete(occurrences).where(eq(occurrences.id, occurrence.id));
    }

    await tx.delete(inspections).where(eq(inspections.id, inspectionId));

    const [{ maxKm }] = await tx
      .select({ maxKm: sql<number | null>`max(${inspections.km})` })
      .from(inspections)
      .where(eq(inspections.vehicleId, inspection.vehicleId));

    if (maxKm != null) {
      await tx
        .update(vehicles)
        .set({ kmAtual: maxKm })
        .where(eq(vehicles.id, inspection.vehicleId));
    }

    return inspection;
  });
}

export async function listOccurrences(opts: {
  status?: "PENDENTE" | "EM_ANDAMENTO" | "RESOLVIDA";
  filialId?: string;
} = {}) {
  const { status, filialId } = opts;
  const rows = await db
    .select({
      id: occurrences.id,
      description: occurrences.description,
      status: occurrences.status,
      createdAt: occurrences.createdAt,
      vehicleId: occurrences.vehicleId,
      placa: vehicles.placa,
      modelo: vehicles.modelo,
      filialNome: filiais.nome,
      assinaturasCount: sql<number>`(select count(*) from ${signatures} where ${signatures.occurrenceId} = ${occurrences.id})::int`,
    })
    .from(occurrences)
    .leftJoin(vehicles, eq(occurrences.vehicleId, vehicles.id))
    .leftJoin(filiais, eq(vehicles.filialId, filiais.id))
    .where(
      and(
        status ? eq(occurrences.status, status) : undefined,
        filialId ? eq(vehicles.filialId, filialId) : undefined
      )
    )
    .orderBy(desc(occurrences.createdAt));

  return rows;
}

export async function getOccurrenceDetail(id: string) {
  const performers = alias(users, "performers");
  const [occurrence] = await db
    .select({
      id: occurrences.id,
      description: occurrences.description,
      relato: occurrences.relato,
      status: occurrences.status,
      createdAt: occurrences.createdAt,
      resolvedAt: occurrences.resolvedAt,
      resolutionNotes: occurrences.resolutionNotes,
      vehicleId: occurrences.vehicleId,
      placa: vehicles.placa,
      modelo: vehicles.modelo,
      filialId: vehicles.filialId,
      filialNome: filiais.nome,
      assignedCondutorId: vehicles.assignedCondutorId,
      inspectionId: occurrences.inspectionId,
      km: inspections.km,
      performedById: inspections.performedById,
      performedByNome: performers.name,
    })
    .from(occurrences)
    .leftJoin(vehicles, eq(occurrences.vehicleId, vehicles.id))
    .leftJoin(filiais, eq(vehicles.filialId, filiais.id))
    .leftJoin(inspections, eq(occurrences.inspectionId, inspections.id))
    .leftJoin(performers, eq(inspections.performedById, performers.id))
    .where(eq(occurrences.id, id))
    .limit(1);

  if (!occurrence) return null;

  const signatureRows = await db
    .select()
    .from(signatures)
    .where(eq(signatures.occurrenceId, id));

  const linkRows = await db
    .select()
    .from(signatureLinks)
    .where(eq(signatureLinks.occurrenceId, id));

  const itemRows = await db
    .select({
      id: inspectionItems.id,
      label: checklistItemDefs.label,
      status: inspectionItems.status,
      notes: inspectionItems.notes,
    })
    .from(inspectionItems)
    .leftJoin(checklistItemDefs, eq(inspectionItems.itemDefId, checklistItemDefs.id))
    .where(
      and(
        eq(inspectionItems.inspectionId, occurrence.inspectionId),
        eq(inspectionItems.status, "AVARIA")
      )
    );

  const photoRows = await db
    .select()
    .from(photos)
    .where(eq(photos.occurrenceId, id));

  return {
    occurrence,
    signatures: signatureRows,
    signatureLinks: linkRows,
    avariaItems: itemRows,
    photos: photoRows,
  };
}

/**
 * Registra uma assinatura de ocorrência respeitando a ordem obrigatória
 * (condutor → supervisor → gerente) — usado tanto pelo fluxo normal
 * (usuário logado assinando a própria etapa) quanto pelo link de assinatura
 * sem login, pra não duplicar a validação de ordem/duplicidade nos dois
 * lugares.
 */
export async function recordOccurrenceSignature(params: {
  occurrenceId: string;
  role: "CONDUTOR" | "SUPERVISOR" | "GERENTE";
  userId: string;
  userNameSnap: string;
  signatureImageUrl: string;
}): Promise<{ error: string | null }> {
  const { occurrenceId, role, userId, userNameSnap, signatureImageUrl } = params;

  const existing = await db
    .select()
    .from(signatures)
    .where(eq(signatures.occurrenceId, occurrenceId));

  const stepIndex = SIGNATURE_ORDER.indexOf(role);
  for (let i = 0; i < stepIndex; i++) {
    const requiredRole = SIGNATURE_ORDER[i];
    if (!existing.some((s) => s.role === requiredRole)) {
      return {
        error: `A assinatura de "${SIGNATURE_ROLE_LABELS[requiredRole]}" precisa ocorrer primeiro.`,
      };
    }
  }
  if (existing.some((s) => s.role === role)) {
    return { error: "Esta etapa já foi assinada." };
  }

  await db
    .insert(signatures)
    .values({ occurrenceId, role, userId, userNameSnap, signatureImageUrl });

  const totalSigned = existing.length + 1;
  if (totalSigned === SIGNATURE_ORDER.length) {
    await db
      .update(occurrences)
      .set({ status: "EM_ANDAMENTO" })
      .where(
        and(eq(occurrences.id, occurrenceId), eq(occurrences.status, "PENDENTE"))
      );
  }

  return { error: null };
}

/**
 * Reabre uma ocorrência marcada como resolvida por engano (ou porque o
 * problema voltou) — volta pro status que faz sentido dado o que já foi
 * assinado (EM_ANDAMENTO se as 3 assinaturas já existem, senão PENDENTE) e
 * limpa a data de resolução. O registro de manutenção correspondente
 * acompanha o mesmo status, pra sumir da lista de "Resolvidas" em
 * Manutenção. As observações da resolução anterior ficam salvas (não são
 * apagadas), caso a ocorrência seja resolvida de novo depois.
 */
export async function reopenOccurrence(occurrenceId: string) {
  const sigs = await db
    .select({ role: signatures.role })
    .from(signatures)
    .where(eq(signatures.occurrenceId, occurrenceId));
  const allSigned = SIGNATURE_ORDER.every((r) =>
    sigs.some((s) => s.role === r)
  );
  const newStatus = allSigned ? "EM_ANDAMENTO" : "PENDENTE";

  await db
    .update(occurrences)
    .set({ status: newStatus, resolvedAt: null })
    .where(eq(occurrences.id, occurrenceId));

  await db
    .update(maintenanceRecords)
    .set({ status: newStatus, resolvedAt: null })
    .where(eq(maintenanceRecords.occurrenceId, occurrenceId));
}

/**
 * Cria (ou substitui, se já existir uma pra essa etapa) um link de
 * assinatura sem login pra mandar por WhatsApp. Válido por 30 dias.
 */
export async function createOrRefreshSignatureLink(params: {
  occurrenceId: string;
  role: "CONDUTOR" | "SUPERVISOR" | "GERENTE";
  userId: string;
  createdById: string;
}): Promise<string> {
  const { occurrenceId, role, userId, createdById } = params;
  const token = createToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db
    .insert(signatureLinks)
    .values({ token, occurrenceId, role, userId, createdById, expiresAt })
    .onConflictDoUpdate({
      target: [signatureLinks.occurrenceId, signatureLinks.role],
      set: { token, userId, createdById, expiresAt, usedAt: null, createdAt: new Date() },
    });

  return token;
}

export async function getSignatureLinkDetail(token: string) {
  const [link] = await db
    .select({
      id: signatureLinks.id,
      occurrenceId: signatureLinks.occurrenceId,
      role: signatureLinks.role,
      userId: signatureLinks.userId,
      userNome: users.name,
      expiresAt: signatureLinks.expiresAt,
      usedAt: signatureLinks.usedAt,
    })
    .from(signatureLinks)
    .leftJoin(users, eq(signatureLinks.userId, users.id))
    .where(eq(signatureLinks.token, token))
    .limit(1);

  if (!link) return null;

  const detail = await getOccurrenceDetail(link.occurrenceId);
  if (!detail) return null;

  return { link, ...detail };
}

export async function listMaintenanceRecords(opts: {
  status?: "PENDENTE" | "EM_ANDAMENTO" | "RESOLVIDA";
  filialId?: string;
} = {}) {
  const { status, filialId } = opts;
  return db
    .select({
      id: maintenanceRecords.id,
      description: maintenanceRecords.description,
      status: maintenanceRecords.status,
      createdAt: maintenanceRecords.createdAt,
      resolvedAt: maintenanceRecords.resolvedAt,
      occurrenceId: maintenanceRecords.occurrenceId,
      vehicleId: maintenanceRecords.vehicleId,
      placa: vehicles.placa,
      modelo: vehicles.modelo,
      filialNome: filiais.nome,
    })
    .from(maintenanceRecords)
    .leftJoin(vehicles, eq(maintenanceRecords.vehicleId, vehicles.id))
    .leftJoin(filiais, eq(vehicles.filialId, filiais.id))
    .where(
      and(
        status ? eq(maintenanceRecords.status, status) : undefined,
        filialId ? eq(vehicles.filialId, filialId) : undefined
      )
    )
    .orderBy(desc(maintenanceRecords.createdAt));
}

export async function getDashboardStats(opts: { filialId?: string } = {}) {
  const { start, end } = currentMonthRange();
  const { filialId } = opts;

  const [fleet] = await db
    .select({
      totalVeiculos: sql<number>`count(*)::int`,
      kmTotal: sql<number>`coalesce(sum(${vehicles.kmAtual}), 0)::int`,
    })
    .from(vehicles)
    .where(filialId ? eq(vehicles.filialId, filialId) : undefined);

  const [conferidosRow] = await db
    .select({
      conferidos: sql<number>`count(distinct ${inspections.vehicleId})::int`,
    })
    .from(inspections)
    .leftJoin(vehicles, eq(inspections.vehicleId, vehicles.id))
    .where(
      and(
        gte(inspections.createdAt, start),
        lt(inspections.createdAt, end),
        filialId ? eq(vehicles.filialId, filialId) : undefined
      )
    );

  const [occRow] = await db
    .select({
      comAvaria: sql<number>`count(distinct ${occurrences.vehicleId})::int`,
      totalAvarias: sql<number>`count(*)::int`,
      resolvidas: sql<number>`count(*) filter (where ${occurrences.status} = 'RESOLVIDA')::int`,
      pendentes: sql<number>`count(*) filter (where ${occurrences.status} != 'RESOLVIDA')::int`,
    })
    .from(occurrences)
    .leftJoin(vehicles, eq(occurrences.vehicleId, vehicles.id))
    .where(filialId ? eq(vehicles.filialId, filialId) : undefined);

  const totalVeiculos = fleet?.totalVeiculos ?? 0;
  const conferidos = conferidosRow?.conferidos ?? 0;
  const pendentes = totalVeiculos - conferidos;
  const percentualConclusao = totalVeiculos
    ? Math.round((conferidos / totalVeiculos) * 100)
    : 0;

  return {
    totalVeiculos,
    conferidos,
    pendentes,
    percentualConclusao,
    comAvaria: occRow?.comAvaria ?? 0,
    totalAvarias: occRow?.totalAvarias ?? 0,
    avariasResolvidas: occRow?.resolvidas ?? 0,
    avariasPendentes: occRow?.pendentes ?? 0,
    kmTotal: fleet?.kmTotal ?? 0,
  };
}

export async function getDashboardByFilial(opts: { filialId?: string } = {}) {
  const { start, end } = currentMonthRange();
  const { filialId } = opts;

  const rows = await db
    .select({
      filialId: filiais.id,
      filialNome: filiais.nome,
      totalVeiculos: sql<number>`count(distinct ${vehicles.id})::int`,
      conferidos: sql<number>`count(distinct case when ${inspections.createdAt} >= ${start.toISOString()}::timestamptz and ${inspections.createdAt} < ${end.toISOString()}::timestamptz then ${inspections.vehicleId} end)::int`,
      avariasAbertas: sql<number>`count(distinct case when ${occurrences.status} != 'RESOLVIDA' then ${occurrences.id} end)::int`,
    })
    .from(filiais)
    .leftJoin(vehicles, eq(vehicles.filialId, filiais.id))
    .leftJoin(inspections, eq(inspections.vehicleId, vehicles.id))
    .leftJoin(occurrences, eq(occurrences.vehicleId, vehicles.id))
    .where(filialId ? eq(filiais.id, filialId) : undefined)
    .groupBy(filiais.id, filiais.nome)
    .orderBy(filiais.nome);

  return rows.map((r) => ({
    ...r,
    pendentes: r.totalVeiculos - r.conferidos,
    percentualConclusao: r.totalVeiculos
      ? Math.round((r.conferidos / r.totalVeiculos) * 100)
      : 0,
  }));
}

export async function getDashboardByPeriod(
  months = 6,
  opts: { filialId?: string } = {}
) {
  const { filialId } = opts;
  const rows = await db.execute<{
    mes: string;
    conferidos: number;
    avarias: number;
  }>(sql`
    select
      to_char(date_trunc('month', i.created_at), 'YYYY-MM') as mes,
      count(distinct i.vehicle_id)::int as conferidos,
      count(distinct o.id)::int as avarias
    from ${inspections} i
    left join ${occurrences} o on o.inspection_id = i.id
    left join ${vehicles} v on v.id = i.vehicle_id
    where i.created_at >= date_trunc('month', now()) - interval '${sql.raw(
      String(months - 1)
    )} months'
    ${filialId ? sql`and v.filial_id = ${filialId}` : sql``}
    group by 1
    order by 1
  `);
  return rows as unknown as { mes: string; conferidos: number; avarias: number }[];
}

export async function getVehicleCountByCentroCusto(opts: { filialId?: string } = {}) {
  const { filialId } = opts;
  const rows = await db.execute<{ centroCusto: string; total: number }>(sql`
    select
      coalesce(nullif(trim(${vehicles.centroCusto}), ''), 'Sem centro de custo') as "centroCusto",
      count(*)::int as total
    from ${vehicles}
    ${filialId ? sql`where ${vehicles.filialId} = ${filialId}` : sql``}
    group by 1
    order by total desc, "centroCusto"
  `);
  return rows as unknown as { centroCusto: string; total: number }[];
}

export async function getVehicleCountByModelo(opts: { filialId?: string } = {}) {
  const { filialId } = opts;
  const rows = await db.execute<{ modelo: string; total: number }>(sql`
    select
      ${vehicles.modelo} as modelo,
      count(*)::int as total
    from ${vehicles}
    ${filialId ? sql`where ${vehicles.filialId} = ${filialId}` : sql``}
    group by 1
    order by total desc, modelo
  `);
  return rows as unknown as { modelo: string; total: number }[];
}

export async function findUserByRoleForOccurrenceSignature() {
  return db.select().from(users);
}

export async function listOccurrencesForCondutor(userId: string) {
  return db
    .select({
      id: occurrences.id,
      description: occurrences.description,
      status: occurrences.status,
      createdAt: occurrences.createdAt,
      placa: vehicles.placa,
      modelo: vehicles.modelo,
    })
    .from(occurrences)
    .leftJoin(vehicles, eq(occurrences.vehicleId, vehicles.id))
    .where(eq(vehicles.assignedCondutorId, userId))
    .orderBy(desc(occurrences.createdAt))
    .limit(20);
}

/**
 * Counts everything a "limpar dados de exemplo" wipe would remove, so the
 * confirmation screen can show exactly what's about to be deleted before
 * the admin types the confirmation phrase. currentUserId is always
 * excluded from the usuarios count — that account is never touched.
 */
export async function getExampleDataSummary(currentUserId: string) {
  const [[filiaisRow], [veiculosRow], [usuariosRow], [checklistsRow], [ocorrenciasRow]] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(filiais),
      db.select({ count: sql<number>`count(*)::int` }).from(vehicles),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(ne(users.id, currentUserId)),
      db.select({ count: sql<number>`count(*)::int` }).from(inspections),
      db.select({ count: sql<number>`count(*)::int` }).from(occurrences),
    ]);

  return {
    filiais: filiaisRow.count,
    veiculos: veiculosRow.count,
    usuarios: usuariosRow.count,
    checklists: checklistsRow.count,
    ocorrencias: ocorrenciasRow.count,
  };
}

export async function pendingVehiclesThisMonth(
  limit = 50,
  opts: { filialId?: string } = {}
) {
  const { start, end } = currentMonthRange();
  const { filialId } = opts;
  const rows = await db
    .select({
      id: vehicles.id,
      placa: vehicles.placa,
      modelo: vehicles.modelo,
      filialNome: filiais.nome,
    })
    .from(vehicles)
    .leftJoin(filiais, eq(vehicles.filialId, filiais.id))
    .where(
      and(
        sql`not exists (
          select 1 from ${inspections}
          where ${inspections.vehicleId} = ${vehicles.id}
          and ${inspections.createdAt} >= ${start.toISOString()}::timestamptz
          and ${inspections.createdAt} < ${end.toISOString()}::timestamptz
        )`,
        filialId ? eq(vehicles.filialId, filialId) : undefined
      )
    )
    .orderBy(vehicles.placa)
    .limit(limit);
  return rows;
}

/**
 * Veículos ativos pro painel de Revisões — filial/placa aqui, o marco de
 * revisão (10k, 20k...) e o status feito/pendente são calculados/buscados à
 * parte (ver nextRevisionKm em domain.ts e listVehicleRevisionsFor abaixo),
 * já que dependem do kmAtual de cada veículo, que muda a cada checklist.
 */
export async function listVehiclesForRevisions(
  opts: { filialId?: string; q?: string } = {}
) {
  const { filialId, q } = opts;
  const rows = await db
    .select({
      id: vehicles.id,
      placa: vehicles.placa,
      modelo: vehicles.modelo,
      marca: vehicles.marca,
      kmAtual: vehicles.kmAtual,
      filialId: vehicles.filialId,
      filialNome: filiais.nome,
      centroCusto: vehicles.centroCusto,
    })
    .from(vehicles)
    .leftJoin(filiais, eq(vehicles.filialId, filiais.id))
    .where(
      and(
        eq(vehicles.active, true),
        filialId ? eq(vehicles.filialId, filialId) : undefined,
        q
          ? or(ilike(vehicles.placa, `%${q}%`), ilike(vehicles.modelo, `%${q}%`))
          : undefined
      )
    )
    .orderBy(vehicles.placa);
  return rows;
}

/** Todas as linhas de revisão (qualquer marco) dos veículos informados. */
export async function listVehicleRevisionsFor(vehicleIds: string[]) {
  if (vehicleIds.length === 0) return [];
  return db
    .select()
    .from(vehicleRevisions)
    .where(inArray(vehicleRevisions.vehicleId, vehicleIds));
}

/**
 * Cria ou atualiza a linha de revisão de um veículo pra um marco específico
 * (vehicleId + kmAlvo é único — ver índice na tabela). Usado tanto pra
 * marcar como feito (com data/km/observação) quanto só pra editar a
 * observação de um marco ainda pendente.
 */
export async function upsertVehicleRevision(params: {
  vehicleId: string;
  kmAlvo: number;
  status: "PENDENTE" | "FEITO";
  dataRevisao: Date | null;
  kmRevisao: number | null;
  observacao: string | null;
  updatedById: string;
}) {
  const { vehicleId, kmAlvo, status, dataRevisao, kmRevisao, observacao, updatedById } =
    params;
  await db
    .insert(vehicleRevisions)
    .values({
      vehicleId,
      kmAlvo,
      status,
      dataRevisao,
      kmRevisao,
      observacao,
      updatedById,
    })
    .onConflictDoUpdate({
      target: [vehicleRevisions.vehicleId, vehicleRevisions.kmAlvo],
      set: {
        status,
        dataRevisao,
        kmRevisao,
        observacao,
        updatedById,
        updatedAt: new Date(),
      },
    });
}
