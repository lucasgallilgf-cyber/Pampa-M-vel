import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@/lib/id";

export const roleEnum = pgEnum("role", [
  "ADMIN",
  "GERENTE",
  "SUPERVISOR",
  "CONDUTOR",
]);

export const itemStatusEnum = pgEnum("item_status", [
  "OK",
  "AVARIA",
  "NAO_APLICAVEL",
]);

export const inspectionStatusEnum = pgEnum("inspection_status", [
  "OK",
  "COM_AVARIA",
]);

export const occurrenceStatusEnum = pgEnum("occurrence_status", [
  "PENDENTE",
  "EM_ANDAMENTO",
  "RESOLVIDA",
]);

export const signatureRoleEnum = pgEnum("signature_role", [
  "CONDUTOR",
  "SUPERVISOR",
  "GERENTE",
]);

export const filiais = pgTable("filiais", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  nome: text("nome").notNull(),
  codigo: text("codigo").notNull().unique(),
  empresa: text("empresa"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  filialId: text("filial_id").references(() => filiais.id),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const checklistItemDefs = pgTable("checklist_item_defs", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  label: text("label").notNull(),
  category: text("category").notNull(),
  order: integer("order").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
});

export const vehicles = pgTable(
  "vehicles",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    placa: text("placa").notNull().unique(),
    modelo: text("modelo").notNull(),
    marca: text("marca").notNull(),
    anoFabricacao: integer("ano_fabricacao"),
    filialId: text("filial_id")
      .notNull()
      .references(() => filiais.id),
    kmAtual: integer("km_atual").default(0).notNull(),
    assignedCondutorId: text("assigned_condutor_id").references(() => users.id),
    centroCusto: text("centro_custo"),
    condutorNome: text("condutor_nome"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("vehicles_filial_idx").on(t.filialId)]
);

export const inspections = pgTable(
  "inspections",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id),
    performedById: text("performed_by_id")
      .notNull()
      .references(() => users.id),
    km: integer("km").notNull(),
    status: inspectionStatusEnum("status").default("OK").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("inspections_vehicle_idx").on(t.vehicleId),
    index("inspections_created_idx").on(t.createdAt),
  ]
);

export const inspectionItems = pgTable(
  "inspection_items",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    inspectionId: text("inspection_id")
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    itemDefId: text("item_def_id")
      .notNull()
      .references(() => checklistItemDefs.id),
    status: itemStatusEnum("status").default("OK").notNull(),
    notes: text("notes"),
  },
  (t) => [index("inspection_items_inspection_idx").on(t.inspectionId)]
);

export const occurrences = pgTable(
  "occurrences",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    inspectionId: text("inspection_id")
      .notNull()
      .unique()
      .references(() => inspections.id),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id),
    description: text("description").notNull(),
    status: occurrenceStatusEnum("status").default("PENDENTE").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
    resolutionNotes: text("resolution_notes"),
  },
  (t) => [
    index("occurrences_vehicle_idx").on(t.vehicleId),
    index("occurrences_status_idx").on(t.status),
  ]
);

export const signatures = pgTable(
  "signatures",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    occurrenceId: text("occurrence_id")
      .notNull()
      .references(() => occurrences.id, { onDelete: "cascade" }),
    role: signatureRoleEnum("role").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    userNameSnap: text("user_name_snap").notNull(),
    signatureImageUrl: text("signature_image_url"),
    signedAt: timestamp("signed_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("signatures_occurrence_role_idx").on(t.occurrenceId, t.role),
  ]
);

export const maintenanceRecords = pgTable("maintenance_records", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  occurrenceId: text("occurrence_id")
    .notNull()
    .unique()
    .references(() => occurrences.id),
  vehicleId: text("vehicle_id")
    .notNull()
    .references(() => vehicles.id),
  description: text("description").notNull(),
  status: occurrenceStatusEnum("status").default("PENDENTE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  notes: text("notes"),
});

export const photos = pgTable("photos", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  url: text("url").notNull(),
  inspectionItemId: text("inspection_item_id").references(
    () => inspectionItems.id,
    { onDelete: "cascade" }
  ),
  occurrenceId: text("occurrence_id").references(() => occurrences.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---- relations ----

export const filiaisRelations = relations(filiais, ({ many }) => ({
  vehicles: many(vehicles),
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  filial: one(filiais, { fields: [users.filialId], references: [filiais.id] }),
  inspections: many(inspections),
  signatures: many(signatures),
  assignedVehicles: many(vehicles),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  filial: one(filiais, {
    fields: [vehicles.filialId],
    references: [filiais.id],
  }),
  assignedCondutor: one(users, {
    fields: [vehicles.assignedCondutorId],
    references: [users.id],
  }),
  inspections: many(inspections),
  occurrences: many(occurrences),
}));

export const inspectionsRelations = relations(inspections, ({ one, many }) => ({
  vehicle: one(vehicles, {
    fields: [inspections.vehicleId],
    references: [vehicles.id],
  }),
  performedBy: one(users, {
    fields: [inspections.performedById],
    references: [users.id],
  }),
  items: many(inspectionItems),
  occurrence: one(occurrences, {
    fields: [inspections.id],
    references: [occurrences.inspectionId],
  }),
}));

export const inspectionItemsRelations = relations(
  inspectionItems,
  ({ one, many }) => ({
    inspection: one(inspections, {
      fields: [inspectionItems.inspectionId],
      references: [inspections.id],
    }),
    itemDef: one(checklistItemDefs, {
      fields: [inspectionItems.itemDefId],
      references: [checklistItemDefs.id],
    }),
    photos: many(photos),
  })
);

export const occurrencesRelations = relations(occurrences, ({ one, many }) => ({
  inspection: one(inspections, {
    fields: [occurrences.inspectionId],
    references: [inspections.id],
  }),
  vehicle: one(vehicles, {
    fields: [occurrences.vehicleId],
    references: [vehicles.id],
  }),
  signatures: many(signatures),
  maintenanceRecord: one(maintenanceRecords, {
    fields: [occurrences.id],
    references: [maintenanceRecords.occurrenceId],
  }),
  photos: many(photos),
}));

export const signaturesRelations = relations(signatures, ({ one }) => ({
  occurrence: one(occurrences, {
    fields: [signatures.occurrenceId],
    references: [occurrences.id],
  }),
  user: one(users, { fields: [signatures.userId], references: [users.id] }),
}));

export const checklistItemDefsRelations = relations(
  checklistItemDefs,
  ({ many }) => ({
    items: many(inspectionItems),
  })
);

export const photosRelations = relations(photos, ({ one }) => ({
  inspectionItem: one(inspectionItems, {
    fields: [photos.inspectionItemId],
    references: [inspectionItems.id],
  }),
  occurrence: one(occurrences, {
    fields: [photos.occurrenceId],
    references: [occurrences.id],
  }),
}));
