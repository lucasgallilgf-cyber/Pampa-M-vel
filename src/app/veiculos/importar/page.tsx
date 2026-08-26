import Link from "next/link";
import { requireUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import ImportForm from "./ImportForm";

export default async function ImportarVeiculosPage() {
  const session = await requireUser(["ADMIN"]);

  return (
    <AppShell session={session}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link href="/veiculos" className="text-sm text-slate-500 hover:underline">
            ← Veículos
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            Importar veículos de planilha
          </h1>
          <p className="text-sm text-slate-500">
            Cadastre várias vezes rapidamente a partir de uma planilha Excel ou
            CSV. Certifique-se de já ter cadastrado as filiais correspondentes
            em <Link href="/filiais" className="underline">/filiais</Link>{" "}
            antes de importar.
          </p>
        </div>
        <ImportForm />
      </div>
    </AppShell>
  );
}
