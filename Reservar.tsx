import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export function useFeriados() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["feriados", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feriados")
        .select("*")
        .eq("grupo_id", grupoAtual!.id)
        .order("data");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSalvarFeriado() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: { data: string; descricao: string }) => {
      const { error } = await supabase
        .from("feriados")
        .insert({ ...payload, grupo_id: grupoAtual!.id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feriados", grupoAtual?.id] }),
  });
}

export function useExcluirFeriado() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feriados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feriados", grupoAtual?.id] }),
  });
}
