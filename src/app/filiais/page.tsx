import Link from "next/link";
import { requireUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { listFiliaisWithCounts } from "@/lib/queries";
import FilialForm from "./FilialForm";
import DeleteFilialButton from "./DeleteFilialButton";

export default async function FiliaisPage() {
  const session = await requireUser(["ADMIN"]);
  const filiais = await listFiliaisWithCounts();

  return (
    <AppShell session={session}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Filiais</h1>
          <p className="text-sm text-slate-500">
            Cadastro das filiais da frota.
          </p>
        </div>
        <Link
          href="/admin/limpar-dados"
          className="whitespace-nowrap text-sm text-red-600 hover:underline"
        >
          Limpar dados de exemplo
        </Link>
      </div>

      <div className="mb-6">
        <FilialForm />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Nome</th>
              <th className="px-4 py-2.5">Código</th>
              <th className="px-4 py-2.5">Veículos</th>
              <th className="px-4 py-2.5">Usuários</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filiais.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  {f.nome}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{f.codigo}</td>
                <td className="px-4 py-2.5 text-slate-600">{f.veiculos}</td>
                <td className="px-4 py-2.5 text-slate-600">{f.usuarios}</td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/filiais/${f.id}/editar`}
                    className="font-medium text-slate-700 hover:underline"
                  >
                    Editar
                  </Link>
                  {" · "}
                  <DeleteFilialButton
                    id={f.id}
                    nome={f.nome}
                    veiculos={f.veiculos}
                    usuarios={f.usuarios}
                  />
                </td>
              </tr>
            ))}
            {filiais.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-slate-400"
                >
                  Nenhuma filial cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
