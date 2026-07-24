import { useState } from "react";
import { ShieldCheck, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  useSeguros,
  useRenovarSeguro,
  useAtualizarSeguro,
  useExcluirSeguro,
} from "@/lib/queries/useSeguro";
import { useSaldoAtual } from "@/lib/queries/useOrcamento";
import { formatarMoeda } from "@/lib/formato";
import { formatarDataBR } from "@/lib/ranking";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type SeguroRow = Database["public"]["Tables"]["seguros"]["Row"];

function diasAte(dataISO: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(dataISO + "T00:00:00").getTime() - hoje.getTime()) / 86400000);
}

function status(dias: number) {
  if (dias < 0) return "venc";
  if (dias <= 7) return "urgent";
  if (dias <= 20) return "warn";
  if (dias <= 45) return "alert";
  return "normal";
}

const LABELS: Record<string, string> = {
  normal: "Em dia",
  alert: "Atenção",
  warn: "Renovar em breve",
  urgent: "Urgente",
  venc: "Vencido",
};
const CORES: Record<string, string> = {
  normal: "border-sky-500 bg-sky-50",
  alert: "border-yellow-400 bg-yellow-50",
  warn: "border-orange-500 bg-orange-50",
  urgent: "border-purple-500 bg-purple-50",
  venc: "border-red-600 bg-red-50",
};

