import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ aberto, aoFechar, titulo, children, className }: ModalProps) {
  if (!aberto) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={aoFechar}
    >
      <div
        className={cn("mx-auto mt-8 w-full max-w-md rounded-xl bg-white p-5 shadow-2xl", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-base font-bold text-foreground">{titulo}</h3>
        {children}
      </div>
    </div>
  );
}
