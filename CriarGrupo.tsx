import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { PainelGestor } from "@/types/database.types";

export function usePainelGestor(mesRef: string, anoRef: number) {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["painel-gestor", grupoAtual?.id, mesRef, anoRef],
    enabled: !!grupoAtual && !!mesRef,
    queryFn: async (): Promise<PainelGestor> => {
      const { data, error } = await supabase.rpc("painel_gestor", {
        p_grupo_id: grupoAtual!.id,
        p_mes_ref: mesRef,
        p_ano_ref: anoRef,
      });
      if (error) throw error;
      return data as unknown as PainelGestor;
    },
  });
}
