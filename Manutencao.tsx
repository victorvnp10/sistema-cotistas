import { useMemo, useState } from "react";
import { Wrench, Gauge, CalendarClock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  useManutencoes,
  useUltimoHorimetroManutencao,
  useSalvarManutencao,
  useExcluirManutencao,
  useConcluirManutencao,
  useProjecaoManutencaoHoras,
} from "@/lib/queries/useManutencoes";
import { formatarMoeda } from "@/lib/formato";
import { formatarDataBR } from "@/lib/ranking";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Database } from "@/types/database.types";

type Manutencao = Database["public"]["Tables"]["manutencoes"]["Row"];

// Resumo por manutenção derivado da projeção (que vem discriminada por
// membro — aqui só precisamos do total do ciclo, igual em todas as linhas
// da mesma manutenção).
type ResumoHoras = { horasUsadas: number; horasRestantes: number };

function diasRestantes(proximaData: string | null): number | null {
  if (!proximaData) return null;
  return Math.round((new Date(proximaData + "T00:00:00").getTime() - Date.now()) / 86400000);
}

// Vence o que chegar primeiro: converte horas restantes numa escala
// aproximada de "dias" (8h de uso ~ 1 dia) e pega o menor prazo entre
// data e horímetro, igual ao critério usado no Painel do Gestor.
function status(m: Manutencao, resumo: ResumoHoras | undefined): "ok" | "normal" | "alert" | "warn" | "urgent" | "venc" {
  if (m.feito) return "ok";
  const candidatos: number[] = [];
  const dias = diasRestantes(m.proxima_data);
  if (dias !== null) candidatos.push(dias);
  if (resumo && m.intervalo_horas !== null) candidatos.push(resumo.horasRestantes / 8);
  if (!candidatos.length) return "normal";
  const chave = Math.min(...candidatos);
  if (chave < 0) return "venc";
  if (chave <= 7) return "urgent";
  if (chave <= 15) return "warn";
  if (chave <= 30) return "alert";
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
  const { data: projecao } = useProjecaoManutencaoHoras();
  const excluir = useExcluirManutencao();
  const concluir = useConcluirManutencao();

  const [modalForm, setModalForm] = useState<{ aberto: boolean; editando: Manutencao | null }>({ aberto: false, editando: null });
  const [modalConcluir, setModalConcluir] = useState<Manutencao | null>(null);
  const [dataFechamento, setDataFechamento] = useState(new Date().toISOString().slice(0, 10));
  const [custoReal, setCustoReal] = useState("");
  const [reagendarDias, setReagendarDias] = useState("");

  const horimetro = horimetroAtual ?? 0;

  // Agrupa a projeção (vem uma linha por membro) num resumo único por
  // manutenção — todas as linhas da mesma manutenção têm o mesmo total.
  const resumoPorManutencao = useMemo(() => {
    const mapa: Record<string, ResumoHoras> = {};
    for (const linha of projecao ?? []) {
      if (!mapa[linha.manutencao_id]) {
        mapa[linha.manutencao_id] = { horasUsadas: linha.horas_usadas, horasRestantes: linha.horas_restantes };
      }
    }
    return mapa;
  }, [projecao]);

  function abrirModalConcluir(m: Manutencao) {
    setModalConcluir(m);
    setDataFechamento(new Date().toISOString().slice(0, 10));
    setCustoReal(m.custo_previsto ? String(m.custo_previsto) : "");
    setReagendarDias("");
  }

  async function confirmarConclusao() {
    if (!modalConcluir) return;
    if (!custoReal || Number(custoReal) <= 0) {
      toast.erro("Informe o custo real da manutenção — é ele que é rateado entre os cotistas.");
      return;
    }
    try {
      await concluir.mutateAsync({
        manutencaoId: modalConcluir.id,
        dataFechamento,
        custoReal: Number(custoReal),
        reagendarDias: reagendarDias ? Number(reagendarDias) : undefined,
      });
      toast.sucesso("Manutenção concluída e custo rateado entre os cotistas!");
      setModalConcluir(null);
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
              const resumo = resumoPorManutencao[m.id];
              const st = status(m, resumo);
              return (
                <div key={m.id} className="rounded-2xl border border-border/60 bg-white p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="text-[14px] font-bold">{m.descricao}</p>
                    <Badge variant={BADGE_VARIANT[st]}>{LABELS[st]}</Badge>
                  </div>
                  <div className="mb-2 flex flex-col gap-1 text-[12px] text-muted-foreground">
                    {m.intervalo_horas !== null && (
                      <span className="flex items-center gap-1.5">
                        <Gauge size={13} /> {(resumo?.horasUsadas ?? 0).toFixed(1)}h de {m.intervalo_horas.toFixed(1)}h neste ciclo
                      </span>
                    )}
                    {m.proxima_data && (
                      <span className="flex items-center gap-1.5">
                        <CalendarClock size={13} /> {formatarDataBR(m.proxima_data)}
                      </span>
                    )}
                  </div>
                  {!!m.custo_previsto && <p className="mb-2 text-[12px] text-muted-foreground">Previsto: {formatarMoeda(m.custo_previsto)}</p>}
                  {podeGerenciarOrcamento && (
                    <div className="flex flex-wrap gap-2">
                      {!m.feito && <Button size="sm" variant="success" onClick={() => abrirModalConcluir(m)}>Concluir</Button>}
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

      <Modal aberto={!!modalConcluir} aoFechar={() => setModalConcluir(null)} titulo="Concluir manutenção">
        <div className="flex flex-col gap-3">
          <p className="text-[13.5px] text-muted-foreground">{modalConcluir?.descricao}</p>

          <div className="flex flex-col gap-1.5">
            <Label>Data de fechamento</Label>
            <Input type="date" value={dataFechamento} onChange={(e) => setDataFechamento(e.target.value)} />
            <p className="text-[11.5px] text-muted-foreground">O próximo ciclo começa exatamente nesta data.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Custo real gasto (R$)</Label>
            <Input type="number" min={0} step={0.01} value={custoReal} onChange={(e) => setCustoReal(e.target.value)} />
            <p className="text-[11.5px] text-muted-foreground">
              Pré-preenchido com o custo previsto — ajuste se o valor real foi diferente. É rateado entre os
              cotistas proporcionalmente às horas de uso registradas no Diário de Bordo neste ciclo (ou por
              cotas, se ninguém registrou uso), e cobrado na próxima mensalidade como custo de manutenção
              periódica.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Reagendar próxima data em quantos dias? (opcional)</Label>
            <Input type="number" min={1} value={reagendarDias} onChange={(e) => setReagendarDias(e.target.value)} />
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalConcluir(null)}>Cancelar</Button>
            <Button variant="success" onClick={confirmarConclusao} disabled={concluir.isPending}>
              {concluir.isPending ? "Concluindo..." : "Confirmar"}
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
  const [periodicidade, setPeriodicidade] = useState(editando?.periodicidade ?? "");
  const [proximaData, setProximaData] = useState(editando?.proxima_data ?? "");
  const [intervaloHoras, setIntervaloHoras] = useState(String(editando?.intervalo_horas ?? ""));
  const [dataInicioCiclo, setDataInicioCiclo] = useState(editando?.data_inicio_ciclo ?? new Date().toISOString().slice(0, 10));
  const [horimetroBase, setHorimetroBase] = useState(String(editando?.horimetro_base ?? horimetroAtual));
  const [custoPrevisto, setCustoPrevisto] = useState(String(editando?.custo_previsto ?? ""));
  const [observacao, setObservacao] = useState(editando?.observacao ?? "");

  const chave = editando?.id ?? "novo";
  const [ultimaChave, setUltimaChave] = useState(chave);
  if (chave !== ultimaChave) {
    setUltimaChave(chave);
    setDescricao(editando?.descricao ?? "");
    setPeriodicidade(editando?.periodicidade ?? "");
    setProximaData(editando?.proxima_data ?? "");
    setIntervaloHoras(String(editando?.intervalo_horas ?? ""));
    setDataInicioCiclo(editando?.data_inicio_ciclo ?? new Date().toISOString().slice(0, 10));
    setHorimetroBase(String(editando?.horimetro_base ?? horimetroAtual));
    setCustoPrevisto(String(editando?.custo_previsto ?? ""));
    setObservacao(editando?.observacao ?? "");
  }

  async function salvarForm() {
    if (!descricao) { toast.erro("Preencha a descrição."); return; }
    if (!proximaData && !intervaloHoras) {
      toast.erro("Informe ao menos uma data ou um intervalo de horas (pode preencher os dois).");
      return;
    }
    try {
      await salvar.mutateAsync({
        id: editando?.id, descricao,
        periodicidade: periodicidade || null, proxima_data: proximaData || null,
        intervalo_horas: intervaloHoras ? Number(intervaloHoras) : null,
        data_inicio_ciclo: dataInicioCiclo,
        horimetro_base: horimetroBase !== "" ? Number(horimetroBase) : horimetroAtual,
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

        <p className="text-[11.5px] font-medium text-muted-foreground">
          Vence o que chegar primeiro — preencha data, horas, ou os dois.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Periodicidade</Label>
            <Input value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value)} placeholder="Ex: Anual" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Próxima data</Label>
            <Input type="date" value={proximaData} onChange={(e) => setProximaData(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Intervalo (horas)</Label>
            <Input type="number" min={1} value={intervaloHoras} onChange={(e) => setIntervaloHoras(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Início da contagem de horas</Label>
            <Input type="date" value={dataInicioCiclo} onChange={(e) => setDataInicioCiclo(e.target.value)} />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5 -mt-1">
            <p className="text-[11.5px] text-muted-foreground">
              A partir desta data o sistema soma as horas do Diário de Bordo pra este ciclo. Se essa
              manutenção já vinha de antes e você só está cadastrando agora, ajuste para a data real em que
              o ciclo começou — senão as horas de uso anteriores a hoje não contam.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Custo previsto (R$)</Label>
            <Input type="number" min={0} step={0.01} value={custoPrevisto} onChange={(e) => setCustoPrevisto(e.target.value)} />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>Horímetro base (referência manual, opcional)</Label>
            <Input type="number" step={0.1} value={horimetroBase} onChange={(e) => setHorimetroBase(e.target.value)} />
            <p className="text-[11.5px] text-muted-foreground">
              As horas usadas neste ciclo já são contadas automaticamente pelos lançamentos do Diário de
              Bordo. Este campo é só uma referência do horímetro da embarcação no início do ciclo — pode
              ficar como está na maioria dos casos.
            </p>
          </div>
        </div>

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
