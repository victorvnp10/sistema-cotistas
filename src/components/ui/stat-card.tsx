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
}: {
  titulo: string;
  valor: string;
  sub?: string;
  icon?: ReactNode;
  onClick?: () => void;
  destaque?: boolean;
  className?: string;
}) {
  const Comp = onClick ? motion.button : motion.div;
  return (
    <Comp
      onClick={onClick}
      whileHover={onClick ? { y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-3xl p-5 text-left shadow-soft border border-border/60 transition-shadow",
        destaque ? "bg-gradient-to-br from-royal to-ocean text-white border-0" : "bg-white",
        onClick && "cursor-pointer hover:shadow-floating/40",
        className
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className={cn("min-w-0 [overflow-wrap:anywhere] text-[11px] font-bold uppercase tracking-wide", destaque ? "text-white/80" : "text-muted-foreground")}>
          {titulo}
        </span>
        {icon && <span className={cn("shrink-0", destaque ? "text-white/80" : "text-royal/70")}>{icon}</span>}
      </div>
      <div className="min-w-0">
        <p className={cn("[overflow-wrap:anywhere] text-[19px] sm:text-[26px] font-extrabold leading-tight sm:leading-none tracking-tight", destaque ? "text-white" : "text-foreground")}>
          {valor}
        </p>
        {sub && (
          <p className={cn("mt-1.5 [overflow-wrap:anywhere] text-[12px] leading-snug", destaque ? "text-white/75" : "text-muted-foreground")}>{sub}</p>
        )}
      </div>
    </Comp>
  );
}
