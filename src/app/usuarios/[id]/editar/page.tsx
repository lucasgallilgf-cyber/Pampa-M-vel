import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { listFiliais, getUserById } from "@/lib/queries";
import UserForm from "../../UserForm";

export default async function EditarUsuarioPage(
  props: PageProps<"/usuarios/[id]/editar">
) {
  const session = await requireUser(["ADMIN"]);
  const { id } = await props.params;
  const [filiais, user] = await Promise.all([listFiliais(), getUserById(id)]);
  if (!user) notFound();

  return (
    <AppShell session={session}>
      <div className="mb-6">
        <Link href="/usuarios" className="text-sm text-slate-500 hover:underline">
          ← Usuários
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          Editar usuário
        </h1>
      </div>
      <UserForm filiais={filiais} user={user} />
    </AppShell>
  );
}
