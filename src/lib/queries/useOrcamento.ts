import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Database, MensalidadeMembro, TipoLancamento } from "@/types/database.types";

// ── Lançamentos ────────────────────────────────────────────
export function useLancamentos() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["lancamentos", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos")
        .select("*")
        .eq("grupo_id", grupoAtual!.id)
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCriarLancamento() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      tipo: TipoLancamento;
      descricao: string;
      valor: number;
      data: string;
      observacao?: string;
    }) => {
      const { error } = await supabase.rpc("criar_lancamento", {
        p_grupo_id: grupoAtual!.id,
        p_tipo: payload.tipo,
        p_descricao: payload.descricao,
        p_valor: payload.valor,
        p_data: payload.data,
        p_observacao: payload.observacao ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidarTudoOrcamento(queryClient, grupoAtual?.id),
  });
}

export function useExcluirLancamento() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lancamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidarTudoOrcamento(queryClient, grupoAtual?.id),
  });
}

// ── Recorrentes ────────────────────────────────────────────
export function useRecorrentes() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["recorrentes", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recorrentes")
        .select("*")
        .eq("grupo_id", grupoAtual!.id)
        .order("descricao");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCriarRecorrente() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      tipo: TipoLancamento;
      descricao: string;
      valorAtual: number;
      diaCobranca: number;
      dataInicio?: string | null;
      dataFim?: string | null;
    }) => {
      const { error } = await supabase.from("recorrentes").insert({
        grupo_id: grupoAtual!.id,
        tipo: payload.tipo,
        descricao: payload.descricao,
        valor_atual: payload.valorAtual,
        dia_cobranca: payload.diaCobranca,
        data_inicio: payload.dataInicio ?? null,
        data_fim: payload.dataFim ?? null,
        subtipo: payload.tipo === "receita" ? "reserva_emergencia" : null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidarTudoOrcamento(queryClient, grupoAtual?.id),
  });
}

export function useAlterarValorRecorrente() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: { recorrenteId: string; novoValor: number }) => {
      const { error } = await supabase.rpc("alterar_valor_recorrente", {
        p_recorrente_id: payload.recorrenteId,
        p_novo_valor: payload.novoValor,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidarTudoOrcamento(queryClient, grupoAtual?.id),
  });
}

export function useAtivarRecorrente() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("recorrentes")
        .update({ ativo: payload.ativo })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => invalidarTudoOrcamento(queryClient, grupoAtual?.id),
  });
}

// ── Confirmações de pagamento ───────────────────────────────
export function useConfirmacoes() {
  const { grupoAtual } = useAuth();
  const recorrentes = useRecorrentes();
  return useQuery({
    queryKey: ["confirmacoes", grupoAtual?.id],
    enabled: !!grupoAtual && !!recorrentes.data,
    queryFn: async () => {
      const idsRecorrentes = (recorrentes.data ?? []).map((r) => r.id);
      if (!idsRecorrentes.length) return [];
      const { data, error } = await supabase
        .from("confirmacoes_pagamento")
        .select("*")
        .in("recorrente_id", idsRecorrentes);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useConfirmarPagamento() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: { confirmacaoId: string; confirmado: boolean }) => {
      const { error } = await supabase
        .from("confirmacoes_pagamento")
        .update({
          confirmado: payload.confirmado,
          data_confirmacao: payload.confirmado ? new Date().toISOString().slice(0, 10) : null,
        })
        .eq("id", payload.confirmacaoId);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["confirmacoes", grupoAtual?.id] }),
  });
}

// ── Cálculos (RPC) ───────────────────────────────────────────
export function useMensalidadeMembro(membroId: string | undefined) {
  return useQuery({
    queryKey: ["mensalidade-membro", membroId],
    enabled: !!membroId,
    queryFn: async (): Promise<MensalidadeMembro> => {
      const { data, error } = await supabase.rpc("mensalidade_membro", {
        p_membro_id: membroId!,
      });
      if (error) throw error;
      return data as unknown as MensalidadeMembro;
    },
  });
}

export function useMensalidadesTodos() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["mensalidades-todos", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mensalidades_todos", {
        p_grupo_id: grupoAtual!.id,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaldoAtual() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["saldo-atual", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("saldo_atual", { p_grupo_id: grupoAtual!.id });
      if (error) throw error;
      return data ?? 0;
    },
  });
}

export function useCustoFixoMes(mesRef: string) {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["custo-fixo-mes", grupoAtual?.id, mesRef],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("custo_fixo_mes", {
        p_grupo_id: grupoAtual!.id,
        p_mes_ref: mesRef,
      });
      if (error) throw error;
      return data ?? 0;
    },
  });
}

function invalidarTudoOrcamento(
  queryClient: ReturnType<typeof useQueryClient>,
  grupoId: string | undefined
) {
  queryClient.invalidateQueries({ queryKey: ["lancamentos", grupoId] });
  queryClient.invalidateQueries({ queryKey: ["recorrentes", grupoId] });
  queryClient.invalidateQueries({ queryKey: ["confirmacoes", grupoId] });
  queryClient.invalidateQueries({ queryKey: ["mensalidades-todos", grupoId] });
  queryClient.invalidateQueries({ queryKey: ["saldo-atual", grupoId] });
  queryClient.invalidateQueries({ queryKey: ["custo-fixo-mes", grupoId] });
  queryClient.invalidateQueries({ queryKey: ["mensalidade-membro"] });
}
