import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export function useSeguros() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["seguros", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seguros")
        .select("*")
        .eq("grupo_id", grupoAtual!.id)
        .order("data_vencimento", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRenovarSeguro() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      apolice: string;
      seguradora: string;
      dataInicio: string;
      valor: number;
      dataVencimento: string;
      lancarDespesa: boolean;
      observacao?: string;
    }) => {
      const { error } = await supabase.rpc("renovar_seguro", {
        p_grupo_id: grupoAtual!.id,
        p_apolice: payload.apolice,
        p_seguradora: payload.seguradora || null,
        p_data_inicio: payload.dataInicio,
        p_valor: payload.valor,
        p_data_vencimento: payload.dataVencimento,
        p_lancar_despesa: payload.lancarDespesa,
        p_observacao: payload.observacao ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seguros", grupoAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["saldo-atual", grupoAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["lancamentos", grupoAtual?.id] });
    },
  });
}

export function useAtualizarSeguro() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      apolice: string;
      seguradora: string;
      dataInicio: string;
      valor: number;
      dataVencimento: string;
      observacao?: string;
    }) => {
      const { error } = await supabase
        .from("seguros")
        .update({
          apolice: payload.apolice,
          seguradora: payload.seguradora || null,
          data_inicio: payload.dataInicio,
          valor: payload.valor,
          data_vencimento: payload.dataVencimento,
          observacao: payload.observacao || null,
        })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seguros", grupoAtual?.id] }),
  });
}

export function useExcluirSeguro() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("seguros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seguros", grupoAtual?.id] }),
  });
}
