import { notFound } from "next/navigation";
import { getSignatureLinkDetail } from "@/lib/queries";
import { SIGNATURE_ORDER, SIGNATURE_ROLE_LABELS } from "@/lib/domain";
import SignatureLinkSignForm from "./SignatureLinkSignForm";

export default async function SignViaLinkPage(
  props: PageProps<"/assinar/[token]">
) {
  const { token } = await props.params;
  const data = await getSignatureLinkDetail(token);
  if (!data) notFound();

  const { link, occurrence, signatures, avariaItems, photos } = data;

  const existingSig = signatures.find((s) => s.role === link.role);
  const expired = link.expiresAt ? new Date(link.expiresAt) < new Date() : false;
  const signedRoles = new Set(signatures.map((s) => s.role));
  const stepIndex = SIGNATURE_ORDER.indexOf(link.role);
  const priorSigned = SIGNATURE_ORDER.slice(0, stepIndex).every((r) =>
    signedRoles.has(r)
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Assinatura de ocorrência
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {occurrence.placa} · {occurrence.modelo}
          </h1>
          <p className="text-sm text-slate-500">
            {occurrence.filialNome} ·{" "}
            {new Date(occurrence.createdAt).toLocaleDateString("pt-BR")}
          </p>
        </div>

        <div className="space-y-4">
          {occurrence.relato && (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Relato do ocorrido
              </h2>
              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {occurrence.relato}
              </p>
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Itens com avaria
            </h2>
            <ul className="space-y-1">
              {avariaItems.map((item) => (
                <li key={item.id} className="text-sm text-slate-700">
                  <span className="font-medium">{item.label}</span>
                  {item.notes ? ` — ${item.notes}` : ""}
                </li>
              ))}
            </ul>
          </section>

          {photos.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Evidências
              </h2>
              <div className="grid grid-cols-3 gap-2">
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

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Assinatura de {SIGNATURE_ROLE_LABELS[link.role]} — {link.userNome}
            </h2>

            {existingSig ? (
              <div>
                <p className="mb-2 text-sm text-emerald-700">
                  Já assinado por {existingSig.userNameSnap} em{" "}
                  {new Date(existingSig.signedAt).toLocaleString("pt-BR")}.
                </p>
                {existingSig.signatureImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={existingSig.signatureImageUrl}
                    alt="Assinatura"
                    className="h-16 rounded border border-slate-100 bg-white"
                  />
                )}
              </div>
            ) : expired ? (
              <p className="text-sm text-red-600">
                Este link expirou. Peça para gerar um novo na página da
                ocorrência.
              </p>
            ) : !priorSigned ? (
              <p className="text-sm text-amber-600">
                Aguardando a assinatura da etapa anterior antes desta.
              </p>
            ) : (
              <SignatureLinkSignForm token={token} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
