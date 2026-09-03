import { notFound, redirect } from "next/navigation";
import {
  requireUser,
  getAllowedFilialIds,
  canAccessFilial,
} from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { getVehicleDetail, listChecklistItemDefs } from "@/lib/queries";
import ChecklistForm from "./ChecklistForm";

export default async function ChecklistPage(
  props: PageProps<"/veiculos/[id]/checklist">
) {
  const session = await requireUser(["ADMIN", "SUPERVISOR", "CONDUTOR"]);
  const { id } = await props.params;

  const [data, itemDefs] = await Promise.all([
    getVehicleDetail(id),
    listChecklistItemDefs(),
  ]);
  if (!data) notFound();
  const allowedFilialIds = await getAllowedFilialIds(session);
  if (!canAccessFilial(allowedFilialIds, data.vehicle.filialId)) notFound();

  if (
    session.role === "CONDUTOR" &&
    data.vehicle.assignedCondutorId !== session.id
  ) {
    redirect("/meu-veiculo");
  }

  const categories = Array.from(new Set(itemDefs.map((d) => d.category)));

  return (
    <AppShell session={session}>
      <ChecklistForm
        vehicle={data.vehicle}
        itemDefs={itemDefs}
        categories={categories}
      />
    </AppShell>
  );
}
