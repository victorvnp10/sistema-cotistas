import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useMembros } from "@/lib/queries/useMembros";
import { useFeriados } from "@/lib/queries/useFeriados";
import { useReservas, useCriarReserva, useCancelarReserva } from "@/lib/queries/useReservas";
import { construirSetFeriados, contaParaEscala, formatarDataISO } from "@/lib/ranking";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type Periodo = Database["public"]["Tables"]["reservas"]["Row"]["periodo"];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

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
    <div className="flex flex-col gap-4 pb-6">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => mudarMes(-1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary hover:bg-accent">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-[16px] font-extrabold tracking-tight">{MESES[mes]} {ano}</h2>
          <button onClick={() => mudarMes(1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary hover:bg-accent">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <Legenda cor="bg-royal" texto="Manhã ocupada" />
          <Legenda cor="bg-ocean" texto="Tarde ocupada" />
          <Legenda cor="bg-success-soft" texto="Livre" />
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {DIAS_SEMANA.map((d, i) => (
            <div key={i} className="pb-1 text-center text-[11px] font-bold text-muted-foreground/70">{d}</div>
          ))}
          {Array.from({ length: primeiroDiaSemana }).map((_, i) => <div key={`vazio-${i}`} />)}
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
                  "flex min-h-[58px] flex-col rounded-xl border p-1 text-left transition-transform active:scale-95",
                  conta ? "border-success/20 bg-success-soft/40" : "border-border/50 bg-white",
                  dataISO === hojeISO && "ring-2 ring-royal ring-offset-1"
                )}
              >
                <span className="mb-0.5 text-[11px] font-bold">{dia}</span>
                <span className={cn("mb-0.5 truncate rounded-md px-1 py-0.5 text-[9px] font-bold text-white", resM ? "bg-royal" : "bg-transparent text-transparent")}>
                  {resM ? nomeMembro(resM.membro_id) : "-"}
                </span>
                <span className={cn("truncate rounded-md px-1 py-0.5 text-[9px] font-bold text-white", resT ? "bg-ocean" : "bg-transparent text-transparent")}>
                  {resT ? nomeMembro(resT.membro_id) : "-"}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {diaSelecionado && <ModalDia dataISO={diaSelecionado} aoFechar={() => setDiaSelecionado(null)} />}
    </div>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", cor)} />
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
    <Modal aberto aoFechar={aoFechar} titulo={dataISO.split("-").reverse().join("/")}>
      <div className="flex flex-col gap-3">
        {[{ label: "Manhã", res: resM }, { label: "Tarde", res: resT }].map(({ label, res }) => (
          <div key={label} className="flex items-center justify-between rounded-2xl bg-secondary/60 p-3.5">
            <span className="text-[13.5px] font-semibold">{label}</span>
            {res ? (
              <div className="flex items-center gap-2">
                <span className="text-[13.5px]">{membros?.find((m) => m.id === res.membro_id)?.nome}</span>
                {podeAlterar(res.membro_id) && (
                  <Button size="sm" variant="destructive" onClick={() => cancelarReserva(res.id)}>Cancelar</Button>
                )}
              </div>
            ) : (
              <span className="text-[13px] text-success">Livre</span>
            )}
          </div>
        ))}

        {(!resM || !resT) && (
          <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
            <p className="text-[13.5px] font-bold">Fazer nova reserva</p>
            {ehAdmin && (
              <select
                className="h-12 rounded-2xl border border-input bg-white px-4 text-[15px]"
                value={membroId}
                onChange={(e) => setMembroId(e.target.value)}
              >
                {membros?.filter((m) => m.ativo).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            )}
            <select
              className="h-12 rounded-2xl border border-input bg-white px-4 text-[15px]"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as Periodo)}
            >
              {!resM && <option value="M">Manhã</option>}
              {!resT && <option value="T">Tarde</option>}
            </select>
            <Button size="lg" onClick={reservar} disabled={criar.isPending}>
              {criar.isPending ? "Reservando..." : "Confirmar reserva"}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
