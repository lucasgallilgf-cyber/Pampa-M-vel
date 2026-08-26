import Link from "next/link";
import { requireUser, ROLE_LABELS } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import Badge from "@/components/Badge";
import { listUsers } from "@/lib/queries";

export default async function UsuariosPage() {
  const session = await requireUser(["ADMIN"]);
  const users = await listUsers();

  return (
    <AppShell session={session}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Usuários</h1>
          <p className="text-sm text-slate-500">
            {users.length} usuário{users.length !== 1 && "s"} cadastrado
            {users.length !== 1 && "s"}
          </p>
        </div>
        <Link
          href="/usuarios/novo"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Novo usuário
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Nome</th>
              <th className="px-4 py-2.5">E-mail</th>
              <th className="px-4 py-2.5">Perfil</th>
              <th className="px-4 py-2.5">Filial</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  {u.name}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{u.email}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {ROLE_LABELS[u.role]}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {u.filialNome ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  {u.active ? (
                    <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20">
                      Ativo
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-500 ring-slate-400/20">
                      Inativo
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/usuarios/${u.id}/editar`}
                    className="font-medium text-slate-700 hover:underline"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-slate-400"
                >
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
