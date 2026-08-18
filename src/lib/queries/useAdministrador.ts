import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Só funcionam de verdade pro usuário master -- o RLS (ver migration
// 0017) é quem garante isso no banco; não dependa só da UI esconder o
// botão.

export function useTodosGrupos() {
  return useQuery({
    queryKey: ["master-todos-grupos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grupos").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMembrosDoGrupo(grupoId: string | null) {
  return useQuery({
    queryKey: ["master-membros-grupo", grupoId],
    enabled: !!grupoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupo_membros")
        .select("*")
        .eq("grupo_id", grupoId!)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEditarNomeGrupo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { grupoId: string; nome: string }) => {
      const { error } = await supabase.rpc("master_editar_nome_grupo", {
        p_grupo_id: payload.grupoId,
        p_nome: payload.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-todos-grupos"] });
    },
  });
}

export function useExcluirGrupo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (grupoId: string) => {
      const { error } = await supabase.rpc("master_excluir_grupo", {
        p_grupo_id: grupoId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-todos-grupos"] });
    },
  });
}

export function useTrocarAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { grupoId: string; email: string; nome?: string }) => {
      const { error } = await supabase.rpc("master_trocar_admin", {
        p_grupo_id: payload.grupoId,
        p_novo_admin_email: payload.email,
        p_novo_admin_nome: payload.nome ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["master-membros-grupo", variables.grupoId] });
    },
  });
}

export function useExcluirMembroMaster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (membroId: string) => {
      const { error } = await supabase.rpc("master_excluir_membro", {
        p_membro_id: membroId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-membros-grupo"] });
    },
  });
}
