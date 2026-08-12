import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const TICKS = Array.from({ length: 36 });

export function HorimetroGauge({
  valor,
  size = "lg",
  className,
}: {
  valor: number;
  size?: "sm" | "lg";
  className?: string;
}) {
  const dimensao = size === "lg" ? "h-44 w-44" : "h-28 w-28";
  const fonte = size === "lg" ? "text-[34px]" : "text-[21px]";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn("relative mx-auto shrink-0", dimensao, className)}
    >
      <div className="absolute inset-0 rounded-full bg-destructive/25 blur-2xl" aria-hidden />

      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-neutral-600 via-neutral-800 to-black shadow-[0_18px_40px_-14px_rgba(0,0,0,0.65)]">
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
          {TICKS.map((_, i) => {
            const angulo = (i / TICKS.length) * 360;
            const principal = i % 3 === 0;
            return (
              <line
                key={i}
                x1={100}
                y1={principal ? 12 : 17}
                x2={100}
                y2={23}
                stroke={principal ? "rgba(248,113,113,0.9)" : "rgba(248,113,113,0.4)"}
                strokeWidth={principal ? 2.2 : 1.2}
                strokeLinecap="round"
                transform={`rotate(${angulo} 100 100)`}
              />
            );
          })}
        </svg>

        <div className="absolute inset-[22px] flex flex-col items-center justify-center rounded-full bg-gradient-to-b from-[#210404] via-[#160202] to-black shadow-[inset_0_2px_10px_rgba(0,0,0,0.85)]">
          <span className="text-[9px] font-bold uppercase tracking-[0.35em] text-destructive/70">Hours</span>
          <motion.span
            key={valor}
            initial={{ opacity: 0.3 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className={cn(
              "mt-1 font-mono font-bold leading-none tabular-nums text-destructive drop-shadow-[0_0_10px_rgba(248,113,113,0.75)]",
              fonte
            )}
          >
            {valor.toFixed(1)}
          </motion.span>
          {size === "lg" && (
            <span className="mt-1.5 text-[8.5px] font-semibold uppercase tracking-wider text-white/25">
              Horímetro
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
