import Link from "next/link";
import {
  getSession,
  getAllowedFilialIds,
  resolveFilialFilter,
} from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import StatTile from "@/components/StatTile";
import Badge from "@/components/Badge";
import {
  getDashboardStats,
  getDashboardByFilial,
  getDashboardByPeriod,
  getVehicleCountByCentroCusto,
  getVehicleCountByModelo,
  pendingVehiclesThisMonth,
  listOccurrencesForCondutor,
  listVehiclesForCondutor,
  listFiliais,
  getRevisionAlertSummary,
} from "@/lib/queries";
import {
  formatKm,
  OCCURRENCE_STATUS_LABELS,
  OCCURRENCE_STATUS_STYLES,
} from "@/lib/domain";
import { FilialBarChart, PeriodLineChart } from "@/components/DashboardCharts";
import CountBarList from "@/components/CountBarList";

export default async function HomePage(props: PageProps<"/">) {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role === "CONDUTOR") {
    const [occurrences, myVehicles] = await Promise.all([
      listOccurrencesForCondutor(session.id),
      listVehiclesForCondutor(session.id),
    ]);
    const pendentes = myVehicles.filter((v) => !v.conferidoEsteMes);
    return (
      <AppShell session={session}>
        <h1 className="mb-1 text-xl font-semibold text-slate-900">
          Olá, {session.name.split(" ")[0]}
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Ocorrências dos veículos sob sua responsabilidade.
        </p>

        {pendentes.length > 0 && (
          <Link
            href="/meu-veiculo"
            className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 hover:border-amber-300"
          >
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {pendentes.length === 1
                  ? `${pendentes[0].placa} ainda não foi conferido este mês`
                  : `${pendentes.length} veículos ainda não foram conferidos este mês`}
              </p>
              <p className="text-xs text-amber-700">
                Toque para iniciar o checklist mensal pelo celular.
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white">
              Iniciar checklist
            </span>
          </Link>
        )}

        <div className="space-y-2">
          {occurrences.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-400">
              Nenhuma ocorrência no momento.
            </p>
          )}
          {occurrences.map((o) => (
            <Link
              key={o.id}
              href={`/ocorrencias/${o.id}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-300"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {o.placa} · {o.modelo}
                </p>
                <p className="truncate text-sm text-slate-600">
                  {o.description}
                </p>
              </div>
              <Badge className={OCCURRENCE_STATUS_STYLES[o.status]}>
                {OCCURRENCE_STATUS_LABELS[o.status]}
              </Badge>
            </Link>
          ))}
        </div>
      </AppShell>
    );
  }

  const allowedFilialIds = await getAllowedFilialIds(session);
  const isFixedFilial = allowedFilialIds !== null && allowedFilialIds.length <= 1;
  const isMultiFilial = allowedFilialIds !== null && allowedFilialIds.length > 1;
  const searchParams = await props.searchParams;
  const requestedFilial =
    typeof searchParams.filial === "string" ? searchParams.filial : undefined;
  const filialIds = resolveFilialFilter(allowedFilialIds, requestedFilial);

  const [
    stats,
    byFilial,
    byPeriod,
    byCentroCusto,
    byModelo,
    pendingVehicles,
    filiais,
    revisionAlert,
  ] = await Promise.all([
    getDashboardStats({ filialIds }),
    getDashboardByFilial({ filialIds }),
    getDashboardByPeriod(6, { filialIds }),
    getVehicleCountByCentroCusto({ filialIds }),
    getVehicleCountByModelo({ filialIds }),
    pendingVehiclesThisMonth(8, { filialIds }),
    listFiliais(),
    getRevisionAlertSummary({ filialIds, limit: 8 }),
  ]);

  const fixedFilialId = isFixedFilial ? allowedFilialIds![0] ?? null : null;
  const minhasFiliais = allowedFilialIds
    ? filiais.filter((f) => allowedFilialIds.includes(f.id))
    : [];

  const frotaPorFilial = byFilial
    .map((f) => ({ label: f.filialNome, count: f.totalVeiculos }))
    .sort((a, b) => b.count - a.count);
  const frotaPorCentroCusto = byCentroCusto.map((c) => ({
    label: c.centroCusto,
    count: c.total,
  }));
  const frotaPorModelo = byModelo.map((m) => ({
    label: m.modelo,
    count: m.total,
  }));

  return (
    <AppShell session={session}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Como está a minha frota hoje?
          </h1>
          <p className="text-sm text-slate-500">
            Visão geral atualizada automaticamente a cada conferência.
          </p>
        </div>
        {isFixedFilial ? (
          <p className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600">
            Filial:{" "}
            {fixedFilialId
              ? filiais.find((f) => f.id === fixedFilialId)?.nome ?? "—"
              : "—"}
          </p>
        ) : (
          <form method="GET" className="flex items-center gap-2">
            <select
              name="filial"
              defaultValue={requestedFilial ?? ""}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
            >
              <option value="">
                {isMultiFilial ? "Todas as minhas filiais" : "Todas as filiais"}
              </option>
              {(isMultiFilial ? minhasFiliais : filiais).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Aplicar
            </button>
          </form>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Total de veículos" value={String(stats.totalVeiculos)} />
        <StatTile
          label="Conferidos no mês"
          value={String(stats.conferidos)}
          tone="good"
        />
        <StatTile
          label="Pendentes"
          value={String(stats.pendentes)}
          tone="warning"
        />
        <StatTile
          label="% de conclusão"
          value={`${stats.percentualConclusao}%`}
        />
        <StatTile label="Quilometragem total" value={formatKm(stats.kmTotal)} />
        <StatTile
          label="Veículos com avaria"
          value={String(stats.comAvaria)}
          tone="critical"
        />
        <StatTile label="Total de avarias" value={String(stats.totalAvarias)} />
        <StatTile
          label="Avarias resolvidas"
          value={String(stats.avariasResolvidas)}
          tone="good"
        />
        <StatTile
          label="Avarias pendentes"
          value={String(stats.avariasPendentes)}
          tone="warning"
        />
        <StatTile
          label="Revisões próximas/pendentes"
          value={String(revisionAlert.totalProximas)}
          tone={revisionAlert.totalProximas > 0 ? "critical" : "good"}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Conferências por filial
          </h2>
          <FilialBarChart data={byFilial} />
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Conferidos e avarias por período
          </h2>
          <PeriodLineChart data={byPeriod} />
        </section>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Frota por filial
          </h2>
          <CountBarList items={frotaPorFilial} />
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Frota por centro de custo
          </h2>
          <CountBarList items={frotaPorCentroCusto} />
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Frota por modelo
          </h2>
          <CountBarList items={frotaPorModelo} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Indicadores por filial
          </h2>
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Filial</th>
                  <th className="px-3 py-2">Conferidos</th>
                  <th className="px-3 py-2">Pendentes</th>
                  <th className="px-3 py-2">% conclusão</th>
                  <th className="px-3 py-2">Avarias abertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byFilial.map((f) => (
                  <tr key={f.filialId}>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {f.filialNome}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {f.conferidos}/{f.totalVeiculos}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{f.pendentes}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {f.percentualConclusao}%
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {f.avariasAbertas}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Veículos ainda não conferidos no mês
            </h2>
            <Link
              href="/veiculos"
              className="text-xs font-medium text-slate-500 hover:underline"
            >
              Ver todos
            </Link>
          </div>
          <div className="space-y-1">
            {pendingVehicles.length === 0 && (
              <p className="px-1 py-4 text-center text-sm text-slate-400">
                Todos os veículos foram conferidos este mês.
              </p>
            )}
            {pendingVehicles.map((v) => (
              <Link
                key={v.id}
                href={`/veiculos/${v.id}`}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-800">{v.placa}</span>
                <span className="text-slate-500">
                  {v.modelo} · {v.filialNome}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Revisões próximas ou pendentes
          </h2>
          <Link
            href="/revisoes"
            className="text-xs font-medium text-slate-500 hover:underline"
          >
            Ver todas
          </Link>
        </div>
        <div className="space-y-1">
          {revisionAlert.proximas.length === 0 && (
            <p className="px-1 py-4 text-center text-sm text-slate-400">
              Nenhuma revisão próxima no momento.
            </p>
          )}
          {revisionAlert.proximas.map((r) => (
            <Link
              key={r.vehicleId}
              href={`/veiculos/${r.vehicleId}`}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
            >
              <span className="font-medium text-slate-800">{r.placa}</span>
              <span className="text-slate-500">
                {r.modelo} · {r.filialNome} · faltam{" "}
                {formatKm(Math.max(0, r.kmAlvo - r.kmAtual))} para{" "}
                {formatKm(r.kmAlvo)}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
