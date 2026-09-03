export const OCCURRENCE_STATUS_LABELS = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  RESOLVIDA: "Resolvida",
} as const;

export const OCCURRENCE_STATUS_STYLES = {
  PENDENTE: "bg-amber-50 text-amber-700 ring-amber-600/20",
  EM_ANDAMENTO: "bg-blue-50 text-blue-700 ring-blue-600/20",
  RESOLVIDA: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
} as const;

export const ITEM_STATUS_LABELS = {
  OK: "OK",
  AVARIA: "Avaria",
  NAO_APLICAVEL: "N/A",
} as const;

export const ROLE_LABELS = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  SUPERVISOR: "Supervisor Administrativo",
  CONDUTOR: "Condutor",
} as const;

export const SIGNATURE_ROLE_LABELS = {
  CONDUTOR: "Condutor",
  SUPERVISOR: "Supervisor Administrativo",
  GERENTE: "Gerente",
} as const;

export const SIGNATURE_ORDER: ("CONDUTOR" | "SUPERVISOR" | "GERENTE")[] = [
  "CONDUTOR",
  "SUPERVISOR",
  "GERENTE",
];

export const CHECKLIST_CATEGORIES: { category: string; items: string[] }[] = [
  {
    category: "Pneus e rodas",
    items: [
      "Pneu dianteiro esquerdo",
      "Pneu dianteiro direito",
      "Pneu traseiro esquerdo",
      "Pneu traseiro direito",
      "Estepe",
      "Calibragem geral",
    ],
  },
  {
    category: "Freios e suspensão",
    items: ["Freios", "Freio de mão", "Suspensão"],
  },
  {
    category: "Luzes e sinalização",
    items: [
      "Farol dianteiro",
      "Lanterna traseira",
      "Seta / pisca-alerta",
      "Luz de freio",
    ],
  },
  {
    category: "Fluidos",
    items: ["Nível de óleo", "Água do radiador", "Fluido de freio"],
  },
  {
    category: "Carroceria e vidros",
    items: [
      "Lataria / pintura",
      "Para-brisa",
      "Retrovisores",
      "Portas e travas",
    ],
  },
  {
    category: "Documentação e itens obrigatórios",
    items: ["Triângulo / macaco", "Extintor", "CRLV / documentação"],
  },
  {
    category: "Interior",
    items: ["Bancos e cintos", "Painel / instrumentos", "Ar-condicionado"],
  },
];

export const REVISION_STATUS_LABELS = {
  PENDENTE: "Pendente",
  FEITO: "Feito",
} as const;

export const REVISION_STATUS_STYLES = {
  PENDENTE: "bg-red-50 text-red-700 ring-red-600/20",
  FEITO: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
} as const;

// Intervalo de revisão preventiva: a cada 10.000 km (10k, 20k, 30k...).
export const REVISION_INTERVAL_KM = 10000;

/** Próximo marco de revisão (múltiplo de 10.000) a partir do km atual. */
export function nextRevisionKm(kmAtual: number): number {
  return Math.max(
    REVISION_INTERVAL_KM,
    Math.ceil(kmAtual / REVISION_INTERVAL_KM) * REVISION_INTERVAL_KM
  );
}

// Marcos de revisão oferecidos pra marcação manual (no checklist e no
// painel de Revisões): 10k, 20k, 30k... até 300k.
export const REVISION_MILESTONES: number[] = Array.from(
  { length: 30 },
  (_, i) => (i + 1) * REVISION_INTERVAL_KM
);

// Distância (em km) até o próximo marco a partir da qual ele já entra como
// "próxima revisão" nos alertas (painel de Revisões e dashboard).
export const REVISION_PROXIMA_LIMIAR_KM = 2000;

export function formatKm(km: number): string {
  return `${km.toLocaleString("pt-BR")} km`;
}

export function currentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}
