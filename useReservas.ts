import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export function useHistoricoCombustivel() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["historico-combustivel", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_custo_combustivel")
        .select("*")
        .eq("grupo_id", grupoAtual!.id)
        .order("vigencia_inicio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDefinirCustoCombustivel() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      consumoPorHora: number;
      custoUnidade: number;
      unidades: number;
      dataInicio?: string;
    }) => {
      const { error } = await supabase.rpc("definir_custo_combustivel", {
        p_grupo_id: grupoAtual!.id,
        p_consumo_por_hora: payload.consumoPorHora,
        p_custo_unidade: payload.custoUnidade,
        p_unidades: payload.unidades,
        p_data_inicio: payload.dataInicio,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, grupoAtual?.id),
  });
}

export function useEditarCustoCombustivelAtual() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      consumoPorHora: number;
      custoUnidade: number;
      unidades: number;
      dataInicio: string;
    }) => {
      const { error } = await supabase.rpc("editar_custo_combustivel_atual", {
        p_id: payload.id,
        p_consumo_por_hora: payload.consumoPorHora,
        p_custo_unidade: payload.custoUnidade,
        p_unidades: payload.unidades,
        p_data_inicio: payload.dataInicio,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, grupoAtual?.id),
  });
}

function invalidar(queryClient: ReturnType<typeof useQueryClient>, grupoId: string | undefined) {
  queryClient.invalidateQueries({ queryKey: ["historico-combustivel", grupoId] });
  queryClient.invalidateQueries({ queryKey: ["mensalidade-membro"] });
  queryClient.invalidateQueries({ queryKey: ["mensalidades-todos", grupoId] });
}
