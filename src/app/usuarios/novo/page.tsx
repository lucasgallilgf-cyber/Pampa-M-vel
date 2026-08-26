import Link from "next/link";
import { requireUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { listFiliais } from "@/lib/queries";
import UserForm from "../UserForm";

export default async function NovoUsuarioPage() {
  const session = await requireUser(["ADMIN"]);
  const filiais = await listFiliais();

  return (
    <AppShell session={session}>
      <div className="mb-6">
        <Link href="/usuarios" className="text-sm text-slate-500 hover:underline">
          ← Usuários
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          Novo usuário
        </h1>
      </div>
      <UserForm filiais={filiais} />
    </AppShell>
  );
}
