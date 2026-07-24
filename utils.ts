import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/types/database.types";

type ManutencaoInsert = Database["public"]["Tables"]["manutencoes"]["Insert"];

export function useManutencoes() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["manutencoes", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manutencoes")
        .select("*")
        .eq("grupo_id", grupoAtual!.id)
        .order("criado_em");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUltimoHorimetroManutencao() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["ultimo-horimetro", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ultimo_horimetro", {
        p_grupo_id: grupoAtual!.id,
      });
      if (error) throw error;
      return data ?? 0;
    },
  });
}

export function useSalvarManutencao() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (
      payload: { id?: string } & Omit<ManutencaoInsert, "grupo_id" | "feito">
    ) => {
      if (payload.id) {
        const { id, ...resto } = payload;
        const { error } = await supabase.from("manutencoes").update(resto).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("manutencoes")
          .insert({ ...payload, grupo_id: grupoAtual!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidar(queryClient, grupoAtual?.id),
  });
}

export function useExcluirManutencao() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("manutencoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, grupoAtual?.id),
  });
}

export function useConcluirManutencaoData() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: { id: string; reagendarDias?: number; proximaData?: string }) => {
      if (payload.reagendarDias && payload.proximaData) {
        const { error } = await supabase
          .from("manutencoes")
          .update({ feito: false, proxima_data: payload.proximaData, data_execucao: new Date().toISOString().slice(0, 10) })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("manutencoes")
          .update({ feito: true, data_execucao: new Date().toISOString().slice(0, 10) })
          .eq("id", payload.id);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidar(queryClient, grupoAtual?.id),
  });
}

export function useConcluirManutencaoHoras() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: { manutencaoId: string; custoReal: number }) => {
      const { error } = await supabase.rpc("concluir_manutencao_horas", {
        p_manutencao_id: payload.manutencaoId,
        p_custo_real: payload.custoReal,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar(queryClient, grupoAtual?.id);
      queryClient.invalidateQueries({ queryKey: ["rateio-manutencao", grupoAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["saldo-atual", grupoAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["lancamentos", grupoAtual?.id] });
    },
  });
}

export function useProjecaoManutencaoHoras() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["projecao-manutencao-horas", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("projecao_manutencao_horas", {
        p_grupo_id: grupoAtual!.id,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRateioManutencao() {
  const { grupoAtual } = useAuth();
  const manutencoes = useManutencoes();
  return useQuery({
    queryKey: ["rateio-manutencao", grupoAtual?.id],
    enabled: !!grupoAtual && !!manutencoes.data,
    queryFn: async () => {
      const ids = (manutencoes.data ?? []).map((m) => m.id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("rateio_manutencao")
        .select("*")
        .in("manutencao_id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useConfirmarRateioManutencao() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: { id: string; confirmado: boolean }) => {
      const { error } = await supabase
        .from("rateio_manutencao")
        .update({
          confirmado: payload.confirmado,
          data_confirmacao: payload.confirmado ? new Date().toISOString().slice(0, 10) : null,
        })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rateio-manutencao", grupoAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["mensalidade-membro"] });
    },
  });
}

function invalidar(queryClient: ReturnType<typeof useQueryClient>, grupoId: string | undefined) {
  queryClient.invalidateQueries({ queryKey: ["manutencoes", grupoId] });
  queryClient.invalidateQueries({ queryKey: ["projecao-manutencao-horas", grupoId] });
}
