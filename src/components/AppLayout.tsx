import { type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { grupoAtual, membroAtual, ehAdmin, podeGerenciarOrcamento, sair } = useAuth();

  const itensNav = [
    { to: "/", label: "🏠 Início" },
    { to: "/calendario", label: "📅 Calendário" },
    { to: "/reservar", label: "✅ Reservar" },
    { to: "/orcamento", label: "💰 Orçamento" },
    { to: "/manutencao", label: "🔧 Manutenção" },
    { to: "/diario", label: "📖 Diário de Bordo" },
    { to: "/seguro", label: "🛡️ Seguro" },
    { to: "/informacoes", label: "ℹ️ Informações" },
    ...(podeGerenciarOrcamento ? [{ to: "/painel-gestor", label: "📊 Painel Gestor" }] : []),
    ...(ehAdmin ? [{ to: "/cotistas", label: "👥 Cotistas" }] : []),
    ...(ehAdmin ? [{ to: "/feriados", label: "🎉 Feriados" }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between bg-primary px-4 text-primary-foreground shadow-md">
        <h1 className="truncate text-base font-extrabold">
          ⛵ {grupoAtual?.nome ?? "Carregando..."}
        </h1>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs sm:inline">{membroAtual?.nome}</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase">
            {membroAtual?.role}
          </span>
          <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/15" onClick={sair}>
            Sair
          </Button>
        </div>
      </header>
      <nav className="flex gap-1 overflow-x-auto bg-primary/90 px-2 pb-1">
        {itensNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "whitespace-nowrap rounded-t-md px-3 py-1.5 text-xs font-semibold text-white/70 hover:text-white",
                isActive && "bg-background text-primary"
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
