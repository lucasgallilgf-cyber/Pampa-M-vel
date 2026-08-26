export default function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warning" | "critical";
}) {
  const toneClasses: Record<string, string> = {
    default: "text-slate-900",
    good: "text-emerald-600",
    warning: "text-amber-600",
    critical: "text-red-600",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClasses[tone]}`}>
        {value}
      </p>
    </div>
  );
}
