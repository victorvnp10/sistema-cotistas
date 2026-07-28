import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export function useAvisosAtivos() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["avisos-ativos", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avisos_embarcacao")
        .select("*")
        .eq("grupo_id", grupoAtual!.id)
        .eq("resolvido", false)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAvisos() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["avisos", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avisos_embarcacao")
        .select("*")
        .eq("grupo_id", grupoAtual!.id)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function invalidar(queryClient: ReturnType<typeof useQueryClient>, grupoId: string | undefined) {
  queryClient.invalidateQueries({ queryKey: ["avisos-ativos", grupoId] });
  queryClient.invalidateQueries({ queryKey: ["avisos", grupoId] });
}

export function useCriarAviso() {
  const queryClient = useQueryClient();
  const { grupoAtual, membroAtual } = useAuth();
  return useMutation({
    mutationFn: async (mensagem: string) => {
      const { error } = await supabase.from("avisos_embarcacao").insert({
        grupo_id: grupoAtual!.id,
        mensagem,
        criado_por: membroAtual?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, grupoAtual?.id),
  });
}

export function useResolverAviso() {
  const queryClient = useQueryClient();
  const { grupoAtual, membroAtual } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("avisos_embarcacao")
        .update({ resolvido: true, resolvido_por: membroAtual?.id, resolvido_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, grupoAtual?.id),
  });
}

export function useExcluirAviso() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("avisos_embarcacao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient, grupoAtual?.id),
  });
}
