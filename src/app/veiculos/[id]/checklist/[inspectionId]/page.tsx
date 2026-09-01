import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import Badge from "@/components/Badge";
import { getInspectionDetail } from "@/lib/queries";
import { formatKm, ITEM_STATUS_LABELS } from "@/lib/domain";
import DeleteInspectionButton from "./DeleteInspectionButton";

const STATUS_STYLES: Record<string, string> = {
  OK: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  AVARIA: "bg-red-50 text-red-700 ring-red-600/20",
  NAO_APLICAVEL: "bg-slate-100 text-slate-600 ring-slate-500/10",
};

const OVERSIGHT_ROLES = ["ADMIN", "GERENTE", "SUPERVISOR"];

export default async function InspectionDetailPage(
  props: PageProps<"/veiculos/[id]/checklist/[inspectionId]">
) {
  // Qualquer usuário logado pode acessar — a verificação de quem pode ver
  // (equipe de gestão, ou o próprio autor da conferência) é feita abaixo,
  // já que um condutor precisa conseguir abrir (e excluir) um checklist que
  // ele mesmo fez, mesmo não tendo acesso à tela de veículos.
  const session = await requireUser();
  const { id, inspectionId } = await props.params;
  const data = await getInspectionDetail(inspectionId);
  if (!data || data.inspection.vehicleId !== id) notFound();

  const { inspection, items } = data;

  const isOversight = OVERSIGHT_ROLES.includes(session.role);
  const isOwner = inspection.performedById === session.id;
  if (!isOversight && !isOwner) redirect("/");
  const canDelete = session.role === "ADMIN" || isOwner;

  const categories = Array.from(new Set(items.map((i) => i.category ?? "Outros")));
  const totalFotos = items.reduce((acc, i) => acc + i.photos.length, 0);

  return (
    <AppShell session={session}>
      <div className="mx-auto max-w-3xl">
        <Link
          href={isOversight ? `/veiculos/${id}` : "/meu-veiculo"}
          className="text-sm text-slate-500 hover:underline"
        >
          ← {inspection.placa}
        </Link>

        <div className="mt-1 mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Conferência de{" "}
              {new Date(inspection.createdAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </h1>
            <p className="text-sm text-slate-500">
              {inspection.placa} · {inspection.modelo} ·{" "}
              {formatKm(inspection.km)} · Conferido por{" "}
              {inspection.performedByNome}
              {totalFotos > 0 &&
                ` · ${totalFotos} foto${totalFotos !== 1 ? "s" : ""}`}
            </p>
          </div>
          {canDelete && <DeleteInspectionButton id={inspection.id} />}
        </div>

        <div className="space-y-6">
          {categories.map((category) => (
            <div
              key={category}
              className="rounded-xl border border-slate-200 bg-white"
            >
              <div className="border-b border-slate-100 px-4 py-2.5">
                <h2 className="text-sm font-semibold text-slate-700">
                  {category}
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {items
                  .filter((i) => (i.category ?? "Outros") === category)
                  .map((item) => (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-slate-800">{item.label}</p>
                        <Badge className={STATUS_STYLES[item.status]}>
                          {ITEM_STATUS_LABELS[
                            item.status as keyof typeof ITEM_STATUS_LABELS
                          ] ?? item.status}
                        </Badge>
                      </div>
                      {item.notes && (
                        <p className="mt-1 text-sm text-slate-600">
                          {item.notes}
                        </p>
                      )}
                      {item.photos.length > 0 && (
                        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {item.photos.map((p) => (
                            <a
                              key={p.id}
                              href={p.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.url}
                                alt={`Foto — ${item.label}`}
                                className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
