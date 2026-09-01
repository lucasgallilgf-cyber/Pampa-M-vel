import Link from "next/link";
import { requireUser, scopedFilialId } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import Badge from "@/components/Badge";
import { listOccurrences } from "@/lib/queries";
import {
  OCCURRENCE_STATUS_LABELS,
  OCCURRENCE_STATUS_STYLES,
} from "@/lib/domain";

export default async function OcorrenciasPage(
  props: PageProps<"/ocorrencias">
) {
  const session = await requireUser();
  const searchParams = await props.searchParams;
  const status =
    typeof searchParams.status === "string"
      ? (searchParams.status as "PENDENTE" | "EM_ANDAMENTO" | "RESOLVIDA")
      : undefined;

  const occurrences = await listOccurrences({
    status,
    filialId: scopedFilialId(session),
  });

  const filters: { label: string; value?: typeof status }[] = [
    { label: "Todas", value: undefined },
    { label: "Pendentes", value: "PENDENTE" },
    { label: "Em andamento", value: "EM_ANDAMENTO" },
    { label: "Resolvidas", value: "RESOLVIDA" },
  ];

  return (
    <AppShell session={session}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Avarias e ocorrências
          </h1>
          <p className="text-sm text-slate-500">
            {occurrences.length} ocorrência{occurrences.length !== 1 && "s"}
          </p>
        </div>
        <div className="flex gap-1">
          {filters.map((f) => (
            <Link
              key={f.label}
              href={f.value ? `/ocorrencias?status=${f.value}` : "/ocorrencias"}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                status === f.value
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100"
              } border border-slate-200`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {occurrences.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-400">
            Nenhuma ocorrência encontrada.
          </p>
        )}
        {occurrences.map((o) => (
          <Link
            key={o.id}
            href={`/ocorrencias/${o.id}`}
            className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-300"
          >
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {o.placa}
                </span>
                <span className="text-xs text-slate-500">
                  {o.modelo} · {o.filialNome}
                </span>
              </div>
              <p className="truncate text-sm text-slate-600">
                {o.description}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-slate-400">
                {o.assinaturasCount}/3 assinaturas
              </span>
              <Badge className={OCCURRENCE_STATUS_STYLES[o.status]}>
                {OCCURRENCE_STATUS_LABELS[o.status]}
              </Badge>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
