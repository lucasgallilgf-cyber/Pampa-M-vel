import Link from "next/link";
import {
  requireUser,
  getAllowedFilialIds,
  resolveFilialFilter,
} from "@/lib/auth";
import AppShell from "@/components/AppShell";
import StatTile from "@/components/StatTile";
import { listRevisionRows, listFiliais } from "@/lib/queries";
import { formatKm, REVISION_PROXIMA_LIMIAR_KM } from "@/lib/domain";
import RevisionRow, { RevisionRowData } from "./RevisionRow";

function strParam(v: string | string[] | undefined) {
  return typeof v === "string" && v !== "" ? v : undefined;
}

export default async function RevisoesPage(props: PageProps<"/revisoes">) {
  const session = await requireUser(["ADMIN", "GERENTE", "SUPERVISOR"]);
  const allowedFilialIds = await getAllowedFilialIds(session);
  const isFixedFilial = allowedFilialIds !== null && allowedFilialIds.length <= 1;
  const isMultiFilial = allowedFilialIds !== null && allowedFilialIds.length > 1;
  const searchParams = await props.searchParams;
  const requestedFilial = strParam(searchParams.filial);
  const filialIds = resolveFilialFilter(allowedFilialIds, requestedFilial);
  const q = strParam(searchParams.q);
  const status = strParam(searchParams.status) as
    | "PENDENTE"
    | "FEITO"
    | undefined;
  const periodoInicio = strParam(searchParams.inicio);
  const periodoFim = strParam(searchParams.fim);

  const [vehiclesRows, filiais] = await Promise.all([
    listRevisionRows({ filialIds, q }),
    listFiliais(),
  ]);

  const fixedFilialId = isFixedFilial ? allowedFilialIds![0] ?? null : null;
  const minhasFiliais = allowedFilialIds
    ? filiais.filter((f) => allowedFilialIds.includes(f.id))
    : [];

  let rows: RevisionRowData[] = vehiclesRows;

  if (status) {
    rows = rows.filter((r) => r.status === status);
  }
  if (periodoInicio) {
    const start = new Date(`${periodoInicio}T00:00:00`);
    rows = rows.filter((r) => r.dataRevisao && new Date(r.dataRevisao) >= start);
  }
  if (periodoFim) {
    const end = new Date(`${periodoFim}T23:59:59`);
    rows = rows.filter((r) => r.dataRevisao && new Date(r.dataRevisao) <= end);
  }

  const hasFilter = Boolean(
    (!isFixedFilial && requestedFilial) || q || status || periodoInicio || periodoFim
  );

  const totals = {
    total: rows.length,
    pendentes: rows.filter((r) => r.status === "PENDENTE").length,
    feitas: rows.filter((r) => r.status === "FEITO").length,
    proximas: rows.filter(
      (r) =>
        r.status === "PENDENTE" &&
        r.kmAlvo - r.kmAtual <= REVISION_PROXIMA_LIMIAR_KM
    ).length,
  };

  return (
    <AppShell session={session}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Revisões</h1>
          <p className="text-sm text-slate-500">
            Acompanhamento das revisões preventivas por quilometragem — a
            cada 10.000 km, calculado a partir do KM do último checklist.
          </p>
        </div>

        <form className="flex flex-wrap items-center gap-2" method="GET">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar placa ou modelo…"
            className="w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
          />
          {isFixedFilial ? (
            <input type="hidden" name="filial" value={fixedFilialId ?? ""} />
          ) : isMultiFilial ? (
            <select
              name="filial"
              defaultValue={requestedFilial ?? ""}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
            >
              <option value="">Todas as minhas filiais</option>
              {minhasFiliais.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          ) : (
            <select
              name="filial"
              defaultValue={requestedFilial ?? ""}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
            >
              <option value="">Todas as filiais</option>
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          )}
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
          >
            <option value="">Status (todos)</option>
            <option value="PENDENTE">Pendente</option>
            <option value="FEITO">Feito</option>
          </select>
          <input
            type="date"
            name="inicio"
            defaultValue={periodoInicio ?? ""}
            title="Data da revisão — de"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
          />
          <input
            type="date"
            name="fim"
            defaultValue={periodoFim ?? ""}
            title="Data da revisão — até"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Filtrar
          </button>
          {hasFilter && (
            <Link
              href="/revisoes"
              className="text-sm font-medium text-slate-500 hover:underline"
            >
              Limpar filtros
            </Link>
          )}
        </form>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total de veículos" value={String(totals.total)} />
        <StatTile
          label="Revisões pendentes"
          value={String(totals.pendentes)}
          tone="warning"
        />
        <StatTile
          label="Revisões feitas"
          value={String(totals.feitas)}
          tone="good"
        />
        <StatTile
          label={`Próximas (≤ ${formatKm(REVISION_PROXIMA_LIMIAR_KM)})`}
          value={String(totals.proximas)}
          tone="critical"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Filial</th>
              <th className="px-4 py-2.5">Placa</th>
              <th className="px-4 py-2.5">Modelo</th>
              <th className="px-4 py-2.5">KM último checklist</th>
              <th className="px-4 py-2.5">Próxima revisão</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Data da revisão</th>
              <th className="px-4 py-2.5">Observação</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <RevisionRow key={r.vehicleId} row={r} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                  Nenhum veículo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
