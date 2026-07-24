import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useFeriados } from "@/lib/queries/useFeriados";
import { useReservas, useCriarReserva, useCancelarReserva } from "@/lib/queries/useReservas";
import { construirSetFeriados, contaParaEscala, formatarDataBR, formatarDataISO } from "@/lib/ranking";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ListItem } from "@/components/ui/list-item";
import { EmptyState } from "@/components/ui/empty-state";
import type { Database } from "@/types/database.types";

type Periodo = Database["public"]["Tables"]["reservas"]["Row"]["periodo"];

export default function Reservar() {
  const { membroAtual } = useAuth();
  const toast = useToast();
  const { data: reservas } = useReservas();
  const { data: feriados } = useFeriados();
  const criar = useCriarReserva();
  const cancelar = useCancelarReserva();

  const [data, setData] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("M");

  const feriadosSet = construirSetFeriados(feriados ?? []);

  async function reservar() {
    if (!data) {
      toast.erro("Selecione uma data.");
      return;
    }
    try {
      await criar.mutateAsync({ membroId: membroAtual!.id, data, periodo });
      toast.sucesso("Reserva confirmada!");
      setData("");
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao reservar.");
    }
  }

  async function cancelarReserva(id: string) {
    try {
      await cancelar.mutateAsync(id);
      toast.sucesso("Reserva cancelada.");
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao cancelar.");
    }
  }

  const hojeISO = formatarDataISO(new Date());
  const minhasFuturas = (reservas ?? [])
    .filter((r) => r.membro_id === membroAtual?.id && r.status !== "cancelado" && r.data >= hojeISO)
    .sort((a, b) => (a.data < b.data ? -1 : 1));

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-[15px] font-bold">
          <CalendarPlus size={18} className="text-royal" /> Nova reserva
        </h2>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Período</Label>
            <select
              className="h-12 rounded-2xl border border-input bg-white px-4 text-[15px]"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as Periodo)}
            >
              <option value="M">Manhã</option>
              <option value="T">Tarde</option>
            </select>
          </div>
          <Button size="lg" onClick={reservar} disabled={criar.isPending}>
            {criar.isPending ? "Reservando..." : "Confirmar reserva"}
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-[15px] font-bold">Minhas reservas futuras</h2>
        {!minhasFuturas.length ? (
          <EmptyState titulo="Nenhuma reserva futura" descricao="Suas próximas reservas vão aparecer aqui." />
        ) : (
          <div className="flex flex-col gap-2">
            {minhasFuturas.map((r) => (
              <ListItem
                key={r.id}
                title={`${formatarDataBR(r.data)} · ${r.periodo === "M" ? "Manhã" : "Tarde"}`}
                subtitle={contaParaEscala(r.data, feriadosSet) ? "Conta para a escala de prioridade" : undefined}
                trailing={
                  <div className="flex items-center gap-2">
                    {contaParaEscala(r.data, feriadosSet) && <Badge variant="success">Escala</Badge>}
                    <button
                      onClick={() => cancelarReserva(r.id)}
                      className="text-[12.5px] font-bold text-destructive hover:underline"
                    >
                      Cancelar
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
