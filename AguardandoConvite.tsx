import { useState } from "react";
import { ShieldCheck, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useSeguros, useRenovarSeguro, useAtualizarSeguro, useExcluirSeguro } from "@/lib/queries/useSeguro";
import { useSaldoAtual } from "@/lib/queries/useOrcamento";
import { formatarMoeda } from "@/lib/formato";
import { formatarDataBR } from "@/lib/ranking";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Database } from "@/types/database.types";

type SeguroRow = Database["public"]["Tables"]["seguros"]["Row"];

function diasAte(dataISO: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(dataISO + "T00:00:00").getTime() - hoje.getTime()) / 86400000);
}

function status(dias: number): "success" | "warning" | "error" | "neutral" {
  if (dias < 0) return "error";
  if (dias <= 20) return "warning";
  if (dias <= 45) return "warning";
  return "success";
}
function label(dias: number) {
  if (dias < 0) return "Vencido";
  if (dias <= 7) return "Urgente";
  if (dias <= 20) return "Renovar em breve";
  if (dias <= 45) return "Atenção";
  return "Em dia";
}

export default function Seguro() {
  const { podeGerenciarOrcamento, ehAdmin } = useAuth();
  const toast = useToast();
  const { data: seguros, isLoading } = useSeguros();
  const { data: saldoAtual } = useSaldoAtual();
  const renovar = useRenovarSeguro();
  const atualizar = useAtualizarSeguro();
  const excluirSeguro = useExcluirSeguro();

  const [modalAberto, setModalAberto] = useState(false);
  const [modo, setModo] = useState<"renovar" | "editar">("renovar");
  const [idEditando, setIdEditando] = useState<string | null>(null);
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

  function abrirModal() {
    const inicioSugerido = atual && diasAte(atual.data_vencimento) >= 0
      ? new Date(new Date(atual.data_vencimento).getTime() + 86400000).toISOString().slice(0, 10)
      : hoje;
    const fimSugerido = new Date(inicioSugerido);
    fimSugerido.setFullYear(fimSugerido.getFullYear() + 1);
    fimSugerido.setDate(fimSugerido.getDate() - 1);

    setModo("renovar");
    setIdEditando(null);
    setApolice(atual?.apolice ?? "");
    setSeguradora(atual?.seguradora ?? "");
    setDataInicio(inicioSugerido);
    setDataFim(fimSugerido.toISOString().slice(0, 10));
    setValor(atual ? String(atual.valor) : "");
    setLancarDespesa(true);
    setObservacao("");
    setModalAberto(true);
  }

  function abrirEdicao(s: SeguroRow) {
    setModo("editar");
    setIdEditando(s.id);
    setApolice(s.apolice);
    setSeguradora(s.seguradora ?? "");
    setDataInicio(s.data_inicio);
    setDataFim(s.data_vencimento);
    setValor(String(s.valor));
    setLancarDespesa(false);
    setObservacao(s.observacao ?? "");
    setModalAberto(true);
  }

  async function confirmar() {
    if (!apolice || !dataInicio || !dataFim) { toast.erro("Preencha apólice, início e vencimento."); return; }
    try {
      if (modo === "editar" && idEditando) {
        await atualizar.mutateAsync({ id: idEditando, apolice, seguradora, dataInicio, valor: Number(valor) || 0, dataVencimento: dataFim, observacao });
        toast.sucesso("Apólice atualizada!");
      } else {
        await renovar.mutateAsync({ apolice, seguradora, dataInicio, valor: Number(valor) || 0, dataVencimento: dataFim, lancarDespesa, observacao });
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
      await excluirSeguro.mutateAsync(excluindo.id);
      toast.sucesso("Apólice excluída!");
      setExcluindo(null);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Card>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[15px] font-bold"><ShieldCheck size={17} className="text-royal" /> Seguro obrigatório</h2>
          <div className="flex shrink-0 items-center gap-1.5">
            {podeGerenciarOrcamento && atual && (
              <button
                onClick={() => abrirEdicao(atual)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary"
                aria-label="Editar apólice"
              >
                <Pencil size={15} />
              </button>
            )}
            {ehAdmin && atual && (
              <button
                onClick={() => setExcluindo(atual)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Excluir apólice"
              >
                <Trash2 size={15} />
              </button>
            )}
            {podeGerenciarOrcamento && <Button size="sm" onClick={abrirModal}>Renovar</Button>}
          </div>
        </div>
        {isLoading ? null : !atual ? (
          <EmptyState titulo="Nenhuma apólice cadastrada" descricao='Use "Renovar" para cadastrar a vigente.' />
        ) : (() => {
          const dias = diasAte(atual.data_vencimento);
          return (
            <div className="rounded-2xl bg-secondary/60 p-4">
              <div className="mb-2 flex items-center justify-between">
                <Badge variant={status(dias)}>{label(dias)}</Badge>
              </div>
              <p className="truncate text-[16px] font-extrabold">{atual.apolice} {atual.seguradora ? `— ${atual.seguradora}` : ""}</p>
              <p className="mb-3 text-[12.5px] text-muted-foreground">
                {dias < 0 ? `Vencido há ${Math.abs(dias)} dia(s)` : `Faltam ${dias} dia(s) para o vencimento`}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <StatCard tamanho="compacto" titulo="Início" valor={formatarDataBR(atual.data_inicio)} />
                <StatCard tamanho="compacto" titulo="Vencimento" valor={formatarDataBR(atual.data_vencimento)} />
                <StatCard tamanho="compacto" titulo="Valor" valor={formatarMoeda(atual.valor)} />
              </div>
              {atual.observacao && <p className="mt-2 text-[12px] text-muted-foreground">{atual.observacao}</p>}
            </div>
          );
        })()}
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
                  <th className="pb-2">Apólice</th><th className="pb-2">Seguradora</th><th className="pb-2">Início</th><th className="pb-2">Vencimento</th><th className="pb-2">Valor</th>
                  {(podeGerenciarOrcamento || ehAdmin) && <th className="pb-2 text-right">Ações</th>}
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
                    {(podeGerenciarOrcamento || ehAdmin) && (
                      <td className="py-1.5">
                        <div className="flex items-center justify-end gap-1">
                          {podeGerenciarOrcamento && (
                            <button onClick={() => abrirEdicao(h)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary" aria-label="Editar apólice">
                              <Pencil size={13} />
                            </button>
                          )}
                          {ehAdmin && (
                            <button onClick={() => setExcluindo(h)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Excluir apólice">
                              <Trash2 size={13} />
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

      <Modal aberto={modalAberto} aoFechar={() => setModalAberto(false)} titulo={modo === "editar" ? "Editar apólice" : "Renovar apólice"}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><Label>Apólice</Label><Input value={apolice} onChange={(e) => setApolice(e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label>Seguradora</Label><Input value={seguradora} onChange={(e) => setSeguradora(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><Label>Início</Label><Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label>Vencimento</Label><Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></div>
          </div>
          <div className="flex flex-col gap-1.5"><Label>Valor (R$)</Label><Input type="number" min={0} step={0.01} value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          {modo === "renovar" && (
            <>
              <label className="flex items-center gap-2 text-[13px] font-medium">
                <input type="checkbox" checked={lancarDespesa} onChange={(e) => setLancarDespesa(e.target.checked)} className="h-4 w-4 accent-royal" />
                Lançar como despesa (rateado)
              </label>
              <p className="text-[11.5px] text-muted-foreground">Saldo atual: <strong>{formatarMoeda(saldoAtual ?? 0)}</strong></p>
            </>
          )}
          <div className="flex flex-col gap-1.5"><Label>Observação</Label><Input value={observacao} onChange={(e) => setObservacao(e.target.value)} /></div>
          {modo === "editar" && (
            <p className="text-[11.5px] text-muted-foreground">Isso apenas corrige os dados da apólice — nenhuma despesa é lançada ou alterada.</p>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={confirmar} disabled={renovar.isPending || atualizar.isPending}>
              {renovar.isPending || atualizar.isPending ? "Salvando..." : "Confirmar"}
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
              {excluindo && excluindo.valor > 0 && " A despesa já lançada relacionada a ela (se houver) não será removida automaticamente."}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setExcluindo(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarExclusao} disabled={excluirSeguro.isPending}>
              {excluirSeguro.isPending ? "Excluindo..." : "Sim, excluir"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
