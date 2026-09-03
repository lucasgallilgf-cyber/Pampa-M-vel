import Link from "next/link";
import { notFound } from "next/navigation";
import {
  requireUser,
  getAllowedFilialIds,
  canAccessFilial,
} from "@/lib/auth";
import AppShell from "@/components/AppShell";
import Badge from "@/components/Badge";
import { getOccurrenceDetail, listUsers } from "@/lib/queries";
import {
  OCCURRENCE_STATUS_LABELS,
  OCCURRENCE_STATUS_STYLES,
  formatKm,
} from "@/lib/domain";
import SignaturePanel from "./SignaturePanel";

export default async function OccurrenceDetailPage(
  props: PageProps<"/ocorrencias/[id]">
) {
  const session = await requireUser();
  const { id } = await props.params;
  const [data, supervisores, gerentes] = await Promise.all([
    getOccurrenceDetail(id),
    listUsers({ role: "SUPERVISOR" }),
    listUsers({ role: "GERENTE" }),
  ]);
  if (!data) notFound();
  const allowedFilialIds = await getAllowedFilialIds(session);
  if (!canAccessFilial(allowedFilialIds, data.occurrence.filialId)) notFound();

  const { occurrence, signatures, signatureLinks, avariaItems, photos } = data;

  return (
    <AppShell session={session}>
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/veiculos/${occurrence.vehicleId}`}
          className="text-sm text-slate-500 hover:underline"
        >
          ← {occurrence.placa}
        </Link>

        <div className="mt-1 mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Ocorrência — {occurrence.placa}
            </h1>
            <p className="text-sm text-slate-500">
              {occurrence.modelo} · {occurrence.filialNome} ·{" "}
              {occurrence.km != null ? formatKm(occurrence.km) : ""} ·{" "}
              {new Date(occurrence.createdAt).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={OCCURRENCE_STATUS_STYLES[occurrence.status]}>
              {OCCURRENCE_STATUS_LABELS[occurrence.status]}
            </Badge>
            <a
              href={`/ocorrencias/${occurrence.id}/pdf`}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Baixar PDF
            </a>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {occurrence.relato && (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Relato do ocorrido
                </h2>
                <p className="whitespace-pre-wrap text-sm text-slate-700">
                  {occurrence.relato}
                </p>
              </section>
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Descrição
              </h2>
              <p className="text-sm text-slate-700">{occurrence.description}</p>
              {occurrence.status === "RESOLVIDA" && occurrence.resolutionNotes && (
                <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <span className="font-medium">Resolução: </span>
                  {occurrence.resolutionNotes}
                  {occurrence.resolvedAt && (
                    <span className="ml-1 text-emerald-600">
                      (
                      {new Date(occurrence.resolvedAt).toLocaleDateString(
                        "pt-BR"
                      )}
                      )
                    </span>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Itens com avaria
              </h2>
              <ul className="space-y-2">
                {avariaItems.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg bg-red-50/60 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-red-800">
                      {item.label}
                    </span>
                    {item.notes && (
                      <span className="text-red-700"> — {item.notes}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {photos.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Evidências
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={p.id}
                      src={p.url}
                      alt="Evidência da avaria"
                      className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                    />
                  ))}
                </div>
              </section>
            )}
          </div>

          <div>
            <SignaturePanel
              occurrenceId={occurrence.id}
              signatures={signatures}
              signatureLinks={signatureLinks}
              session={session}
              status={occurrence.status}
              vehiclePlaca={occurrence.placa ?? ""}
              performedById={occurrence.performedById}
              performedByNome={occurrence.performedByNome}
              supervisores={supervisores}
              gerentes={gerentes}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
