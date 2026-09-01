type Item = { label: string; count: number };

/**
 * Lista simples de contagem em barras horizontais (ex.: veículos por
 * filial/centro de custo/modelo). Mostra o número de cada linha sempre
 * visível ao lado da barra, sem depender de hover/tooltip.
 */
export default function CountBarList({
  items,
  emptyMessage = "Sem dados.",
}: {
  items: Item[];
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-slate-400">
        {emptyMessage}
      </p>
    );
  }

  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span
            className="w-28 shrink-0 truncate text-sm text-slate-700 sm:w-36"
            title={item.label}
          >
            {item.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#2a78d6]"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-semibold text-slate-800">
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}
