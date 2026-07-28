import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useMembros } from "@/lib/queries/useMembros";
import { useFeriados } from "@/lib/queries/useFeriados";
import { useReservas, useCriarReserva, useCancelarReserva } from "@/lib/queries/useReservas";
import { construirSetFeriados, contaParaEscala, formatarDataBR, formatarDataISO } from "@/lib/ranking";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Fab } from "@/components/ui/fab";
import { Badge } from "@/components/ui/badge";
import { ListItem } from "@/components/ui/list-item";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type Periodo = Database["public"]["Tables"]["reservas"]["Row"]["periodo"];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export default function Calendario() {
  const { membroAtual } = useAuth();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());

  const { data: membros } = useMembros();
  const { data: feriados } = useFeriados();
  const { data: reservas } = useReservas();
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [novaReservaAberta, setNovaReservaAberta] = useState(false);

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

  const minhasFuturas = (reservas ?? [])
    .filter((r) => r.membro_id === membroAtual?.id && r.status !== "cancelado" && r.data >= hojeISO)
    .sort((a, b) => (a.data < b.data ? -1 : 1));

  return (
    <div className="relative flex flex-col gap-4 pb-6">
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

      <Card>
        <h2 className="mb-3 text-[15px] font-bold">Minhas reservas futuras</h2>
        {!minhasFuturas.length ? (
          <EmptyState titulo="Nenhuma reserva futura" descricao='Toque no "+" para reservar um turno.' />
        ) : (
          <div className="flex flex-col gap-2">
            {minhasFuturas.map((r) => (
              <ListItem
                key={r.id}
                title={`${formatarDataBR(r.data)} · ${r.periodo === "M" ? "Manhã" : "Tarde"}`}
                subtitle={contaParaEscala(r.data, feriadosSet) ? "Conta para a escala" : undefined}
                trailing={contaParaEscala(r.data, feriadosSet) && <Badge variant="success">Escala</Badge>}
                onClick={() => setDiaSelecionado(r.data)}
              />
            ))}
          </div>
        )}
      </Card>

      <Fab>
        <Button variant="fab" size="fab" onClick={() => setNovaReservaAberta(true)} aria-label="Nova reserva">
          <Plus size={26} />
        </Button>
      </Fab>

      {diaSelecionado && <ModalDia dataISO={diaSelecionado} aoFechar={() => setDiaSelecionado(null)} />}
      {novaReservaAberta && (
        <ModalNovaReserva aoFechar={() => setNovaReservaAberta(false)} aoEscolherDia={(d) => { setNovaReservaAberta(false); setDiaSelecionado(d); }} />
      )}
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

/** Sheet aberto pelo botão "+": escolher data/período rapidamente, sem precisar navegar o calendário até o mês certo. */
function ModalNovaReserva({ aoFechar, aoEscolherDia }: { aoFechar: () => void; aoEscolherDia: (data: string) => void }) {
  const { membroAtual } = useAuth();
  const toast = useToast();
  const criar = useCriarReserva();

  const [data, setData] = useState(formatarDataISO(new Date()));
  const [periodo, setPeriodo] = useState<Periodo>("M");

  async function reservar() {
    if (!data) { toast.erro("Selecione uma data."); return; }
    try {
      await criar.mutateAsync({ membroId: membroAtual!.id, data, periodo });
      toast.sucesso("Reserva confirmada!");
      aoFechar();
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao reservar.");
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Nova reserva">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Data</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Período</Label>
          <select className="h-12 rounded-2xl border border-input bg-white px-4 text-[16px]" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
            <option value="M">Manhã</option>
            <option value="T">Tarde</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => aoEscolherDia(data)}>Ver dia no calendário</Button>
          <Button className="flex-1" onClick={reservar} disabled={criar.isPending}>
            {criar.isPending ? "Reservando..." : "Confirmar"}
          </Button>
        </div>
      </div>
    </Modal>
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

  const hojeISO = formatarDataISO(new Date());
  const dataPassada = dataISO < hojeISO;
  // Cotista só cancela reserva própria de hoje em diante; datas passadas
  // só o admin (mesma regra aplicada no banco via RLS -- isto aqui é só
  // pra não mostrar um botão que o Supabase vai recusar).
  const podeAlterar = (donoId: string) => ehAdmin || (donoId === membroAtual?.id && !dataPassada);

  return (
    <Modal aberto aoFechar={aoFechar} titulo={dataISO.split("-").reverse().join("/")}>
      <div className="flex flex-col gap-3">
        {[{ label: "Manhã", res: resM }, { label: "Tarde", res: resT }].map(({ label, res }) => (
          <div key={label} className="flex items-center justify-between rounded-2xl bg-secondary/60 p-3.5">
            <span className="text-[13.5px] font-semibold">{label}</span>
            {res ? (
              <div className="flex items-center gap-2">
                <span className="text-[13.5px]">{membros?.find((m) => m.id === res.membro_id)?.nome}</span>
                {podeAlterar(res.membro_id) ? (
                  <Button size="sm" variant="destructive" onClick={() => cancelarReserva(res.id)}>Cancelar</Button>
                ) : (
                  dataPassada && res.membro_id === membroAtual?.id && (
                    <span className="text-[11px] text-muted-foreground">Só o admin cancela data passada</span>
                  )
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
              <select className="h-12 rounded-2xl border border-input bg-white px-4 text-[16px]" value={membroId} onChange={(e) => setMembroId(e.target.value)}>
                {membros?.filter((m) => m.ativo).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            )}
            <select className="h-12 rounded-2xl border border-input bg-white px-4 text-[16px]" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
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
