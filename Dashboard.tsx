import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/types/database.types";

type Membro = Database["public"]["Tables"]["grupo_membros"]["Row"];
type MembroInsert = Database["public"]["Tables"]["grupo_membros"]["Insert"];
type MembroUpdate = Database["public"]["Tables"]["grupo_membros"]["Update"];

export function useMembros() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["membros", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async (): Promise<Membro[]> => {
      const { data, error } = await supabase
        .from("grupo_membros")
        .select("*")
        .eq("grupo_id", grupoAtual!.id)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSalvarMembro() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();

  return useMutation({
    mutationFn: async (payload: { id?: string } & Omit<MembroInsert, "grupo_id">) => {
      if (payload.id) {
        const { id, ...resto } = payload;
        const update: MembroUpdate = resto;
        const { error } = await supabase.from("grupo_membros").update(update).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("grupo_membros")
          .insert({ ...payload, grupo_id: grupoAtual!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membros", grupoAtual?.id] });
    },
  });
}
