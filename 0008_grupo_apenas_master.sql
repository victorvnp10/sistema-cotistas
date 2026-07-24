import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useSeguros, useRenovarSeguro } from "@/lib/queries/useSeguro";
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
  const { podeGerenciarOrcamento } = useAuth();
  const toast = useToast();
  const { data: seguros, isLoading } = useSeguros();
  const { data: saldoAtual } = useSaldoAtual();
  const renovar = useRenovarSeguro();

  const [modalAberto, setModalAberto] = useState(false);
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

    setApolice(atual?.apolice ?? "");
    setSeguradora(atual?.seguradora ?? "");
    setDataInicio(inicioSugerido);
    setDataFim(fimSugerido.toISOString().slice(0, 10));
    setValor(atual ? String(atual.valor) : "");
    setLancarDespesa(true);
    setObservacao("");
    setModalAberto(true);
  }

  async function confirmar() {
    if (!apolice || !dataInicio || !dataFim) { toast.erro("Preencha apólice, início e vencimento."); return; }
    try {
      await renovar.mutateAsync({ apolice, seguradora, dataInicio, valor: Number(valor) || 0, dataVencimento: dataFim, lancarDespesa, observacao });
      toast.sucesso("Apólice renovada com sucesso!");
      setModalAberto(false);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao renovar.");
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[15px] font-bold"><ShieldCheck size={17} className="text-royal" /> Seguro obrigatório</h2>
          {podeGerenciarOrcamento && <Button size="sm" onClick={abrirModal}>Renovar</Button>}
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
              <p className="text-[16px] font-extrabold">{atual.apolice} {atual.seguradora ? `— ${atual.seguradora}` : ""}</p>
              <p className="mb-3 text-[12.5px] text-muted-foreground">
                {dias < 0 ? `Vencido há ${Math.abs(dias)} dia(s)` : `Faltam ${dias} dia(s) para o vencimento`}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <StatCard titulo="Início" valor={formatarDataBR(atual.data_inicio)} />
                <StatCard titulo="Vencimento" valor={formatarDataBR(atual.data_vencimento)} />
                <StatCard titulo="Valor" valor={formatarMoeda(atual.valor)} />
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal aberto={modalAberto} aoFechar={() => setModalAberto(false)} titulo="Renovar apólice">
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
          <label className="flex items-center gap-2 text-[13px] font-medium">
            <input type="checkbox" checked={lancarDespesa} onChange={(e) => setLancarDespesa(e.target.checked)} className="h-4 w-4 accent-royal" />
            Lançar como despesa (rateado)
          </label>
          <p className="text-[11.5px] text-muted-foreground">Saldo atual: <strong>{formatarMoeda(saldoAtual ?? 0)}</strong></p>
          <div className="flex flex-col gap-1.5"><Label>Observação</Label><Input value={observacao} onChange={(e) => setObservacao(e.target.value)} /></div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={confirmar} disabled={renovar.isPending}>{renovar.isPending ? "Renovando..." : "Confirmar"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
