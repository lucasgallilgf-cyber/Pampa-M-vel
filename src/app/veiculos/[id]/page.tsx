import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import Badge from "@/components/Badge";
import { getVehicleDetail } from "@/lib/queries";
import { formatKm, OCCURRENCE_STATUS_LABELS, OCCURRENCE_STATUS_STYLES } from "@/lib/domain";

export default async function VehicleDetailPage(
  props: PageProps<"/veiculos/[id]">
) {
  const session = await requireUser(["ADMIN", "GERENTE", "SUPERVISOR"]);
  const { id } = await props.params;
  const data = await getVehicleDetail(id);
  if (!data) notFound();

  const { vehicle, inspections, occurrences } = data;
  const canChecklist = session.role === "ADMIN" || session.role === "SUPERVISOR";

  return (
    <AppShell session={session}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/veiculos"
            className="text-sm text-slate-500 hover:underline"
          >
            ← Veículos
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {vehicle.placa}
          </h1>
          <p className="text-sm text-slate-500">
            {vehicle.marca} {vehicle.modelo}
            {vehicle.anoFabricacao ? ` · ${vehicle.anoFabricacao}` : ""} ·{" "}
            {vehicle.filialNome}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session.role === "ADMIN" && (
            <Link
              href={`/veiculos/${vehicle.id}/editar`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Editar
            </Link>
          )}
          {canChecklist && (
            <Link
              href={`/veiculos/${vehicle.id}/checklist`}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Iniciar checklist
            </Link>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBox label="KM atual" value={formatKm(vehicle.kmAtual)} />
        <StatBox
          label="Condutor designado"
          value={vehicle.assignedCondutorNome ?? "—"}
        />
        <StatBox
          label="Centro de custo"
          value={vehicle.centroCusto ?? "—"}
        />
        <StatBox label="Inspeções registradas" value={String(inspections.length)} />
        <StatBox
          label="Ocorrências"
          value={String(occurrences.length)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Histórico de conferências
          </h2>
          <div className="space-y-2">
            {inspections.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400">
                Nenhuma conferência registrada ainda.
              </p>
            )}
            {inspections.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {new Date(i.createdAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}{" "}
                    · {formatKm(i.km)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Conferido por {i.performedByNome}
                  </p>
                </div>
                {i.status === "COM_AVARIA" ? (
                  <Badge className="bg-red-50 text-red-700 ring-red-600/20">
                    {i.avariasCount} avaria{i.avariasCount !== 1 && "s"}
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20">
                    OK
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Ocorrências
          </h2>
          <div className="space-y-2">
            {occurrences.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400">
                Nenhuma ocorrência registrada.
              </p>
            )}
            {occurrences.map((o) => (
              <Link
                key={o.id}
                href={`/ocorrencias/${o.id}`}
                className="block rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-slate-300"
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                  <Badge className={OCCURRENCE_STATUS_STYLES[o.status]}>
                    {OCCURRENCE_STATUS_LABELS[o.status]}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-sm text-slate-700">
                  {o.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
