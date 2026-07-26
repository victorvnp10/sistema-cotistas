import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

// Resumo por galão: horas realmente consumidas no período (via Diário de
// Bordo) e custo médio por hora derivado disso -- nunca uma taxa manual.
export function useResumoOleo() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["resumo-oleo", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resumo_custo_oleo", {
        p_grupo_id: grupoAtual!.id,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDefinirCustoOleo() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: { custoGalao: number; dataInicio?: string }) => {
      const { error } = await supabase.rpc("definir_custo_oleo", {
        p_grupo_id: grupoAtual!.id,
        p_custo_galao: payload.custoGalao,
        p_data_inicio: payload.dataInicio,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, grupoAtual?.id),
  });
}

export function useEditarCustoOleoAtual() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: { id: string; custoGalao: number; dataInicio: string }) => {
      const { error } = await supabase.rpc("editar_custo_oleo_atual", {
        p_id: payload.id,
        p_custo_galao: payload.custoGalao,
        p_data_inicio: payload.dataInicio,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, grupoAtual?.id),
  });
}

// Encerra um galão numa data específica -- ex: quando ele realmente
// acabou, mesmo que outro já tenha sido aberto depois.
export function useFecharCustoOleo() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: { id: string; dataFim: string }) => {
      const { error } = await supabase.rpc("fechar_custo_oleo", {
        p_id: payload.id,
        p_data_fim: payload.dataFim,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, grupoAtual?.id),
  });
}

function invalidar(queryClient: ReturnType<typeof useQueryClient>, grupoId: string | undefined) {
  queryClient.invalidateQueries({ queryKey: ["resumo-oleo", grupoId] });
}
