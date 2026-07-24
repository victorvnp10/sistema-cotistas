import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
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

const CORES: Record<string, string> = {
  ok: "border-l-green-600 bg-green-50",
  normal: "border-l-gray-300",
  alert: "border-l-yellow-400 bg-yellow-50",
  warn: "border-l-orange-500 bg-orange-50",
  urgent: "border-l-purple-500 bg-purple-50",
  venc: "border-l-red-600 bg-red-50",
};
const LABELS: Record<string, string> = {
  ok: "Concluída",
  normal: "Em dia",
  alert: "Atenção",
  warn: "Próximo",
  urgent: "Urgente",
  venc: "Vencida",
};

export default function Manutencao() {
  const { podeGerenciarOrcamento } = useAuth();
  const toast = useToast();
  const { data: manutencoes, isLoading } = useManutencoes();
  const { data: horimetroAtual } = useUltimoHorimetroManutencao();
  const excluir = useExcluirManutencao();
  const concluirData = useConcluirManutencaoData();
  const concluirHoras = useConcluirManutencaoHoras();

  const [modalForm, setModalForm] = useState<{ aberto: boolean; editando: Manutencao | null }>({
    aberto: false,
    editando: null,
  });
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
      await concluirData.mutateAsync({
        id: modalConcluirData.id,
        reagendarDias: reagendarDias ? Number(reagendarDias) : undefined,
        proximaData,
      });
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
      toast.sucesso("Manutenção concluída e custo rateado por horas de uso!");
      setModalConcluirHoras(null);
      setCustoReal("");
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao concluir.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>🔧 Manutenções</CardTitle>
          {podeGerenciarOrcamento && (
            <Button size="sm" onClick={() => setModalForm({ aberto: true, editando: null })}>
              + Nova manutenção
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Manutenções podem vencer por <strong>Data</strong> ou por <strong>Horímetro</strong>{" "}
            (a cada X horas de uso). As por horímetro são concluídas informando o custo real, que
            é rateado proporcional às horas usadas por cada cotista desde a última execução.
          </p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !manutencoes?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma manutenção cadastrada.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {manutencoes.map((m) => {
                const st = status(m, horimetro);
                return (
                  <div key={m.id} className={cn("rounded-lg border-l-4 bg-white p-3 shadow-sm", CORES[st])}>
                    <p className="font-semibold">{m.descricao}</p>
                    <div className="my-1 flex gap-1">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold">
                        {LABELS[st]}
                      </span>
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-700">
                        {m.tipo_gatilho === "horas" ? "Por horímetro" : "Por data"}
                      </span>
                    </div>
                    {m.tipo_gatilho === "horas" ? (
                      <p className="text-xs text-muted-foreground">
                        Horímetro atual: {horimetro.toFixed(1)}h · Próxima em{" "}
                        {(m.horimetro_base + (m.intervalo_horas ?? 0)).toFixed(1)}h
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Próxima: {m.proxima_data ? formatarDataBR(m.proxima_data) : "—"}
                      </p>
                    )}
                    {!!m.custo_previsto && (
                      <p className="text-xs text-muted-foreground">Custo previsto: {formatarMoeda(m.custo_previsto)}</p>
                    )}
                    {m.observacao && <p className="text-xs text-muted-foreground">{m.observacao}</p>}
                    {podeGerenciarOrcamento && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {!m.feito &&
                          (m.tipo_gatilho === "horas" ? (
                            <Button size="sm" variant="success" onClick={() => setModalConcluirHoras(m)}>
                              Concluir e ratear
                            </Button>
                          ) : (
                            <Button size="sm" variant="success" onClick={() => setModalConcluirData(m)}>
                              Concluir
                            </Button>
                          ))}
                        <Button size="sm" variant="outline" onClick={() => setModalForm({ aberto: true, editando: m })}>
                          Editar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => excluir.mutate(m.id)}>
                          Excluir
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ModalFormManutencao
        aberto={modalForm.aberto}
        editando={modalForm.editando}
        horimetroAtual={horimetro}
        aoFechar={() => setModalForm({ aberto: false, editando: null })}
      />

      <Modal aberto={!!modalConcluirData} aoFechar={() => setModalConcluirData(null)} titulo="Confirmar execução">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{modalConcluirData?.descricao}</p>
          <div className="flex flex-col gap-1.5">
            <Label>Reagendar para dentro de quantos dias? (opcional)</Label>
            <Input type="number" min={1} value={reagendarDias} onChange={(e) => setReagendarDias(e.target.value)} />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalConcluirData(null)}>Cancelar</Button>
            <Button variant="success" onClick={concluirPorData}>Confirmar execução</Button>
          </div>
        </div>
      </Modal>

      <Modal aberto={!!modalConcluirHoras} aoFechar={() => setModalConcluirHoras(null)} titulo="Concluir manutenção (rateio por horas)">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{modalConcluirHoras?.descricao}</p>
          <p className="text-xs text-muted-foreground">
            Horímetro atual: {horimetro.toFixed(1)}h (base: {modalConcluirHoras?.horimetro_base.toFixed(1)}h)
          </p>
          <div className="flex flex-col gap-1.5">
            <Label>Custo real gasto (R$)</Label>
            <Input type="number" min={0} step={0.01} value={custoReal} onChange={(e) => setCustoReal(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Este valor será rateado entre os cotistas proporcional às horas que cada um usou
            desde a última manutenção. Um novo ciclo se inicia automaticamente.
          </p>
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

function ModalFormManutencao({
  aberto,
  editando,
  horimetroAtual,
  aoFechar,
}: {
  aberto: boolean;
  editando: Manutencao | null;
  horimetroAtual: number;
  aoFechar: () => void;
}) {
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
    if (!descricao) {
      toast.erro("Preencha a descrição.");
      return;
    }
    if (tipoGatilho === "data" && !proximaData) {
      toast.erro("Preencha a próxima data.");
      return;
    }
    if (tipoGatilho === "horas" && !intervaloHoras) {
      toast.erro("Informe o intervalo de horas.");
      return;
    }
    try {
      await salvar.mutateAsync({
        id: editando?.id,
        descricao,
        tipo_gatilho: tipoGatilho,
        periodicidade: periodicidade || null,
        proxima_data: proximaData || null,
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
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Troca de óleo do motor" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Gatilho de vencimento</Label>
          <select
            className="h-10 rounded-md border border-input px-2 text-sm"
            value={tipoGatilho}
            onChange={(e) => setTipoGatilho(e.target.value as TipoGatilhoManutencao)}
          >
            <option value="data">Por data (calendário)</option>
            <option value="horas">Por horímetro (horas de uso)</option>
          </select>
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
              <Label>Intervalo de horas</Label>
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
          <Button onClick={salvarForm} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
