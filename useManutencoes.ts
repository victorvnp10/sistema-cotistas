import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ToastMsg {
  id: number;
  texto: string;
  tipo: "ok" | "erro";
}

interface ToastContextValue {
  sucesso: (texto: string) => void;
  erro: (texto: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [mensagens, setMensagens] = useState<ToastMsg[]>([]);

  const adicionar = useCallback((texto: string, tipo: "ok" | "erro") => {
    const id = Date.now() + Math.random();
    setMensagens((prev) => [...prev, { id, texto, tipo }]);
    setTimeout(() => {
      setMensagens((prev) => prev.filter((m) => m.id !== id));
    }, 3200);
  }, []);

  const value: ToastContextValue = {
    sucesso: (texto) => adicionar(texto, "ok"),
    erro: (texto) => adicionar(texto, "erro"),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {mensagens.map((m) => (
          <div
            key={m.id}
            className={cn(
              "rounded-md px-4 py-2.5 text-sm font-semibold text-white shadow-lg animate-in fade-in slide-in-from-bottom-2",
              m.tipo === "ok" ? "bg-success" : "bg-destructive"
            )}
          >
            {m.texto}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
}
