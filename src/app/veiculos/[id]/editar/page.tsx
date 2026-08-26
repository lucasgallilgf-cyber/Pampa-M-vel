import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { listFiliais, listCondutores, getVehicleForEdit } from "@/lib/queries";
import VehicleForm from "../../VehicleForm";

export default async function EditarVeiculoPage(
  props: PageProps<"/veiculos/[id]/editar">
) {
  const session = await requireUser(["ADMIN"]);
  const { id } = await props.params;
  const [filiais, condutores, vehicle] = await Promise.all([
    listFiliais(),
    listCondutores(),
    getVehicleForEdit(id),
  ]);
  if (!vehicle) notFound();

  return (
    <AppShell session={session}>
      <div className="mb-6">
        <Link
          href={`/veiculos/${id}`}
          className="text-sm text-slate-500 hover:underline"
        >
          ← {vehicle.placa}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          Editar veículo
        </h1>
      </div>
      <VehicleForm filiais={filiais} condutores={condutores} vehicle={vehicle} />
    </AppShell>
  );
}
