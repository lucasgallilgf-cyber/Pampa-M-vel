import Link from "next/link";
import {
  requireUser,
  getAllowedFilialIds,
  resolveFilialFilter,
} from "@/lib/auth";
import AppShell from "@/components/AppShell";
import Badge from "@/components/Badge";
import {
  listVehicles,
  listFiliais,
  listDistinctModelos,
  listDistinctCentrosCusto,
} from "@/lib/queries";
import { formatKm } from "@/lib/domain";
import DeleteVehicleButton from "./DeleteVehicleButton";

function strParam(v: string | string[] | undefined) {
  return typeof v === "string" && v !== "" ? v : undefined;
}

export default async function VeiculosPage(props: PageProps<"/veiculos">) {
  const session = await requireUser(["ADMIN", "GERENTE", "SUPERVISOR"]);
  const allowedFilialIds = await getAllowedFilialIds(session);
  // Fixo: supervisor com 0 ou 1 filial (não há o que escolher).
  const isFixedFilial = allowedFilialIds !== null && allowedFilialIds.length <= 1;
  // Múltiplas filiais liberadas pro supervisor: mostra um seletor limitado a elas.
  const isMultiFilial = allowedFilialIds !== null && allowedFilialIds.length > 1;
  const searchParams = await props.searchParams;
  const requestedFilial = strParam(searchParams.filial);
  const filialIds = resolveFilialFilter(allowedFilialIds, requestedFilial);
  const q = strParam(searchParams.q);
  const modelo = strParam(searchParams.modelo);
  const centroCusto = strParam(searchParams.centroCusto);
  const status = strParam(searchParams.status) as
    | "conferido"
    | "pendente"
    | undefined;
  const avarias = strParam(searchParams.avarias) as "com" | "sem" | undefined;

  const [vehicles, filiais, modelos, centrosCusto] = await Promise.all([
    listVehicles({ filialIds, q, modelo, centroCusto, status, avarias }),
    listFiliais(),
    listDistinctModelos(),
    listDistinctCentrosCusto(),
  ]);

  const canChecklist = session.role === "ADMIN" || session.role === "SUPERVISOR";
  const isAdmin = session.role === "ADMIN";

  const fixedFilialId = isFixedFilial ? allowedFilialIds![0] ?? null : null;
  const minhasFiliais = allowedFilialIds
    ? filiais.filter((f) => allowedFilialIds.includes(f.id))
    : [];

  const hasFilter = Boolean(
    (!isFixedFilial && requestedFilial) || q || modelo || centroCusto || status || avarias
  );
  const totals = {
    conferidos: vehicles.filter((v) => v.conferidoEsteMes).length,
    pendentes: vehicles.filter((v) => !v.conferidoEsteMes).length,
    comAvaria: vehicles.filter((v) => v.avariasAbertas > 0).length,
    kmTotal: vehicles.reduce((acc, v) => acc + v.kmAtual, 0),
  };

  return (
    <AppShell session={session}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Veículos</h1>
          <p className="text-sm text-slate-500">
            {vehicles.length} veículo{vehicles.length !== 1 && "s"} encontrado
            {vehicles.length !== 1 && "s"}
            {isFixedFilial &&
              ` · Filial: ${
                fixedFilialId
                  ? filiais.find((f) => f.id === fixedFilialId)?.nome ?? "—"
                  : "—"
              }`}
            {isMultiFilial &&
              ` · Filial: ${
                requestedFilial
                  ? filiais.find((f) => f.id === requestedFilial)?.nome ?? "—"
                  : "Todas as suas filiais"
              }`}
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Link
              href="/veiculos/importar"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Importar planilha
            </Link>
            <Link
              href="/veiculos/novo"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Novo veículo
            </Link>
          </div>
        )}

        <form className="flex flex-wrap items-center gap-2" method="GET">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar placa ou modelo…"
            className="w-52 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
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
            name="modelo"
            defaultValue={modelo ?? ""}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
          >
            <option value="">Todos os modelos</option>
            {modelos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            name="centroCusto"
            defaultValue={centroCusto ?? ""}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
          >
            <option value="">Todos os centros de custo</option>
            {centrosCusto.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__SEM__">Sem centro de custo</option>
          </select>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
          >
            <option value="">Status do mês (todos)</option>
            <option value="conferido">Conferido</option>
            <option value="pendente">Pendente</option>
          </select>
          <select
            name="avarias"
            defaultValue={avarias ?? ""}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
          >
            <option value="">Avarias (todas)</option>
            <option value="com">Com avaria aberta</option>
            <option value="sem">Sem avaria aberta</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Filtrar
          </button>
          {hasFilter && (
            <Link
              href="/veiculos"
              className="text-sm font-medium text-slate-500 hover:underline"
            >
              Limpar filtros
            </Link>
          )}
        </form>
      </div>

      {/* Mobile: card list with a prominent checklist button per vehicle —
          the table below is unreadable and its actions column falls off
          screen on narrow viewports, so small screens get this instead. */}
      <div className="space-y-3 md:hidden">
        {vehicles.map((v) => (
          <div
            key={v.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{v.placa}</p>
                <p className="text-sm text-slate-600">
                  {v.marca} {v.modelo}
                </p>
                <p className="text-xs text-slate-500">{v.filialNome}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {v.conferidoEsteMes ? (
                  <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20">
                    Conferido
                  </Badge>
                ) : (
                  <Badge className="bg-amber-50 text-amber-700 ring-amber-600/20">
                    Pendente
                  </Badge>
                )}
                {v.avariasAbertas > 0 && (
                  <Badge className="bg-red-50 text-red-700 ring-red-600/20">
                    {v.avariasAbertas} avaria{v.avariasAbertas !== 1 && "s"}
                  </Badge>
                )}
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500">
              <p>KM atual: {formatKm(v.kmAtual)}</p>
              {v.centroCusto && <p>Centro de custo: {v.centroCusto}</p>}
              {v.condutorNome && <p>Condutor: {v.condutorNome}</p>}
            </div>

            {canChecklist && (
              <Link
                href={`/veiculos/${v.id}/checklist`}
                className="mb-2 block w-full rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-slate-800"
              >
                Iniciar checklist
              </Link>
            )}

            <div className="flex items-center justify-between text-sm">
              <Link
                href={`/veiculos/${v.id}`}
                className="font-medium text-slate-700 hover:underline"
              >
                Ver detalhes
              </Link>
              {isAdmin && (
                <span className="flex items-center gap-3">
                  <Link
                    href={`/veiculos/${v.id}/editar`}
                    className="font-medium text-slate-700 hover:underline"
                  >
                    Editar
                  </Link>
                  <DeleteVehicleButton id={v.id} placa={v.placa} />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop / tablet: full table, scrolls horizontally instead of
          clipping columns when the viewport is too narrow for all of them. */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Placa</th>
              <th className="px-4 py-2.5">Modelo</th>
              <th className="px-4 py-2.5">Filial</th>
              <th className="px-4 py-2.5">Centro de custo</th>
              <th className="px-4 py-2.5">Condutor</th>
              <th className="px-4 py-2.5">KM atual</th>
              <th className="px-4 py-2.5">Status do mês</th>
              <th className="px-4 py-2.5">Avarias abertas</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vehicles.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  {v.placa}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {v.marca} {v.modelo}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{v.filialNome}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {v.centroCusto ?? <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {v.condutorNome ?? <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {formatKm(v.kmAtual)}
                </td>
                <td className="px-4 py-2.5">
                  {v.conferidoEsteMes ? (
                    <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20">
                      Conferido
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-50 text-amber-700 ring-amber-600/20">
                      Pendente
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {v.avariasAbertas > 0 ? (
                    <Badge className="bg-red-50 text-red-700 ring-red-600/20">
                      {v.avariasAbertas}
                    </Badge>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/veiculos/${v.id}`}
                    className="font-medium text-slate-700 hover:underline"
                  >
                    Ver
                  </Link>
                  {canChecklist && (
                    <>
                      {" · "}
                      <Link
                        href={`/veiculos/${v.id}/checklist`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        Checklist
                      </Link>
                    </>
                  )}
                  {isAdmin && (
                    <>
                      {" · "}
                      <Link
                        href={`/veiculos/${v.id}/editar`}
                        className="font-medium text-slate-700 hover:underline"
                      >
                        Editar
                      </Link>
                      {" · "}
                      <DeleteVehicleButton id={v.id} placa={v.placa} />
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {vehicles.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <span className="font-semibold text-slate-900">
            {hasFilter ? "Total filtrado: " : "Total: "}
            {vehicles.length} veículo{vehicles.length !== 1 && "s"}
          </span>
          <span className="text-emerald-700">
            {totals.conferidos} conferido{totals.conferidos !== 1 && "s"}
          </span>
          <span className="text-amber-700">
            {totals.pendentes} pendente{totals.pendentes !== 1 && "s"}
          </span>
          <span className="text-red-700">
            {totals.comAvaria} com avaria{totals.comAvaria !== 1 && "s"}
          </span>
          <span className="text-slate-600">
            KM total: {formatKm(totals.kmTotal)}
          </span>
        </div>
      )}
    </AppShell>
  );
}
