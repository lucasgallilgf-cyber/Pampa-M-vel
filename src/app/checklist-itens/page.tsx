import { requireUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import Badge from "@/components/Badge";
import { listAllChecklistItemDefs } from "@/lib/queries";
import ChecklistItemForm from "./ChecklistItemForm";
import ToggleActiveButton from "./ToggleActiveButton";

export default async function ChecklistItensPage() {
  const session = await requireUser(["ADMIN"]);
  const items = await listAllChecklistItemDefs();

  const categories = Array.from(new Set(items.map((i) => i.category)));
  const byCategory = categories.map((category) => ({
    category,
    items: items.filter((i) => i.category === category),
  }));

  return (
    <AppShell session={session}>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">
          Itens de checklist
        </h1>
        <p className="text-sm text-slate-500">
          Lista padrão de itens que aparece em todo checklist mensal.
          Desativar um item aqui não apaga nada do histórico já registrado —
          só para de aparecer nas próximas conferências.
        </p>
      </div>

      <div className="mb-6">
        <ChecklistItemForm categories={categories} />
      </div>

      <div className="space-y-6">
        {byCategory.map(({ category, items: catItems }) => (
          <div
            key={category}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-slate-700">
                {category}
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {catItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 px-4 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm ${
                        item.active
                          ? "text-slate-800"
                          : "text-slate-400 line-through"
                      }`}
                    >
                      {item.label}
                    </p>
                    {!item.active && (
                      <Badge className="bg-slate-100 text-slate-500 ring-slate-400/20">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <ToggleActiveButton
                    id={item.id}
                    label={item.label}
                    active={item.active}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
            Nenhum item de checklist cadastrado ainda.
          </p>
        )}
      </div>
    </AppShell>
  );
}
