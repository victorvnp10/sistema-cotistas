import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { PrioridadeDiario } from "@/types/database.types";

export function useDiario() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["diario", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diario_bordo")
        .select("*")
        .eq("grupo_id", grupoAtual!.id)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUltimoHorimetro() {
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

export function useCriarRegistroDiario() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      titulo: string;
      relato: string;
      prioridade?: PrioridadeDiario;
      horimetroInicio?: number | null;
      horimetroFim?: number;
      observacoes?: string;
      usoRotina?: boolean;
      dataUso?: string | null;
    }) => {
      const { error } = await supabase.rpc("criar_registro_diario", {
        p_grupo_id: grupoAtual!.id,
        p_titulo: payload.titulo,
        p_relato: payload.relato,
        p_prioridade: payload.prioridade ?? "normal",
        p_horimetro_inicio: payload.horimetroInicio ?? null,
        p_horimetro_fim: payload.horimetroFim ?? 0,
        p_observacoes: payload.observacoes ?? null,
        p_uso_rotina: payload.usoRotina ?? false,
        p_data_uso: payload.dataUso ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario", grupoAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["ultimo-horimetro", grupoAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["relatorios-pendentes"] });
      queryClient.invalidateQueries({ queryKey: ["mensalidade-membro"] });
      queryClient.invalidateQueries({ queryKey: ["mensalidades-todos", grupoAtual?.id] });
    },
  });
}

export function useResolverDiario() {
  const queryClient = useQueryClient();
  const { grupoAtual, membroAtual } = useAuth();
  return useMutation({
    mutationFn: async (payload: { id: string; resolvido: boolean }) => {
      const { error } = await supabase
        .from("diario_bordo")
        .update({
          resolvido: payload.resolvido,
          data_resolucao: payload.resolvido ? new Date().toISOString().slice(0, 10) : null,
          resolvido_por: payload.resolvido ? membroAtual?.id : null,
        })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["diario", grupoAtual?.id] }),
  });
}

export function useExcluirRegistroDiario() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("diario_bordo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["diario", grupoAtual?.id] }),
  });
}

export function useRelatoriosPendentes(membroId: string | undefined) {
  return useQuery({
    queryKey: ["relatorios-pendentes", membroId],
    enabled: !!membroId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("relatorios_pendentes_membro", {
        p_membro_id: membroId!,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRelatoriosPendentesTodos() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["relatorios-pendentes-todos", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("relatorios_pendentes_todos", {
        p_grupo_id: grupoAtual!.id,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}
