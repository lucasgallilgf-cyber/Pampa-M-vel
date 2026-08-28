"use client";

import { useState } from "react";
import { useActionState } from "react";
import { clearExampleDataAction, ClearDataState } from "./actions";

const initialState: ClearDataState = { error: null };
const CONFIRM_PHRASE = "LIMPAR DADOS";

type Categoria = "filiais" | "veiculos" | "usuarios" | "checklists" | "ocorrencias";

const LABELS: Record<Categoria, string> = {
  filiais: "Filiais",
  veiculos: "Veículos",
  usuarios: "Usuários (exceto sua conta)",
  checklists: "Checklists registrados",
  ocorrencias: "Avarias / ocorrências",
};

// Mirrors the widening rule in actions.ts: checking a category also checks
// whatever it structurally requires (the database won't let a row be
// deleted while something still points at it). Kept here too so the UI
// shows the real scope before submitting, instead of surprising the admin
// after the fact.
function widen(sel: Record<Categoria, boolean>): Record<Categoria, boolean> {
  const next = { ...sel };
  if (next.filiais) {
    next.veiculos = true;
    next.usuarios = true;
  }
  if (next.veiculos || next.usuarios) {
    next.checklists = true;
  }
  if (next.checklists) {
    next.ocorrencias = true;
  }
  return next;
}

// Why each category, once checked, drags others along.
const REASONS: Partial<Record<Categoria, string>> = {
  veiculos: "junto com Filiais, pois veículos ficam vinculados a uma filial",
  usuarios: "junto com Filiais, pois usuários ficam vinculados a uma filial",
  checklists:
    "junto com Veículos/Usuários, pois todo checklist pertence a um veículo e foi feito por alguém",
  ocorrencias: "junto com Checklists, pois toda ocorrência vem de um checklist",
};

export default function ClearDataForm() {
  const [state, formAction, isPending] = useActionState(
    clearExampleDataAction,
    initialState
  );
  const [confirmText, setConfirmText] = useState("");
  const [sel, setSel] = useState<Record<Categoria, boolean>>({
    filiais: false,
    veiculos: false,
    usuarios: false,
    checklists: false,
    ocorrencias: false,
  });

  const matchesPhrase = confirmText.trim() === CONFIRM_PHRASE;
  const anySelected = Object.values(sel).some(Boolean);
  const effective = widen(sel);

  if (state.done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        Dados apagados com sucesso
        {state.cleared && state.cleared.length > 0 && (
          <>: {state.cleared.join(", ")}</>
        )}
        . Sua conta continua ativa e o restante dos dados não foi tocado.
      </div>
    );
  }

  function toggle(cat: Categoria) {
    setSel((prev) => widen({ ...prev, [cat]: !prev[cat] }));
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const nomes = (Object.keys(effective) as Categoria[])
          .filter((c) => effective[c])
          .map((c) => LABELS[c]);
        if (
          !confirm(
            `Isso vai apagar: ${nomes.join(
              ", "
            )}. Essa ação não pode ser desfeita. Confirmar?`
          )
        ) {
          e.preventDefault();
        }
      }}
      className="space-y-4"
    >
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          O que apagar
        </h2>
        <div className="space-y-2">
          {(Object.keys(LABELS) as Categoria[]).map((cat) => {
            const checked = effective[cat];
            const forced = checked && !sel[cat];
            return (
              <div key={cat}>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name={cat}
                    checked={checked}
                    disabled={forced}
                    onChange={() => toggle(cat)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {LABELS[cat]}
                  {forced && (
                    <span className="text-xs text-slate-400">
                      (marcado automaticamente)
                    </span>
                  )}
                </label>
                {forced && REASONS[cat] && (
                  <p className="ml-6 text-xs text-slate-400">
                    {REASONS[cat]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <label className="mb-1 block text-sm font-medium text-red-900">
          Para confirmar, digite{" "}
          <code className="rounded bg-white px-1 py-0.5 text-red-700">
            {CONFIRM_PHRASE}
          </code>{" "}
          abaixo
        </label>
        <input
          type="text"
          name="confirmText"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
          className="w-64 rounded-lg border border-red-300 px-3 py-2 text-sm outline-none focus:border-red-500"
        />

        {state.error && (
          <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <div className="mt-4">
          <button
            type="submit"
            disabled={!matchesPhrase || !anySelected || isPending}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "Apagando…" : "Apagar selecionado"}
          </button>
        </div>
      </div>
    </form>
  );
}
