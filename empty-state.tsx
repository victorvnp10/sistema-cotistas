import { cn } from "@/lib/utils";

export function Avatar({
  nome,
  destaque,
  size = "md",
  className,
}: {
  nome: string;
  destaque?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tamanhos = { sm: "h-8 w-8 text-xs", md: "h-11 w-11 text-sm", lg: "h-14 w-14 text-base" };
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        destaque ? "bg-gradient-to-br from-royal to-ocean" : "bg-petrol",
        tamanhos[size],
        className
      )}
    >
      {nome.charAt(0).toUpperCase()}
    </div>
  );
}
