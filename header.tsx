import { useState } from "react";
import { Wrench, Gauge, CalendarClock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  useManutencoes,
  useUltimoHorimetroManutencao,
  useSalvarManutencao,
  useExcluirManutencao,
  useConcluirManutencaoData,
  useConcluirManutencaoHoras,
} from "@/lib/queries/useManutencoes";
import { formatarMoeda } from "@/lib/formato";
import { formatarDataBR } from "@/lib/ranking";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/ui/empty-state";
import type { Database, TipoGatilhoManutencao } from "@/types/database.types";

type Manutencao = Database["public"]["Tables"]["manutencoes"]["Row"];

function status(m: Manutencao, horimetroAtual: number) {
  if (m.feito) return "ok";
  if (m.tipo_gatilho === "horas") {
    const restantes = (m.horimetro_base + (m.intervalo_horas ?? 0)) - horimetroAtual;
    if (restantes < 0) return "venc";
    if (restantes <= 10) return "urgent";
    if (restantes <= 30) return "warn";
    if (restantes <= 60) return "alert";
    return "normal";
  }
  if (!m.proxima_data) return "normal";
  const dias = Math.round((new Date(m.proxima_data + "T00:00:00").getTime() - Date.now()) / 86400000);
  if (dias < 0) return "venc";
  if (dias <= 7) return "urgent";
  if (dias <= 15) return "warn";
  if (dias <= 30) return "alert";
  return "normal";
}

const BADGE_VARIANT: Record<string, "success" | "neutral" | "warning" | "error"> = {
  ok: "success", normal: "neutral", alert: "warning", warn: "warning", urgent: "error", venc: "error",
};
const LABELS: Record<string, string> = {
  ok: "Concluída", normal: "Em dia", alert: "Atenção", warn: "Próximo", urgent: "Urgente", venc: "Vencida",
};

