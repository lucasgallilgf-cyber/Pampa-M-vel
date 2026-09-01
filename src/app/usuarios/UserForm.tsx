"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createUserAction, updateUserAction, UserFormState } from "./actions";
import { ROLE_LABELS } from "@/lib/domain";

const initialState: UserFormState = { error: null };

type Filial = { id: string; nome: string };
type ExistingUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "GERENTE" | "SUPERVISOR" | "CONDUTOR";
  filialId: string | null;
  active: boolean;
};

export default function UserForm({
  filiais,
  user,
  outrasFiliaisIds = [],
}: {
  filiais: Filial[];
  user?: ExistingUser;
  outrasFiliaisIds?: string[];
}) {
  const action = user ? updateUserAction : createUserAction;
  const [state, formAction] = useActionState(action, initialState);
  const isEdit = !!user;

  return (
    <form
      action={formAction}
      className="mx-auto max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-5"
    >
      {isEdit && <input type="hidden" name="id" value={user!.id} />}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Nome completo
        </label>
        <input
          type="text"
          name="name"
          required
          defaultValue={user?.name}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          E-mail
        </label>
        <input
          type="email"
          name="email"
          required
          defaultValue={user?.email}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {isEdit ? "Nova senha (deixe em branco para manter)" : "Senha"}
        </label>
        <input
          type="password"
          name="password"
          required={!isEdit}
          minLength={6}
          placeholder="mínimo 6 caracteres"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Perfil
          </label>
          <select
            name="role"
            required
            defaultValue={user?.role ?? "CONDUTOR"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          >
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Filial principal
          </label>
          <select
            name="filialId"
            defaultValue={user?.filialId ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          >
            <option value="">—</option>
            {filiais.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Outras filiais que este usuário também gerencia (opcional)
        </label>
        <p className="mb-2 text-xs text-slate-500">
          Só para deixar registrado no cadastro — não muda o que o usuário
          consegue ver ou fazer no sistema.
        </p>
        <div className="grid max-h-48 grid-cols-2 gap-x-3 gap-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
          {filiais.map((f) => (
            <label
              key={f.id}
              className="flex items-center gap-2 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                name="filiaisAdicionais"
                value={f.id}
                defaultChecked={outrasFiliaisIds.includes(f.id)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {f.nome}
            </label>
          ))}
        </div>
      </div>

      {isEdit && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="active"
            defaultChecked={user!.active}
            className="h-4 w-4 rounded border-slate-300"
          />
          Usuário ativo (permite login)
        </label>
      )}

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton isEdit={isEdit} />
        <Link
          href="/usuarios"
          className="text-sm text-slate-500 hover:underline"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar usuário"}
    </button>
  );
}
