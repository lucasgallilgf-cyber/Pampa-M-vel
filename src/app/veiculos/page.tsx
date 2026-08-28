import Link from "next/link";
import { requireUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import Badge from "@/components/Badge";
import { listVehicles, listFiliais } from "@/lib/queries";
import { formatKm } from "@/lib/domain";
import DeleteVehicleButton from "./DeleteVehicleButton";

export default async function VeiculosPage(props: PageProps<"/veiculos">) {
  const session = await requireUser(["ADMIN", "GERENTE", "SUPERVISOR"]);
  const searchParams = await props.searchParams;
  const filialId =
    typeof searchParams.filial === "string" ? searchParams.filial : undefined;
  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;

  const [vehicles, filiais] = await Promise.all([
    listVehicles({ filialId, q }),
    listFiliais(),
  ]);

  const canChecklist = session.role === "ADMIN" || session.role === "SUPERVISOR";
  const isAdmin = session.role === "ADMIN";

  return (
    <AppShell session={session}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Veículos</h1>
          <p className="text-sm text-slate-500">
            {vehicles.length} veículo{vehicles.length !== 1 && "s"} encontrado
            {vehicles.length !== 1 && "s"}
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
          <select
            name="filial"
            defaultValue={filialId ?? ""}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
          >
            <option value="">Todas as filiais</option>
            {filiais.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Filtrar
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
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
    </AppShell>
  );
}
