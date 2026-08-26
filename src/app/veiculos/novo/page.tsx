import Link from "next/link";
import { requireUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { listFiliais, listCondutores } from "@/lib/queries";
import VehicleForm from "../VehicleForm";

export default async function NovoVeiculoPage() {
  const session = await requireUser(["ADMIN"]);
  const [filiais, condutores] = await Promise.all([
    listFiliais(),
    listCondutores(),
  ]);

  return (
    <AppShell session={session}>
      <div className="mb-6">
        <Link href="/veiculos" className="text-sm text-slate-500 hover:underline">
          ← Veículos
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          Novo veículo
        </h1>
      </div>
      <VehicleForm filiais={filiais} condutores={condutores} />
    </AppShell>
  );
}
