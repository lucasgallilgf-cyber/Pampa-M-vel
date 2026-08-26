import { hashSync } from "bcryptjs";
import { db } from "./index";
import {
  filiais,
  users,
  checklistItemDefs,
  vehicles,
  inspections,
  inspectionItems,
  occurrences,
  signatures,
  maintenanceRecords,
} from "./schema";
import { CHECKLIST_CATEGORIES, SIGNATURE_ORDER } from "../lib/domain";
import { sql } from "drizzle-orm";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(randInt(7, 18), randInt(0, 59), 0, 0);
  return d;
}

const FILIAIS = [
  { nome: "Matriz - Cuiabá", codigo: "MTZ" },
  { nome: "Filial - Várzea Grande", codigo: "VGR" },
  { nome: "Filial - Rondonópolis", codigo: "RDP" },
  { nome: "Filial - Sinop", codigo: "SNP" },
  { nome: "Filial - Cáceres", codigo: "CCR" },
  { nome: "Filial - Barra do Garças", codigo: "BGR" },
];

const MODELOS = [
  { marca: "Fiat", modelo: "Strada" },
  { marca: "Volkswagen", modelo: "Saveiro" },
  { marca: "Chevrolet", modelo: "S10" },
  { marca: "Toyota", modelo: "Hilux" },
  { marca: "Fiat", modelo: "Doblo" },
  { marca: "Volkswagen", modelo: "Delivery" },
  { marca: "Ford", modelo: "Ranger" },
  { marca: "Renault", modelo: "Master" },
  { marca: "Fiat", modelo: "Toro" },
  { marca: "Mitsubishi", modelo: "L200 Triton" },
];

const NOMES_CONDUTOR = [
  "Carlos Souza", "Marcos Lima", "Pedro Alves", "Rafael Costa", "Bruno Santos",
  "Diego Ferreira", "Eduardo Rocha", "Felipe Martins", "Gustavo Pereira", "Henrique Dias",
  "Igor Nogueira", "João Batista", "Leandro Ramos", "Marcelo Vieira", "Nelson Cardoso",
  "Otávio Barros", "Paulo Teixeira", "Ricardo Nunes",
];
const NOMES_SUPERVISOR = [
  "Ana Paula Silva", "Juliana Mendes", "Fernanda Araújo", "Camila Duarte",
  "Patrícia Gomes", "Renata Moura",
];
const NOMES_GERENTE = ["Roberto Carvalho", "Simone Andrade"];

