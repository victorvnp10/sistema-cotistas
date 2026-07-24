import { type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function Header({
  titulo,
  voltar,
  acao,
  avatar,
}: {
  titulo: string;
  voltar?: boolean;
  acao?: ReactNode;
  avatar?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-background/80 px-5 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2">
        {voltar && (
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-softer"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <h1 className="truncate text-[19px] font-extrabold tracking-tight text-foreground">{titulo}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {acao}
        {avatar}
      </div>
    </header>
  );
}
