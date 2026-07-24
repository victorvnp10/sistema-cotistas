import { type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface ItemNav {
  to?: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  ativo?: boolean;
}

export function BottomNavigation({ itens }: { itens: ItemNav[] }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border/60 bg-white/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {itens.map((item) =>
          item.to ? (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold transition-colors",
                  isActive ? "text-royal" : "text-muted-foreground/70"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "flex h-7 items-center justify-center transition-transform",
                      isActive && "scale-110"
                    )}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                  <span
                    className={cn(
                      "h-1 w-1 rounded-full transition-opacity",
                      isActive ? "bg-royal opacity-100" : "opacity-0"
                    )}
                  />
                </>
              )}
            </NavLink>
          ) : (
            <button
              key={item.label}
              onClick={item.onClick}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold transition-colors",
                item.ativo ? "text-royal" : "text-muted-foreground/70"
              )}
            >
              <span className="flex h-7 items-center justify-center">{item.icon}</span>
              {item.label}
              <span className="h-1 w-1 rounded-full opacity-0" />
            </button>
          )
        )}
      </div>
    </nav>
  );
}
