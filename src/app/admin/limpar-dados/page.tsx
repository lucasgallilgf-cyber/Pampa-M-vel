import Link from "next/link";
import { requireUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { getExampleDataSummary } from "@/lib/queries";
import ClearDataForm from "./ClearDataForm";

export default async function LimparDadosPage() {
  const session = await requireUser(["ADMIN"]);
  const summary = await getExampleDataSummary(session.id);

  return (
    <AppShell session={session}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link href="/filiais" className="text-sm text-slate-500 hover:underline">
            ← Filiais
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            Limpar dados de exemplo
          </h1>
          <p className="text-sm text-slate-500">
            Apaga tudo o que está cadastrado hoje — pensado para usar uma
            única vez, antes de cadastrar as filiais reais e importar a
            planilha de veículos. Sua própria conta não é afetada.
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Isso vai apagar
          </h2>
          <ul className="space-y-1 text-sm text-slate-700">
            <li>{summary.filiais} filial(is)</li>
            <li>{summary.veiculos} veículo(s)</li>
            <li>{summary.usuarios} usuário(s) (sua conta fica de fora)</li>
            <li>{summary.checklists} checklist(s) registrados</li>
            <li>{summary.ocorrencias} avaria(s)/ocorrência(s)</li>
          </ul>
        </div>

        <ClearDataForm />
      </div>
    </AppShell>
  );
}
