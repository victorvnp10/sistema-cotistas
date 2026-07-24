import { type ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon,
  titulo,
  descricao,
  acao,
}: {
  icon?: ReactNode;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-secondary/50 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-muted-foreground/60 shadow-softer">
        {icon ?? <Inbox size={22} />}
      </div>
      <div>
        <p className="text-[14.5px] font-semibold text-foreground">{titulo}</p>
        {descricao && <p className="mt-0.5 text-[13px] text-muted-foreground">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}
