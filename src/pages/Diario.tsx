import { useState } from "react";
import { BookOpen, Gauge, Clock, Settings2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  useDiario,
  useUltimoHorimetro,
  useCriarRegistroDiario,
  useResolverDiario,
  useExcluirRegistroDiario,
  useRelatoriosPendentes,
  useAjustesHorimetro,
  useRegistrarTrocaHorimetro,
} from "@/lib/queries/useDiario";
import { formatarDataBR } from "@/lib/ranking";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { PrioridadeDiario } from "@/types/database.types";

const LABEL_PRIORIDADE: Record<PrioridadeDiario, string> = { normal: "Relato", atencao: "Atenção", urgente: "Urgência" };
const BADGE_PRIORIDADE: Record<PrioridadeDiario, "neutral" | "warning" | "error"> = { normal: "neutral", atencao: "warning", urgente: "error" };

export default function Diario() {
  const { membroAtual, podeGerenciarOrcamento } = useAuth();
  const toast = useToast();
  const { data: entradas, isLoading } = useDiario();
  const { data: ultimoHorimetro } = useUltimoHorimetro();
  const { data: pendentes } = useRelatoriosPendentes(membroAtual?.id);
  const { data: ajustes } = useAjustesHorimetro();
  const criar = useCriarRegistroDiario();
  const resolver = useResolverDiario();
  const excluir = useExcluirRegistroDiario();
  const registrarTroca = useRegistrarTrocaHorimetro();

  const [titulo, setTitulo] = useState("");
  const [relato, setRelato] = useState("");
  const [prioridade, setPrioridade] = useState<PrioridadeDiario>("normal");
  const [horimetroInicio, setHorimetroInicio] = useState<string>(ultimoHorimetro ? String(ultimoHorimetro) : "");
  const [horimetroFim, setHorimetroFim] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "abertos" | "resolvidos">("todos");
  const [usoRotina, setUsoRotina] = useState(false);
  const [dataUso, setDataUso] = useState<string | null>(null);

  const [modalTrocaAberto, setModalTrocaAberto] = useState(false);
  const [horasReaisAteTroca, setHorasReaisAteTroca] = useState("");
  const [leituraAparelhoNovo, setLeituraAparelhoNovo] = useState("0");
  const [motivoTroca, setMotivoTroca] = useState("");
  const [dataTroca, setDataTroca] = useState(new Date().toISOString().slice(0, 10));

  function abrirModalTroca() {
    setHorasReaisAteTroca(ultimoHorimetro ? String(ultimoHorimetro) : "");
    setLeituraAparelhoNovo("0");
    setMotivoTroca("");
    setDataTroca(new Date().toISOString().slice(0, 10));
    setModalTrocaAberto(true);
  }

  async function confirmarTroca() {
    if (!horasReaisAteTroca || leituraAparelhoNovo === "") {
      toast.erro("Preencha as horas reais até a troca e a leitura do aparelho novo.");
      return;
    }
    try {
      await registrarTroca.mutateAsync({
        horasReaisAteTroca: Number(horasReaisAteTroca),
        leituraAparelhoNovo: Number(leituraAparelhoNovo),
        motivo: motivoTroca || undefined,
        data: dataTroca,
      });
      toast.sucesso("Troca de aparelho registrada! O horímetro atual já reflete o ajuste.");
      setModalTrocaAberto(false);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao registrar a troca.");
    }
  }

  function preencherPendente(data: string, periodo: string) {
    setTitulo(`Uso em ${formatarDataBR(data)} (${periodo === "M" ? "Manhã" : "Tarde"})`);
    setUsoRotina(true);
    setDataUso(data);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvar() {
    if (!titulo || !relato) { toast.erro("Preencha título e relato."); return; }
    try {
      await criar.mutateAsync({
        titulo, relato, prioridade,
        horimetroInicio: horimetroInicio ? Number(horimetroInicio) : null,
        horimetroFim: horimetroFim ? Number(horimetroFim) : 0,
        observacoes, usoRotina, dataUso,
      });
      toast.sucesso(usoRotina ? "Relatório de uso registrado!" : "Registro salvo!");
      setTitulo(""); setRelato(""); setHorimetroFim(""); setObservacoes("");
      setUsoRotina(false); setDataUso(null); setPrioridade("normal");
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  const exibidos = (entradas ?? []).filter((e) => {
    if (filtroStatus === "abertos" && e.resolvido) return false;
    if (filtroStatus === "resolvidos" && !e.resolvido) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4 pb-6">
      {!!pendentes?.length && (
        <Card variant="destaque">
          <h2 className="mb-1 text-[15px] font-bold">⏳ Relatórios de uso pendentes</h2>
          <p className="mb-3 text-[12px] text-white/80">Registre o horímetro dos usos abaixo.</p>
          <div className="flex flex-col gap-2">
            {pendentes.map((p) => (
              <div key={p.reserva_id} className="flex items-center justify-between rounded-xl bg-white/15 px-3 py-2 text-[13px]">
                <span>{formatarDataBR(p.data)} · {p.periodo === "M" ? "Manhã" : "Tarde"}</span>
                <Button size="sm" variant="secondary" onClick={() => preencherPendente(p.data, p.periodo)}>Preencher</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-[15px] font-bold"><BookOpen size={17} className="text-royal" /> Novo registro</h2>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Motor com ruído estranho" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Relato</Label>
            <textarea
              className="min-h-[90px] rounded-2xl border border-input bg-white p-3.5 text-[15px] focus-visible:outline-none focus-visible:border-royal focus-visible:ring-4 focus-visible:ring-royal/10"
              value={relato} onChange={(e) => setRelato(e.target.value)} placeholder="Descreva o ocorrido..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1"><Gauge size={12} /> Horímetro início</Label>
              <Input type="number" step="0.1" value={horimetroInicio} onChange={(e) => setHorimetroInicio(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1"><Gauge size={12} /> Horímetro fim</Label>
              <Input type="number" step="0.1" value={horimetroFim} onChange={(e) => setHorimetroFim(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Observações (opcional)</Label>
            <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SegmentedControl
              opcoes={[{ valor: "normal", label: "Relato" }, { valor: "atencao", label: "Atenção" }, { valor: "urgente", label: "Urgência" }]}
              valor={prioridade}
              aoMudar={setPrioridade}
            />
            <Button onClick={salvar} disabled={criar.isPending}>{criar.isPending ? "Registrando..." : "Registrar"}</Button>
          </div>
        </div>
      </Card>

      {podeGerenciarOrcamento && (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-bold"><Settings2 size={17} className="text-royal" /> Horímetro</h2>
            <Button size="sm" variant="outline" onClick={abrirModalTroca}>Registrar troca de aparelho</Button>
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            Horímetro atual: <strong>{(ultimoHorimetro ?? 0).toFixed(1)}h</strong>
          </p>
          {!!ajustes?.length && (
            <div className="mt-3 flex flex-col gap-1.5 border-t border-border/60 pt-3">
              <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">Histórico de ajustes</p>
              {ajustes.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="text-muted-foreground">{formatarDataBR(a.data)} — {a.motivo}</span>
                  <span className="font-semibold">{a.delta >= 0 ? "+" : ""}{a.delta.toFixed(1)}h</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-bold">Registros</h2>
          <select className="h-9 rounded-xl border border-input bg-white px-3 text-[12.5px]" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}>
            <option value="todos">Todos</option>
            <option value="abertos">Abertos</option>
            <option value="resolvidos">Resolvidos</option>
          </select>
        </div>
        {isLoading ? null : !exibidos.length ? (
          <EmptyState titulo="Nenhum registro encontrado" />
        ) : (
          <div className="flex flex-col gap-2.5">
            {exibidos.map((e) => (
              <div key={e.id} className={cn("rounded-2xl border border-border/60 bg-white p-4", e.resolvido && "opacity-60")}>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Badge variant={e.resolvido ? "success" : BADGE_PRIORIDADE[e.prioridade]}>
                    {e.resolvido ? "Resolvido" : LABEL_PRIORIDADE[e.prioridade]}
                  </Badge>
                  <span className="text-[14px] font-bold">{e.titulo}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">{new Date(e.criado_em).toLocaleDateString("pt-BR")}</span>
                </div>
                <p className="whitespace-pre-wrap text-[13.5px] text-foreground/90">{e.relato}</p>
                {e.horimetro_fim > 0 && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-muted-foreground">
                    <Clock size={11} /> {e.horimetro_inicio.toFixed(1)}h → {e.horimetro_fim.toFixed(1)}h (uso: {e.tempo_uso.toFixed(1)}h)
                  </p>
                )}
                {e.observacoes && <p className="mt-1 text-[11.5px] text-muted-foreground">Obs: {e.observacoes}</p>}
                {podeGerenciarOrcamento && (
                  <div className="mt-2.5 flex gap-3">
                    {!e.resolvido ? (
                      <button className="text-[12px] font-bold text-success hover:underline" onClick={() => resolver.mutate({ id: e.id, resolvido: true })}>Resolver</button>
                    ) : (
                      <button className="text-[12px] font-bold text-muted-foreground hover:underline" onClick={() => resolver.mutate({ id: e.id, resolvido: false })}>Reabrir</button>
                    )}
                    <button className="text-[12px] font-bold text-destructive hover:underline" onClick={() => excluir.mutate(e.id)}>Excluir</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal aberto={modalTrocaAberto} aoFechar={() => setModalTrocaAberto(false)} titulo="Registrar troca de aparelho">
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-muted-foreground">
            Use isto quando o aparelho físico de horímetro for substituído e passar a mostrar uma leitura
            diferente (geralmente reiniciando do zero). As horas de manutenção e óleo já registradas
            continuam corretas — isto só corrige o valor de referência do "horímetro atual".
          </p>
          <div className="flex flex-col gap-1.5">
            <Label>Horas reais acumuladas até a troca</Label>
            <Input type="number" step="0.1" value={horasReaisAteTroca} onChange={(e) => setHorasReaisAteTroca(e.target.value)} />
            <p className="text-[11.5px] text-muted-foreground">Pré-preenchido com o horímetro atual do sistema.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Leitura do aparelho novo, logo após a instalação</Label>
            <Input type="number" step="0.1" value={leituraAparelhoNovo} onChange={(e) => setLeituraAparelhoNovo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Data da troca</Label>
            <Input type="date" value={dataTroca} onChange={(e) => setDataTroca(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Motivo (opcional)</Label>
            <Input value={motivoTroca} onChange={(e) => setMotivoTroca(e.target.value)} placeholder="Ex: aparelho antigo quebrou" />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalTrocaAberto(false)}>Cancelar</Button>
            <Button onClick={confirmarTroca} disabled={registrarTroca.isPending}>
              {registrarTroca.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