export async function seedDatabase(log: (msg: string) => void = console.log) {
  log("Limpando dados existentes...");
  await db.execute(sql`truncate table
    photos, signatures, maintenance_records, occurrences,
    inspection_items, inspections, vehicles, checklist_item_defs,
    users, filiais
    cascade`);

  log("Criando filiais...");
  const filialRows = await db.insert(filiais).values(FILIAIS).returning();

  log("Criando itens de checklist...");
  let order = 0;
  const itemDefsToInsert = CHECKLIST_CATEGORIES.flatMap((cat) =>
    cat.items.map((label) => ({
      label,
      category: cat.category,
      order: order++,
    }))
  );
  const itemDefRows = await db
    .insert(checklistItemDefs)
    .values(itemDefsToInsert)
    .returning();

  log("Criando usuários...");
  const passwordHash = hashSync("senha123", 10);

  const admin = (
    await db
      .insert(users)
      .values({
        name: "Administrador do Sistema",
        email: "admin@pampa.com.br",
        passwordHash,
        role: "ADMIN",
      })
      .returning()
  )[0];

  const gerentes = await db
    .insert(users)
    .values(
      NOMES_GERENTE.map((name, i) => ({
        name,
        email: `gerente${i + 1}@pampa.com.br`,
        passwordHash,
        role: "GERENTE" as const,
      }))
    )
    .returning();

  const supervisores = await db
    .insert(users)
    .values(
      NOMES_SUPERVISOR.map((name, i) => ({
        name,
        email: `supervisor${i + 1}@pampa.com.br`,
        passwordHash,
        role: "SUPERVISOR" as const,
        filialId: filialRows[i % filialRows.length].id,
      }))
    )
    .returning();

  const condutores = await db
    .insert(users)
    .values(
      NOMES_CONDUTOR.map((name, i) => ({
        name,
        email: `condutor${i + 1}@pampa.com.br`,
        passwordHash,
        role: "CONDUTOR" as const,
        filialId: filialRows[i % filialRows.length].id,
      }))
    )
    .returning();

  log(
    `Usuários criados: 1 admin, ${gerentes.length} gerentes, ${supervisores.length} supervisores, ${condutores.length} condutores.`
  );

  log("Criando 150 veículos...");
  const plateLetters = () =>
    Array.from({ length: 3 }, () => String.fromCharCode(65 + randInt(0, 25))).join("");

  const vehicleValues = Array.from({ length: 150 }, (_, i) => {
    const { marca, modelo } = pick(MODELOS);
    const filial = filialRows[i % filialRows.length];
    const condutor = pick(condutores);
    return {
      placa: `${plateLetters()}${randInt(0, 9)}${String.fromCharCode(
        65 + randInt(0, 25)
      )}${randInt(0, 9)}${randInt(0, 9)}`,
      modelo,
      marca,
      anoFabricacao: randInt(2016, 2025),
      filialId: filial.id,
      kmAtual: randInt(5000, 185000),
      assignedCondutorId: condutor.id,
    };
  });

  const vehicleRows = await db.insert(vehicles).values(vehicleValues).returning();

  log("Gerando inspeções, avarias, assinaturas e manutenções...");
  const supervisorByFilial = (filialId: string) =>
    supervisores.find((s) => s.filialId === filialId) ?? pick(supervisores);

  let inspectionCount = 0;
  let occurrenceCount = 0;

  async function createInspection(
    vehicle: (typeof vehicleRows)[number],
    daysBack: number,
    forceAvaria: boolean
  ) {
    const performedBy = supervisorByFilial(vehicle.filialId);
    const createdAt = daysAgo(daysBack);
    const km = Math.max(0, vehicle.kmAtual - daysBack * randInt(20, 90));

    const [inspection] = await db
      .insert(inspections)
      .values({
        vehicleId: vehicle.id,
        performedById: performedBy.id,
        km,
        status: forceAvaria ? "COM_AVARIA" : "OK",
        createdAt,
      })
      .returning();
    inspectionCount++;

    const avariaItems: string[] = [];
    const itemRows = await db
      .insert(inspectionItems)
      .values(
        itemDefRows.map((def) => {
          const isAvaria = forceAvaria && Math.random() < 0.18;
          if (isAvaria) avariaItems.push(def.label);
          return {
            inspectionId: inspection.id,
            itemDefId: def.id,
            status: isAvaria ? ("AVARIA" as const) : ("OK" as const),
          };
        })
      )
      .returning();

    if (forceAvaria && avariaItems.length === 0) {
      avariaItems.push(pick(itemDefRows).label);
      const item = itemRows[0];
      await db
        .update(inspectionItems)
        .set({ status: "AVARIA" })
        .where(sql`${inspectionItems.id} = ${item.id}`);
    }

    if (avariaItems.length > 0) {
      const [occurrence] = await db
        .insert(occurrences)
        .values({
          inspectionId: inspection.id,
          vehicleId: vehicle.id,
          description: `Avaria identificada durante conferência mensal: ${avariaItems.join(
            ", "
          )}.`,
          createdAt,
        })
        .returning();
      occurrenceCount++;

      const stage = randInt(0, 4);
      const condutorUser =
        condutores.find((c) => c.id === vehicle.assignedCondutorId) ??
        pick(condutores);
      const gerente = pick(gerentes);
      const signers: Record<string, (typeof users.$inferSelect)> = {
        CONDUTOR: condutorUser,
        SUPERVISOR: performedBy,
        GERENTE: gerente,
      };

      let signedCount = 0;
      if (stage >= 1) signedCount = 1;
      if (stage >= 2) signedCount = 2;
      if (stage >= 3) signedCount = 3;

      for (let i = 0; i < signedCount; i++) {
        const role = SIGNATURE_ORDER[i];
        const user = signers[role];
        await db.insert(signatures).values({
          occurrenceId: occurrence.id,
          role,
          userId: user.id,
          userNameSnap: user.name,
          signedAt: new Date(createdAt.getTime() + (i + 1) * 3600 * 1000),
        });
      }

      const resolved = stage >= 3 && Math.random() < 0.5;
      if (resolved) {
        await db
          .update(occurrences)
          .set({
            status: "RESOLVIDA",
            resolvedAt: new Date(createdAt.getTime() + 5 * 86400 * 1000),
            resolutionNotes: "Reparo realizado na oficina credenciada.",
          })
          .where(sql`${occurrences.id} = ${occurrence.id}`);
      } else if (stage >= 3) {
        await db
          .update(occurrences)
          .set({ status: "EM_ANDAMENTO" })
          .where(sql`${occurrences.id} = ${occurrence.id}`);
      }

      await db.insert(maintenanceRecords).values({
        occurrenceId: occurrence.id,
        vehicleId: vehicle.id,
        description: `Manutenção referente a: ${avariaItems.join(", ")}.`,
        status: resolved ? "RESOLVIDA" : stage >= 3 ? "EM_ANDAMENTO" : "PENDENTE",
        resolvedAt: resolved
          ? new Date(createdAt.getTime() + 5 * 86400 * 1000)
          : null,
      });
    }
  }

  for (const vehicle of vehicleRows) {
    if (Math.random() < 0.6) {
      for (const back of [randInt(35, 55), randInt(65, 85)]) {
        if (Math.random() < 0.7) {
          await createInspection(vehicle, back, false);
        }
      }
    }
    if (Math.random() < 0.78) {
      const hasAvaria = Math.random() < 0.22;
      await createInspection(vehicle, randInt(0, 27), hasAvaria);
    }
  }

  log(
    `Concluído: ${vehicleRows.length} veículos, ${inspectionCount} inspeções, ${occurrenceCount} ocorrências.`
  );

  return {
    veiculos: vehicleRows.length,
    inspecoes: inspectionCount,
    ocorrencias: occurrenceCount,
    logins: {
      admin: admin.email,
      gerente: gerentes[0].email,
      supervisor: supervisores[0].email,
      condutor: condutores[0].email,
      senha: "senha123",
    },
  };
}
