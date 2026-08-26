import Link from "next/link";
import { requireUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import Badge from "@/components/Badge";
import { listMaintenanceRecords } from "@/lib/queries";
import {
  OCCURRENCE_STATUS_LABELS,
  OCCURRENCE_STATUS_STYLES,
} from "@/lib/domain";

export default async function ManutencaoPage(
  props: PageProps<"/manutencao">
) {
  const session = await requireUser(["ADMIN", "GERENTE", "SUPERVISOR"]);
  const searchParams = await props.searchParams;
  const status =
    typeof searchParams.status === "string"
      ? (searchParams.status as "PENDENTE" | "EM_ANDAMENTO" | "RESOLVIDA")
      : undefined;

  const records = await listMaintenanceRecords({ status });

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
          <h1 className="text-xl font-semibold text-slate-900">Manutenção</h1>
          <p className="text-sm text-slate-500">
            {records.length} registro{records.length !== 1 && "s"} de manutenção
          </p>
        </div>
        <div className="flex gap-1">
          {filters.map((f) => (
            <Link
              key={f.label}
              href={f.value ? `/manutencao?status=${f.value}` : "/manutencao"}
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Veículo</th>
              <th className="px-4 py-2.5">Filial</th>
              <th className="px-4 py-2.5">Descrição</th>
              <th className="px-4 py-2.5">Aberto em</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  {r.placa}
                  <span className="ml-1 font-normal text-slate-500">
                    {r.modelo}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{r.filialNome}</td>
                <td className="max-w-sm truncate px-4 py-2.5 text-slate-600">
                  {r.description}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-2.5">
                  <Badge className={OCCURRENCE_STATUS_STYLES[r.status]}>
                    {OCCURRENCE_STATUS_LABELS[r.status]}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/ocorrencias/${r.occurrenceId}`}
                    className="font-medium text-slate-700 hover:underline"
                  >
                    Ver ocorrência
                  </Link>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Nenhum registro de manutenção.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