export default function Seguro() {
  const { podeGerenciarOrcamento, ehAdmin } = useAuth();
  const toast = useToast();
  const { data: seguros, isLoading } = useSeguros();
  const { data: saldoAtual } = useSaldoAtual();
  const renovar = useRenovarSeguro();
  const atualizar = useAtualizarSeguro();
  const excluir = useExcluirSeguro();

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<SeguroRow | null>(null);
  const [excluindo, setExcluindo] = useState<SeguroRow | null>(null);
  const atual = seguros?.[0] ?? null;
  const historico = (seguros ?? []).slice(1);

  const hoje = new Date().toISOString().slice(0, 10);
  const [apolice, setApolice] = useState("");
  const [seguradora, setSeguradora] = useState("");
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState("");
  const [valor, setValor] = useState("");
  const [lancarDespesa, setLancarDespesa] = useState(true);
  const [observacao, setObservacao] = useState("");

  function abrirRenovar() {
    const inicioSugerido =
      atual && diasAte(atual.data_vencimento) >= 0
        ? new Date(new Date(atual.data_vencimento).getTime() + 86400000).toISOString().slice(0, 10)
        : hoje;
    const fimSugerido = new Date(inicioSugerido);
    fimSugerido.setFullYear(fimSugerido.getFullYear() + 1);
    fimSugerido.setDate(fimSugerido.getDate() - 1);

    setEditando(null);
    setApolice(atual?.apolice ?? "");
    setSeguradora(atual?.seguradora ?? "");
    setDataInicio(inicioSugerido);
    setDataFim(fimSugerido.toISOString().slice(0, 10));
    setValor(atual ? String(atual.valor) : "");
    setLancarDespesa(true);
    setObservacao("");
    setModalAberto(true);
  }

  function abrirEditar(s: SeguroRow) {
    setEditando(s);
    setApolice(s.apolice);
    setSeguradora(s.seguradora ?? "");
    setDataInicio(s.data_inicio);
    setDataFim(s.data_vencimento);
    setValor(String(s.valor));
    setObservacao(s.observacao ?? "");
    setModalAberto(true);
  }

  async function confirmar() {
    if (!apolice || !dataInicio || !dataFim) {
      toast.erro("Preencha apólice, início e vencimento.");
      return;
    }
    try {
      if (editando) {
        await atualizar.mutateAsync({
          id: editando.id,
          apolice,
          seguradora,
          dataInicio,
          valor: Number(valor) || 0,
          dataVencimento: dataFim,
          observacao,
        });
        toast.sucesso("Apólice atualizada!");
      } else {
        await renovar.mutateAsync({
          apolice,
          seguradora,
          dataInicio,
          valor: Number(valor) || 0,
          dataVencimento: dataFim,
          lancarDespesa,
          observacao,
        });
        toast.sucesso("Apólice renovada com sucesso!");
      }
      setModalAberto(false);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    try {
      await excluir.mutateAsync(excluindo.id);
      toast.sucesso("Apólice excluída.");
      setExcluindo(null);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[15px] font-bold">
            <ShieldCheck size={17} className="text-royal" /> Seguro obrigatório
          </h2>
          {podeGerenciarOrcamento && <Button size="sm" onClick={abrirRenovar}>Renovar</Button>}
        </div>
        {isLoading ? null : !atual ? (
          <EmptyState titulo="Nenhuma apólice cadastrada" descricao='Use "Renovar" para cadastrar a vigente.' />
        ) : (
          (() => {
            const dias = diasAte(atual.data_vencimento);
            const st = status(dias);
            return (
              <div className={cn("rounded-lg border-l-4 p-4", CORES[st])}>
                <div className="mb-2 flex items-center justify-between">
                  <Badge variant={st === "normal" ? "success" : st === "venc" ? "error" : "warning"}>
                    {LABELS[st]}
                  </Badge>
                  {podeGerenciarOrcamento && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => abrirEditar(atual)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-muted-foreground hover:text-royal"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      {ehAdmin && (
                        <button
                          onClick={() => setExcluindo(atual)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-muted-foreground hover:text-destructive"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-lg font-extrabold">
                  Apólice {atual.apolice} {atual.seguradora ? `— ${atual.seguradora}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {dias < 0 ? `Vencido há ${Math.abs(dias)} dia(s)` : `Faltam ${dias} dia(s) para o vencimento`}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MiniStat titulo="Início" valor={formatarDataBR(atual.data_inicio)} />
                  <MiniStat titulo="Vencimento" valor={formatarDataBR(atual.data_vencimento)} />
                  <MiniStat titulo="Valor" valor={formatarMoeda(atual.valor)} />
                </div>
                {atual.observacao && <p className="mt-2 text-xs text-muted-foreground">{atual.observacao}</p>}
              </div>
            );
          })()
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-[15px] font-bold">Histórico de apólices</h2>
        {!historico.length ? (
          <EmptyState titulo="Nenhuma apólice anterior" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[10.5px] font-bold uppercase text-muted-foreground">
                  <th className="pb-2">Apólice</th>
                  <th className="pb-2">Seguradora</th>
                  <th className="pb-2">Início</th>
                  <th className="pb-2">Vencimento</th>
                  <th className="pb-2">Valor</th>
                  {podeGerenciarOrcamento && <th className="pb-2"></th>}
                </tr>
              </thead>
              <tbody>
                {historico.map((h) => (
                  <tr key={h.id}>
                    <td className="py-1.5">{h.apolice}</td>
                    <td className="py-1.5">{h.seguradora ?? "-"}</td>
                    <td className="py-1.5">{formatarDataBR(h.data_inicio)}</td>
                    <td className="py-1.5">{formatarDataBR(h.data_vencimento)}</td>
                    <td className="py-1.5">{formatarMoeda(h.valor)}</td>
                    {podeGerenciarOrcamento && (
                      <td className="py-1.5">
                        <div className="flex gap-2">
                          <button onClick={() => abrirEditar(h)} className="text-muted-foreground hover:text-royal" title="Editar">
                            <Pencil size={14} />
                          </button>
                          {ehAdmin && (
                            <button onClick={() => setExcluindo(h)} className="text-muted-foreground hover:text-destructive" title="Excluir">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal aberto={modalAberto} aoFechar={() => setModalAberto(false)} titulo={editando ? "Editar apólice" : "Renovar apólice"}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Apólice</Label>
              <Input value={apolice} onChange={(e) => setApolice(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Seguradora</Label>
              <Input value={seguradora} onChange={(e) => setSeguradora(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Vencimento</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Valor (R$)</Label>
            <Input type="number" min={0} step={0.01} value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          {!editando && (
            <>
              <label className="flex items-center gap-2 text-[13px] font-medium">
                <input
                  type="checkbox"
                  checked={lancarDespesa}
                  onChange={(e) => setLancarDespesa(e.target.checked)}
                  className="h-4 w-4 accent-royal"
                />
                Lançar como despesa (rateado)
              </label>
              <p className="text-[11.5px] text-muted-foreground">
                Saldo atual: <strong>{formatarMoeda(saldoAtual ?? 0)}</strong>
              </p>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Observação</Label>
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={confirmar} disabled={renovar.isPending || atualizar.isPending}>
              {renovar.isPending || atualizar.isPending ? "Salvando..." : editando ? "Salvar alterações" : "Confirmar renovação"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal aberto={!!excluindo} aoFechar={() => setExcluindo(null)} titulo="Excluir apólice">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-2xl bg-destructive/5 p-4">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-destructive" />
            <p className="text-[13.5px] text-foreground">
              Tem certeza que deseja excluir a apólice <strong>"{excluindo?.apolice}"</strong>? Essa ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setExcluindo(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarExclusao} disabled={excluir.isPending}>
              {excluir.isPending ? "Excluindo..." : "Sim, excluir"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MiniStat({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-2.5 text-center shadow-softer">
      <p className="truncate text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="truncate text-[13px] font-extrabold leading-tight text-foreground">{valor}</p>
    </div>
  );
}
