import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useSeguros, useRenovarSeguro } from "@/lib/queries/useSeguro";
import { useSaldoAtual } from "@/lib/queries/useOrcamento";
import { formatarMoeda } from "@/lib/formato";
import { formatarDataBR } from "@/lib/ranking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

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
    const inicioSugerido =
      atual && diasAte(atual.data_vencimento) >= 0
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
    if (!apolice || !dataInicio || !dataFim) {
      toast.erro("Preencha apólice, início e vencimento.");
      return;
    }
    try {
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
      setModalAberto(false);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao renovar.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>🛡️ Seguro obrigatório</CardTitle>
          {podeGerenciarOrcamento && <Button size="sm" onClick={abrirModal}>🔄 Renovar apólice</Button>}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !atual ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma apólice cadastrada. Use "Renovar apólice" para cadastrar a vigente.
            </p>
          ) : (
            (() => {
              const dias = diasAte(atual.data_vencimento);
              const st = status(dias);
              return (
                <div className={cn("rounded-lg border-l-4 p-4", CORES[st])}>
                  <span className="mb-2 inline-block rounded-full bg-white px-3 py-0.5 text-xs font-bold">
                    {LABELS[st]}
                  </span>
                  <p className="text-lg font-extrabold">
                    Apólice {atual.apolice} {atual.seguradora ? `— ${atual.seguradora}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {dias < 0 ? `Vencido há ${Math.abs(dias)} dia(s)` : `Faltam ${dias} dia(s) para o vencimento`}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-white p-2">
                      <p className="text-xs text-muted-foreground">Início</p>
                      <p className="font-bold">{formatarDataBR(atual.data_inicio)}</p>
                    </div>
                    <div className="rounded-md bg-white p-2">
                      <p className="text-xs text-muted-foreground">Vencimento</p>
                      <p className="font-bold">{formatarDataBR(atual.data_vencimento)}</p>
                    </div>
                    <div className="rounded-md bg-white p-2">
                      <p className="text-xs text-muted-foreground">Valor</p>
                      <p className="font-bold">{formatarMoeda(atual.valor)}</p>
                    </div>
                  </div>
                  {atual.observacao && <p className="mt-2 text-xs text-muted-foreground">{atual.observacao}</p>}
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>📋 Histórico de apólices</CardTitle>
        </CardHeader>
        <CardContent>
          {!historico.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma apólice anterior registrada.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-muted-foreground">
                  <th className="pb-2">Apólice</th>
                  <th className="pb-2">Seguradora</th>
                  <th className="pb-2">Início</th>
                  <th className="pb-2">Vencimento</th>
                  <th className="pb-2">Valor</th>
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
          )}
        </CardContent>
      </Card>

      <Modal aberto={modalAberto} aoFechar={() => setModalAberto(false)} titulo="Renovar apólice de seguro">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Número da apólice</Label>
              <Input value={apolice} onChange={(e) => setApolice(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Seguradora</Label>
              <Input value={seguradora} onChange={(e) => setSeguradora(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Início da vigência</Label>
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={lancarDespesa} onChange={(e) => setLancarDespesa(e.target.checked)} />
            Lançar como despesa no Orçamento (rateado entre cotistas ativos)
          </label>
          <p className="text-xs text-muted-foreground">
            Saldo atual em caixa: <strong>{formatarMoeda(saldoAtual ?? 0)}</strong>. O caixa não pode ficar negativo.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label>Observação</Label>
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={confirmar} disabled={renovar.isPending}>
              {renovar.isPending ? "Renovando..." : "Confirmar renovação"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
