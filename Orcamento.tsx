import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { CategoriaInformacao } from "@/types/database.types";

export function useInformacoes() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["informacoes", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("informacoes_uteis")
        .select("*")
        .eq("grupo_id", grupoAtual!.id)
        .order("categoria");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSalvarInformacao() {
  const queryClient = useQueryClient();
  const { grupoAtual, membroAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      categoria: CategoriaInformacao;
      rotulo: string;
      valor: string;
      observacao?: string;
    }) => {
      const { error } = await supabase.from("informacoes_uteis").insert({
        grupo_id: grupoAtual!.id,
        categoria: payload.categoria,
        rotulo: payload.rotulo,
        valor: payload.valor,
        observacao: payload.observacao || null,
        autor_id: membroAtual!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["informacoes", grupoAtual?.id] }),
  });
}

export function useExcluirInformacao() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("informacoes_uteis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["informacoes", grupoAtual?.id] }),
  });
}
