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
