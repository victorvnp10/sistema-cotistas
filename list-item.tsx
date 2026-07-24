import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function StatCard({
  titulo,
  valor,
  sub,
  icon,
  onClick,
  destaque,
  className,
  tamanho = "padrao",
}: {
  titulo: string;
  valor: string;
  sub?: string;
  icon?: ReactNode;
  onClick?: () => void;
  destaque?: boolean;
  className?: string;
  /** "compacto" reduz fonte/padding — use em grids com 3+ colunas ou valores mais longos (ex: datas). */
  tamanho?: "padrao" | "compacto";
}) {
  const Comp = onClick ? motion.button : motion.div;
  const compacto = tamanho === "compacto";
  return (
    <Comp
      onClick={onClick}
      whileHover={onClick ? { y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      className={cn(
        "flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-3xl text-left shadow-soft border border-border/60 transition-shadow",
        compacto ? "gap-1.5 p-3" : "p-5",
        destaque ? "bg-gradient-to-br from-royal to-ocean text-white border-0" : "bg-white",
        onClick && "cursor-pointer hover:shadow-floating/40",
        className
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-1">
        <span className={cn("truncate text-[11px] font-bold uppercase tracking-wide", destaque ? "text-white/80" : "text-muted-foreground")}>
          {titulo}
        </span>
        {icon && <span className={cn("shrink-0", destaque ? "text-white/80" : "text-royal/70")}>{icon}</span>}
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "min-w-0 break-words font-extrabold leading-tight tracking-tight",
            compacto ? "text-[15px]" : "text-[26px] leading-none",
            destaque ? "text-white" : "text-foreground"
          )}
        >
          {valor}
        </p>
        {sub && (
          <p className={cn("mt-1.5 truncate text-[12px] leading-snug", destaque ? "text-white/75" : "text-muted-foreground")}>{sub}</p>
        )}
      </div>
    </Comp>
  );
}
