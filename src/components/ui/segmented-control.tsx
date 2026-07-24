import { cn } from "@/lib/utils";

export function SegmentedControl<T extends string>({
  opcoes,
  valor,
  aoMudar,
}: {
  opcoes: { valor: T; label: string }[];
  valor: T;
  aoMudar: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl bg-secondary p-1">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          onClick={() => aoMudar(o.valor)}
          className={cn(
            "rounded-xl px-3.5 py-1.5 text-[13px] font-semibold transition-all",
            valor === o.valor ? "bg-white text-royal shadow-softer" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
