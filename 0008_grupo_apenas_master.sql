import { type ReactNode } from "react";

/**
 * Envolve um <Button variant="fab" size="fab"> e o mantém alinhado com a
 * coluna de conteúdo (max-w-2xl centralizada) em qualquer largura de tela
 * — em vez de grudado na borda real da janela, o que ficava estranho em
 * telas largas com o conteúdo centralizado.
 */
export function Fab({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center">
      <div className="flex w-full max-w-2xl justify-end px-4 sm:px-6">
        <div className="pointer-events-auto">{children}</div>
      </div>
    </div>
  );
}
