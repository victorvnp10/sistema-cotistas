import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/types/database.types";

type Periodo = Database["public"]["Tables"]["reservas"]["Row"]["periodo"];

export function useReservas() {
  const { grupoAtual } = useAuth();
  return useQuery({
    queryKey: ["reservas", grupoAtual?.id],
    enabled: !!grupoAtual,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservas")
        .select("*")
        .eq("grupo_id", grupoAtual!.id)
        .order("data");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCriarReserva() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();

  return useMutation({
    mutationFn: async (payload: { membroId: string; data: string; periodo: Periodo }) => {
      const { error } = await supabase.from("reservas").insert({
        grupo_id: grupoAtual!.id,
        membro_id: payload.membroId,
        data: payload.data,
        periodo: payload.periodo,
      });
      if (error) {
        // Violação do índice único de turno = alguém reservou primeiro
        if (error.code === "23505") {
          throw new Error("Esse turno acabou de ser reservado por outra pessoa.");
        }
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reservas", grupoAtual?.id] }),
  });
}

export function useCancelarReserva() {
  const queryClient = useQueryClient();
  const { grupoAtual } = useAuth();

  return useMutation({
    mutationFn: async (reservaId: string) => {
      const { error } = await supabase
        .from("reservas")
        .update({ status: "cancelado" })
        .eq("id", reservaId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reservas", grupoAtual?.id] }),
  });
}
