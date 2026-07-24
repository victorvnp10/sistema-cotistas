import { type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  className?: string;
}

/**
 * Bottom Sheet: no mobile ocupa a parte de baixo da tela (padrão de apps
 * modernos); em telas largas fica centralizado como um cartão flutuante.
 */
export function Modal({ aberto, aoFechar, titulo, children, className }: ModalProps) {
  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          className="fixed inset-0 z-40 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={aoFechar}
        >
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <motion.div
            className={cn(
              "relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 pb-8 shadow-floating sm:mx-auto sm:mb-auto sm:mt-16 sm:max-w-md sm:rounded-3xl",
              className
            )}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border sm:hidden" />
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold tracking-tight">{titulo}</h3>
              <button
                onClick={aoFechar}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:bg-accent"
              >
                <X size={16} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
