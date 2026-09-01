import Link from "next/link";
import { requireUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import Badge from "@/components/Badge";
import { listVehiclesForCondutor, listRecentInspectionsByUser } from "@/lib/queries";
import { formatKm } from "@/lib/domain";

export default async function MeuVeiculoPage() {
  const session = await requireUser(["CONDUTOR"]);
  const [vehicles, recentInspections] = await Promise.all([
    listVehiclesForCondutor(session.id),
    listRecentInspectionsByUser(session.id, 5),
  ]);

  return (
    <AppShell session={session}>
      <div className="mx-auto max-w-lg">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">
          Meu veículo
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Faça a conferência mensal do veículo designado a você direto pelo
          celular.
        </p>

        {vehicles.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-400">
            Nenhum veículo está designado a você no momento. Fale com seu
            supervisor para vincular um veículo ao seu usuário.
          </p>
        )}

        <div className="space-y-3">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    {v.placa}
                  </p>
                  <p className="text-sm text-slate-500">
                    {v.marca} {v.modelo} · {v.filialNome}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatKm(v.kmAtual)}
                  </p>
                </div>
                {v.conferidoEsteMes ? (
                  <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20">
                    Conferido este mês
                  </Badge>
                ) : (
                  <Badge className="bg-amber-50 text-amber-700 ring-amber-600/20">
                    Pendente este mês
                  </Badge>
                )}
              </div>
              <Link
                href={`/veiculos/${v.id}/checklist`}
                className="block w-full rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-slate-800"
              >
                {v.conferidoEsteMes
                  ? "Fazer nova conferência"
                  : "Iniciar checklist mensal"}
              </Link>
            </div>
          ))}
        </div>

        {recentInspections.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Minhas últimas conferências
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              Errou algo em um checklist? Abra e exclua para refazer.
            </p>
            <div className="space-y-2">
              {recentInspections.map((i) => (
                <Link
                  key={i.id}
                  href={`/veiculos/${i.vehicleId}/checklist/${i.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-slate-300"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {i.placa} ·{" "}
                      {new Date(i.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}{" "}
                      · {formatKm(i.km)}
                    </p>
                  </div>
                  {i.status === "COM_AVARIA" ? (
                    <Badge className="bg-red-50 text-red-700 ring-red-600/20">
                      Com avaria
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20">
                      OK
                    </Badge>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
