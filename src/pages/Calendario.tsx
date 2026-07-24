import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useMembros } from "@/lib/queries/useMembros";
import { useFeriados } from "@/lib/queries/useFeriados";
import { useReservas, useCriarReserva, useCancelarReserva } from "@/lib/queries/useReservas";
import { construirSetFeriados, contaParaEscala, formatarDataISO } from "@/lib/ranking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type Periodo = Database["public"]["Tables"]["reservas"]["Row"]["periodo"];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Calendario() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());

  const { data: membros } = useMembros();
  const { data: feriados } = useFeriados();
  const { data: reservas } = useReservas();
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const feriadosSet = useMemo(() => construirSetFeriados(feriados ?? []), [feriados]);

  function mudarMes(delta: number) {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes < 0) { novoMes = 11; novoAno--; }
    if (novoMes > 11) { novoMes = 0; novoAno++; }
    setMes(novoMes);
    setAno(novoAno);
  }

  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const hojeISO = formatarDataISO(hoje);

  function nomeMembro(id: string) {
    return membros?.find((m) => m.id === id)?.nome ?? "?";
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => mudarMes(-1)}>◀</Button>
            <h2 className="text-lg font-bold">{MESES[mes]} {ano}</h2>
            <Button variant="outline" size="sm" onClick={() => mudarMes(1)}>▶</Button>
          </div>

          <div className="mb-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <Legenda cor="bg-sky-600" texto="Manhã ocupada" />
            <Legenda cor="bg-orange-500" texto="Tarde ocupada" />
            <Legenda cor="bg-green-100" texto="Livre (conta p/ escala)" />
            <Legenda cor="bg-gray-200" texto="Não conta p/ escala" />
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="pb-1 text-center text-[11px] font-bold text-muted-foreground">
                {d}
              </div>
            ))}
            {Array.from({ length: primeiroDiaSemana }).map((_, i) => (
              <div key={`vazio-${i}`} />
            ))}
            {Array.from({ length: ultimoDia }).map((_, i) => {
              const dia = i + 1;
              const dataISO = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
              const conta = contaParaEscala(dataISO, feriadosSet);
              const resM = reservas?.find((r) => r.data === dataISO && r.periodo === "M" && r.status !== "cancelado");
              const resT = reservas?.find((r) => r.data === dataISO && r.periodo === "T" && r.status !== "cancelado");

              return (
                <button
                  key={dataISO}
                  onClick={() => setDiaSelecionado(dataISO)}
                  className={cn(
                    "flex min-h-[64px] flex-col rounded-md border p-1 text-left text-[11px]",
                    conta ? "border-green-200 bg-green-50" : "border-gray-100 bg-white",
                    dataISO === hojeISO && "border-2 border-amber-500"
                  )}
                >
                  <span className="mb-1 text-xs font-bold">{dia}</span>
                  <span className={cn("mb-0.5 truncate rounded px-1 py-0.5 font-semibold text-white", resM ? "bg-sky-600" : conta ? "bg-green-200 !text-green-900" : "bg-gray-100 !text-gray-400")}>
                    {resM ? nomeMembro(resM.membro_id) : "Livre M"}
                  </span>
                  <span className={cn("truncate rounded px-1 py-0.5 font-semibold text-white", resT ? "bg-orange-500" : conta ? "bg-green-200 !text-green-900" : "bg-gray-100 !text-gray-400")}>
                    {resT ? nomeMembro(resT.membro_id) : "Livre T"}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {diaSelecionado && (
        <ModalDia
          dataISO={diaSelecionado}
          aoFechar={() => setDiaSelecionado(null)}
        />
      )}
    </div>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("h-2.5 w-2.5 rounded-sm", cor)} />
      {texto}
    </span>
  );
}

function ModalDia({ dataISO, aoFechar }: { dataISO: string; aoFechar: () => void }) {
  const { membroAtual, ehAdmin } = useAuth();
  const toast = useToast();
  const { data: membros } = useMembros();
  const { data: reservas } = useReservas();
  const criar = useCriarReserva();
  const cancelar = useCancelarReserva();

  const [membroId, setMembroId] = useState(membroAtual?.id ?? "");
  const [periodo, setPeriodo] = useState<Periodo>("M");

  const resM = reservas?.find((r) => r.data === dataISO && r.periodo === "M" && r.status !== "cancelado");
  const resT = reservas?.find((r) => r.data === dataISO && r.periodo === "T" && r.status !== "cancelado");

  async function reservar() {
    try {
      await criar.mutateAsync({ membroId, data: dataISO, periodo });
      toast.sucesso("Reserva confirmada!");
      aoFechar();
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao reservar.");
    }
  }

  async function cancelarReserva(id: string) {
    try {
      await cancelar.mutateAsync(id);
      toast.sucesso("Reserva cancelada.");
      aoFechar();
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao cancelar.");
    }
  }

  const podeAlterar = (donoId: string) => donoId === membroAtual?.id || ehAdmin;

  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Reservas de ${dataISO.split("-").reverse().join("/")}`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-md border p-2 text-sm">
          <span>Manhã</span>
          {resM ? (
            <div className="flex items-center gap-2">
              <span>{membros?.find((m) => m.id === resM.membro_id)?.nome}</span>
              {podeAlterar(resM.membro_id) && (
                <Button size="sm" variant="destructive" onClick={() => cancelarReserva(resM.id)}>
                  Cancelar
                </Button>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">Livre</span>
          )}
        </div>
        <div className="flex items-center justify-between rounded-md border p-2 text-sm">
          <span>Tarde</span>
          {resT ? (
            <div className="flex items-center gap-2">
              <span>{membros?.find((m) => m.id === resT.membro_id)?.nome}</span>
              {podeAlterar(resT.membro_id) && (
                <Button size="sm" variant="destructive" onClick={() => cancelarReserva(resT.id)}>
                  Cancelar
                </Button>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">Livre</span>
          )}
        </div>

        {(!resM || !resT) && (
          <div className="flex flex-col gap-3 border-t pt-3">
            <p className="text-sm font-semibold">Fazer nova reserva</p>
            {ehAdmin && (
              <select
                className="h-10 rounded-md border border-input px-2 text-sm"
                value={membroId}
                onChange={(e) => setMembroId(e.target.value)}
              >
                {membros?.filter((m) => m.ativo).map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            )}
            <select
              className="h-10 rounded-md border border-input px-2 text-sm"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as Periodo)}
            >
              {!resM && <option value="M">Manhã</option>}
              {!resT && <option value="T">Tarde</option>}
            </select>
            <Button onClick={reservar} disabled={criar.isPending}>
              {criar.isPending ? "Reservando..." : "Confirmar reserva"}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
