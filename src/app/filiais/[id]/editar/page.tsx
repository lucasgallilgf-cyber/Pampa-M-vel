import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { getFilialById } from "@/lib/queries";
import FilialForm from "../../FilialForm";

export default async function EditarFilialPage(
  props: PageProps<"/filiais/[id]/editar">
) {
  const session = await requireUser(["ADMIN"]);
  const { id } = await props.params;
  const filial = await getFilialById(id);
  if (!filial) notFound();

  return (
    <AppShell session={session}>
      <div className="mx-auto max-w-lg">
        <div className="mb-6">
          <Link href="/filiais" className="text-sm text-slate-500 hover:underline">
            ← Filiais
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            Editar filial
          </h1>
        </div>
        <FilialForm filial={filial} />
      </div>
    </AppShell>
  );
}
