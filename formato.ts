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
        "flex flex-col gap-3 rounded-3xl p-5 text-left shadow-soft border border-border/60 transition-shadow",
        destaque ? "bg-gradient-to-br from-royal to-ocean text-white border-0" : "bg-white",
        onClick && "cursor-pointer hover:shadow-floating/40",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("text-[11px] font-bold uppercase tracking-wide", destaque ? "text-white/80" : "text-muted-foreground")}>
          {titulo}
        </span>
        {icon && <span className={destaque ? "text-white/80" : "text-royal/70"}>{icon}</span>}
      </div>
      <div>
        <p className={cn("text-[26px] font-extrabold leading-none tracking-tight", destaque ? "text-white" : "text-foreground")}>
          {valor}
        </p>
        {sub && (
          <p className={cn("mt-1.5 text-[12px] leading-snug", destaque ? "text-white/75" : "text-muted-foreground")}>{sub}</p>
        )}
      </div>
    </Comp>
  );
}