export default function Manutencao() {
  const { podeGerenciarOrcamento } = useAuth();
  const toast = useToast();
  const { data: manutencoes, isLoading } = useManutencoes();
  const { data: horimetroAtual } = useUltimoHorimetroManutencao();
  const excluir = useExcluirManutencao();
  const concluirData = useConcluirManutencaoData();
  const concluirHoras = useConcluirManutencaoHoras();

  const [modalForm, setModalForm] = useState<{ aberto: boolean; editando: Manutencao | null }>({ aberto: false, editando: null });
  const [modalConcluirData, setModalConcluirData] = useState<Manutencao | null>(null);
  const [modalConcluirHoras, setModalConcluirHoras] = useState<Manutencao | null>(null);
  const [reagendarDias, setReagendarDias] = useState("");
  const [custoReal, setCustoReal] = useState("");

  const horimetro = horimetroAtual ?? 0;

  async function concluirPorData() {
    if (!modalConcluirData) return;
    try {
      let proximaData: string | undefined;
      if (reagendarDias) {
        const d = new Date();
        d.setDate(d.getDate() + Number(reagendarDias));
        proximaData = d.toISOString().slice(0, 10);
      }
      await concluirData.mutateAsync({ id: modalConcluirData.id, reagendarDias: reagendarDias ? Number(reagendarDias) : undefined, proximaData });
      toast.sucesso("Manutenção concluída!");
      setModalConcluirData(null);
      setReagendarDias("");
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro.");
    }
  }

  async function concluirPorHoras() {
    if (!modalConcluirHoras || !custoReal) return;
    try {
      await concluirHoras.mutateAsync({ manutencaoId: modalConcluirHoras.id, custoReal: Number(custoReal) });
      toast.sucesso("Manutenção concluída e custo rateado!");
      setModalConcluirHoras(null);
      setCustoReal("");
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao concluir.");
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[15px] font-bold"><Wrench size={17} className="text-royal" /> Manutenções</h2>
          {podeGerenciarOrcamento && <Button size="sm" onClick={() => setModalForm({ aberto: true, editando: null })}>Nova</Button>}
        </div>
        {isLoading ? null : !manutencoes?.length ? (
          <EmptyState titulo="Nenhuma manutenção cadastrada" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {manutencoes.map((m) => {
              const st = status(m, horimetro);
              return (
                <div key={m.id} className="rounded-2xl border border-border/60 bg-white p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="text-[14px] font-bold">{m.descricao}</p>
                    <Badge variant={BADGE_VARIANT[st]}>{LABELS[st]}</Badge>
                  </div>
                  <div className="mb-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    {m.tipo_gatilho === "horas" ? <Gauge size={13} /> : <CalendarClock size={13} />}
                    {m.tipo_gatilho === "horas"
                      ? `${horimetro.toFixed(1)}h de ${(m.horimetro_base + (m.intervalo_horas ?? 0)).toFixed(1)}h`
                      : m.proxima_data ? formatarDataBR(m.proxima_data) : "—"}
                  </div>
                  {!!m.custo_previsto && <p className="mb-2 text-[12px] text-muted-foreground">Previsto: {formatarMoeda(m.custo_previsto)}</p>}
                  {podeGerenciarOrcamento && (
                    <div className="flex flex-wrap gap-2">
                      {!m.feito && (m.tipo_gatilho === "horas" ? (
                        <Button size="sm" variant="success" onClick={() => setModalConcluirHoras(m)}>Concluir</Button>
                      ) : (
                        <Button size="sm" variant="success" onClick={() => setModalConcluirData(m)}>Concluir</Button>
                      ))}
                      <Button size="sm" variant="outline" onClick={() => setModalForm({ aberto: true, editando: m })}>Editar</Button>
                      <Button size="sm" variant="destructive" onClick={() => excluir.mutate(m.id)}>Excluir</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <ModalFormManutencao aberto={modalForm.aberto} editando={modalForm.editando} horimetroAtual={horimetro} aoFechar={() => setModalForm({ aberto: false, editando: null })} />

      <Modal aberto={!!modalConcluirData} aoFechar={() => setModalConcluirData(null)} titulo="Confirmar execução">
        <div className="flex flex-col gap-3">
          <p className="text-[13.5px] text-muted-foreground">{modalConcluirData?.descricao}</p>
          <div className="flex flex-col gap-1.5">
            <Label>Reagendar em quantos dias? (opcional)</Label>
            <Input type="number" min={1} value={reagendarDias} onChange={(e) => setReagendarDias(e.target.value)} />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalConcluirData(null)}>Cancelar</Button>
            <Button variant="success" onClick={concluirPorData}>Confirmar</Button>
          </div>
        </div>
      </Modal>

      <Modal aberto={!!modalConcluirHoras} aoFechar={() => setModalConcluirHoras(null)} titulo="Concluir por horímetro">
        <div className="flex flex-col gap-3">
          <p className="text-[13.5px] text-muted-foreground">{modalConcluirHoras?.descricao}</p>
          <p className="text-[12px] text-muted-foreground">
            Horímetro atual: {horimetro.toFixed(1)}h (base: {modalConcluirHoras?.horimetro_base.toFixed(1)}h)
          </p>
          <div className="flex flex-col gap-1.5">
            <Label>Custo real gasto (R$)</Label>
            <Input type="number" min={0} step={0.01} value={custoReal} onChange={(e) => setCustoReal(e.target.value)} />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalConcluirHoras(null)}>Cancelar</Button>
            <Button variant="success" onClick={concluirPorHoras} disabled={concluirHoras.isPending}>
              {concluirHoras.isPending ? "Concluindo..." : "Concluir e ratear"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ModalFormManutencao({ aberto, editando, horimetroAtual, aoFechar }: { aberto: boolean; editando: Manutencao | null; horimetroAtual: number; aoFechar: () => void }) {
  const toast = useToast();
  const salvar = useSalvarManutencao();

  const [descricao, setDescricao] = useState(editando?.descricao ?? "");
  const [tipoGatilho, setTipoGatilho] = useState<TipoGatilhoManutencao>(editando?.tipo_gatilho ?? "data");
  const [periodicidade, setPeriodicidade] = useState(editando?.periodicidade ?? "");
  const [proximaData, setProximaData] = useState(editando?.proxima_data ?? "");
  const [intervaloHoras, setIntervaloHoras] = useState(String(editando?.intervalo_horas ?? ""));
  const [custoPrevisto, setCustoPrevisto] = useState(String(editando?.custo_previsto ?? ""));
  const [observacao, setObservacao] = useState(editando?.observacao ?? "");

  const chave = editando?.id ?? "novo";
  const [ultimaChave, setUltimaChave] = useState(chave);
  if (chave !== ultimaChave) {
    setUltimaChave(chave);
    setDescricao(editando?.descricao ?? "");
    setTipoGatilho(editando?.tipo_gatilho ?? "data");
    setPeriodicidade(editando?.periodicidade ?? "");
    setProximaData(editando?.proxima_data ?? "");
    setIntervaloHoras(String(editando?.intervalo_horas ?? ""));
    setCustoPrevisto(String(editando?.custo_previsto ?? ""));
    setObservacao(editando?.observacao ?? "");
  }

  async function salvarForm() {
    if (!descricao) { toast.erro("Preencha a descrição."); return; }
    if (tipoGatilho === "data" && !proximaData) { toast.erro("Preencha a próxima data."); return; }
    if (tipoGatilho === "horas" && !intervaloHoras) { toast.erro("Informe o intervalo de horas."); return; }
    try {
      await salvar.mutateAsync({
        id: editando?.id, descricao, tipo_gatilho: tipoGatilho,
        periodicidade: periodicidade || null, proxima_data: proximaData || null,
        intervalo_horas: intervaloHoras ? Number(intervaloHoras) : null,
        horimetro_base: editando?.horimetro_base ?? horimetroAtual,
        custo_previsto: custoPrevisto ? Number(custoPrevisto) : 0,
        observacao: observacao || null,
      });
      toast.sucesso("Manutenção salva!");
      aoFechar();
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={editando ? "Editar manutenção" : "Nova manutenção"}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Descrição</Label>
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Troca de óleo" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Gatilho</Label>
          <SegmentedControl opcoes={[{ valor: "data", label: "Por data" }, { valor: "horas", label: "Por horímetro" }]} valor={tipoGatilho} aoMudar={setTipoGatilho} />
        </div>
        {tipoGatilho === "data" ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Periodicidade</Label>
              <Input value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value)} placeholder="Ex: Anual" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Próxima data</Label>
              <Input type="date" value={proximaData} onChange={(e) => setProximaData(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Intervalo (horas)</Label>
              <Input type="number" min={1} value={intervaloHoras} onChange={(e) => setIntervaloHoras(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Custo previsto (R$)</Label>
              <Input type="number" min={0} step={0.01} value={custoPrevisto} onChange={(e) => setCustoPrevisto(e.target.value)} />
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label>Observação</Label>
          <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button onClick={salvarForm} disabled={salvar.isPending}>{salvar.isPending ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </Modal>
  );
}
