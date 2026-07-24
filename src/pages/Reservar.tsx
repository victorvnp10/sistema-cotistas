import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useFeriados } from "@/lib/queries/useFeriados";
import { useReservas, useCriarReserva, useCancelarReserva } from "@/lib/queries/useReservas";
import { construirSetFeriados, contaParaEscala, formatarDataBR, formatarDataISO } from "@/lib/ranking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>✅ Nova reserva</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Período</Label>
              <select
                className="h-10 rounded-md border border-input px-2 text-sm"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value as Periodo)}
              >
                <option value="M">Manhã</option>
                <option value="T">Tarde</option>
              </select>
            </div>
            <Button onClick={reservar} disabled={criar.isPending}>
              {criar.isPending ? "Reservando..." : "Confirmar reserva"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>📋 Minhas reservas futuras</CardTitle>
        </CardHeader>
        <CardContent>
          {!minhasFuturas.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma reserva futura.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {minhasFuturas.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <strong>{formatarDataBR(r.data)}</strong> — {r.periodo === "M" ? "Manhã" : "Tarde"}
                    {contaParaEscala(r.data, feriadosSet) && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                        conta p/ escala
                      </span>
                    )}
                  </span>
                  <button
                    className="text-xs font-semibold text-destructive hover:underline"
                    onClick={() => cancelarReserva(r.id)}
                  >
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
