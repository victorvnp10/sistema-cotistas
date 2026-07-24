import { type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ListItem({
  leading,
  title,
  subtitle,
  trailing,
  chevron,
  onClick,
  className,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-softer border border-border/50 transition-colors",
        onClick && "hover:bg-secondary/60 active:scale-[0.99]",
        className
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-semibold text-foreground">{title}</p>
        {subtitle && <p className="truncate text-[12.5px] text-muted-foreground">{subtitle}</p>}
      </div>
      {trailing}
      {chevron && <ChevronRight size={18} className="shrink-0 text-muted-foreground/50" />}
    </Comp>
  );
}
