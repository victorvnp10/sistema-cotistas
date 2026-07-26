import { useState } from "react";
import { Printer, BarChart3 } from "lucide-react";
import { usePainelGestor } from "@/lib/queries/usePainelGestor";
import { formatarMoeda } from "@/lib/formato";
import { formatarDataBR } from "@/lib/ranking";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function PainelGestor() {
  const hoje = new Date();
  const [mesRefInput, setMesRefInput] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`);
  const mesRef = `${mesRefInput}-01`;
  const anoRef = Number(mesRefInput.split("-")[0]);

  const { data: painel, isLoading, isError } = usePainelGestor(mesRef, anoRef);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Card className="no-print">
        <h2 className="mb-4 flex items-center gap-2 text-[15px] font-bold"><BarChart3 size={17} className="text-royal" /> Painel do Gestor</h2>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label>Mês de referência</Label>
            <Input type="month" value={mesRefInput} onChange={(e) => setMesRefInput(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => window.print()}><Printer size={16} /> Imprimir (A4)</Button>
        </div>
      </Card>

      {isLoading && <p className="text-[13px] text-muted-foreground">Carregando...</p>}
      {isError && <p className="text-[13px] font-medium text-destructive">Só Admin/Gestor podem acessar.</p>}

      {painel && (
        <>
          <Card>
            <h2 className="mb-4 text-[15px] font-bold">Totais de uso — {MESES[Number(painel.mesRef.split("-")[1]) - 1]}/{painel.anoRef}</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-6 [&>*]:min-w-0">
              <StatCard titulo="Úteis (mês)" valor={String(painel.totais.diasUteisMes)} />
              <StatCard titulo="Todos (mês)" valor={String(painel.totais.diasTodosMes)} />
              <StatCard titulo="Úteis (ano)" valor={String(painel.totais.diasUteisAno)} />
              <StatCard titulo="Todos (ano)" valor={String(painel.totais.diasTodosAno)} />
              <StatCard titulo="Horas (mês)" valor={`${painel.totais.horasMes.toFixed(1)}h`} />
              <StatCard titulo="Horas (ano)" valor={`${painel.totais.horasAno.toFixed(1)}h`} />
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-[15px] font-bold">Uso por cotista</h2>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[620px] text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase text-muted-foreground">
                    <th className="whitespace-nowrap pb-2">Cotista</th><th className="whitespace-nowrap pb-2">Úteis (m)</th><th className="whitespace-nowrap pb-2">Todos (m)</th>
                    <th className="whitespace-nowrap pb-2">Úteis (a)</th><th className="whitespace-nowrap pb-2">Todos (a)</th><th className="whitespace-nowrap pb-2">Horas (m)</th>
                    <th className="whitespace-nowrap pb-2">Horas (a)</th><th className="whitespace-nowrap pb-2">Óleo</th>
                  </tr>
                </thead>
                <tbody>
                  {painel.porUsuario.map((u) => (
                    <tr key={u.membroId} className={!u.ativo ? "opacity-50" : ""}>
                      <td className="whitespace-nowrap py-1.5 font-medium">{u.nome}</td>
                      <td className="whitespace-nowrap py-1.5">{u.diasUteisMes}</td><td className="whitespace-nowrap py-1.5">{u.diasTodosMes}</td>
                      <td className="whitespace-nowrap py-1.5">{u.diasUteisAno}</td><td className="whitespace-nowrap py-1.5">{u.diasTodosAno}</td>
                      <td className="whitespace-nowrap py-1.5">{u.horasMes.toFixed(1)}h</td><td className="whitespace-nowrap py-1.5">{u.horasAno.toFixed(1)}h</td>
                      <td className="whitespace-nowrap py-1.5">{formatarMoeda(u.custoOleoMes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-[15px] font-bold">Balanço financeiro do mês</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 [&>*]:min-w-0">
              <StatCard titulo="Custo fixo" valor={formatarMoeda(painel.financeiro.custoFixoMes)} />
              <StatCard titulo="Custo variável" valor={formatarMoeda(painel.financeiro.custoVariavelMes)} />
              <StatCard titulo="Despesa total" valor={formatarMoeda(painel.financeiro.despesaTotalMes)} destaque />
              <StatCard titulo="Reserva de emergência" valor={formatarMoeda(painel.financeiro.reservaEmergencia)} />
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-[15px] font-bold">Custos variáveis</h2>
            <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3 [&>*]:min-w-0">
              <StatCard titulo="Óleo / hora" valor={formatarMoeda(painel.custosVariaveis.custoOleoPorHora)} />
              <StatCard titulo="Óleo (mês)" valor={formatarMoeda(painel.custosVariaveis.custoOleoTotalMes)} />
              <StatCard titulo="Rateios pendentes" valor={String(painel.custosVariaveis.rateiosPendentes)} />
            </div>
            {!!painel.custosVariaveis.manutencoesHoras.length && (
              <div className="overflow-x-auto">
              <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[560px] text-[12px]">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="whitespace-nowrap pb-1">Descrição</th><th className="whitespace-nowrap pb-1">Data</th><th className="whitespace-nowrap pb-1">Início do ciclo</th>
                      <th className="whitespace-nowrap pb-1">Intervalo</th><th className="whitespace-nowrap pb-1">Usadas</th><th className="whitespace-nowrap pb-1">Restante</th><th className="whitespace-nowrap pb-1">Previsto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {painel.custosVariaveis.manutencoesHoras.map((m, i) => (
                      <tr key={i} className={m.horasRestantes < 0 ? "bg-destructive/5" : ""}>
                        <td className="whitespace-nowrap py-1">{m.descricao}</td>
                        <td className="whitespace-nowrap py-1">{m.proximaData ? formatarDataBR(m.proximaData) : "—"}</td>
                        <td className="whitespace-nowrap py-1">{formatarDataBR(m.dataInicioCiclo)}</td>
                        <td className="whitespace-nowrap py-1">{m.intervaloHoras}h</td>
                        <td className="whitespace-nowrap py-1">{m.horasUsadas.toFixed(1)}h</td>
                        <td className="whitespace-nowrap py-1">{m.horasRestantes < 0 ? `venc. ${Math.abs(m.horasRestantes).toFixed(1)}h` : `${m.horasRestantes.toFixed(1)}h`}</td>
                        <td className="whitespace-nowrap py-1">{formatarMoeda(m.custoPrevisto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
            )}
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card><h2 className="mb-3 text-[15px] font-bold">Receitas (discriminado)</h2><TabelaDiscriminado itens={painel.financeiro.receitasDetalhe} cor="text-success" /></Card>
            <Card><h2 className="mb-3 text-[15px] font-bold">Despesas (discriminado)</h2><TabelaDiscriminado itens={painel.financeiro.despesasDetalhe} cor="text-destructive" /></Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-[15px] font-bold">Validade do seguro</h2>
              {!painel.seguro ? <p className="text-[13px] text-muted-foreground">Nenhuma apólice cadastrada.</p> : (
                <div>
                  <p className="font-bold">{painel.seguro.apolice} {painel.seguro.seguradora ? `— ${painel.seguro.seguradora}` : ""}</p>
                  <p className="text-[12.5px] text-muted-foreground">
                    {formatarDataBR(painel.seguro.dataInicio)} até {formatarDataBR(painel.seguro.dataVencimento)} (
                    {painel.seguro.diasParaVencer < 0 ? `vencida há ${Math.abs(painel.seguro.diasParaVencer)}d` : `${painel.seguro.diasParaVencer}d`})
                  </p>
                  <p className="mt-1 text-[13.5px]">{formatarMoeda(painel.seguro.valor)}</p>
                </div>
              )}
            </Card>
            <Card>
              <h2 className="mb-3 text-[15px] font-bold">Próxima manutenção</h2>
              {!painel.proximaManutencao ? <p className="text-[13px] text-muted-foreground">Nenhuma pendente.</p> : (
                <div>
                  <p className="font-bold">{painel.proximaManutencao.descricao}</p>
                  <p className="text-[12.5px] text-muted-foreground">
                    {painel.proximaManutencao.proximaData && (
                      <span>
                        {formatarDataBR(painel.proximaManutencao.proximaData)}
                        {painel.proximaManutencao.diasParaVencer !== null && (
                          painel.proximaManutencao.diasParaVencer < 0
                            ? ` (vencida há ${Math.abs(painel.proximaManutencao.diasParaVencer)}d)`
                            : ` (${painel.proximaManutencao.diasParaVencer}d)`
                        )}
                      </span>
                    )}
                    {painel.proximaManutencao.proximaData && painel.proximaManutencao.horasRestantes !== null && " · "}
                    {painel.proximaManutencao.horasRestantes !== null && (
                      (painel.proximaManutencao.horasRestantes < 0
                        ? `vencida há ${Math.abs(painel.proximaManutencao.horasRestantes).toFixed(1)}h`
                        : `${painel.proximaManutencao.horasRestantes.toFixed(1)}h restantes`)
                    )}
                    {!painel.proximaManutencao.proximaData && painel.proximaManutencao.horasRestantes === null && "—"}
                  </p>
                  {!!painel.proximaManutencao.custoPrevisto && <p className="text-[13.5px]">{formatarMoeda(painel.proximaManutencao.custoPrevisto)}</p>}
                </div>
              )}
            </Card>
          </div>

          <Card>
            <h2 className="mb-3 text-[15px] font-bold">Relatórios de uso pendentes</h2>
            {!painel.relatoriosPendentesTodos.length ? (
              <p className="text-[13px] text-muted-foreground">Nenhum pendente. Todos em dia!</p>
            ) : (
              <div className="flex flex-col gap-2">
                {painel.relatoriosPendentesTodos.map((p) => (
                  <div key={p.membroId} className="flex items-center justify-between gap-2 text-[13.5px]">
                    <span className="truncate">{p.nome}</span>
                    <Badge variant="warning">{p.pendentes} pendente(s)</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function TabelaDiscriminado({ itens, cor }: { itens: { id: string; descricao: string; valor: number; data: string; previsto: boolean }[]; cor: string }) {
  if (!itens.length) return <p className="text-[13px] text-muted-foreground">Nenhum lançamento no mês.</p>;
  return (
    <div className="flex flex-col gap-1.5">
      {itens.map((it) => (
        <div key={it.id} className={`flex items-start justify-between gap-2 rounded-xl px-2.5 py-1.5 text-[12.5px] ${it.previsto ? "bg-warning-soft" : ""}`}>
          <span className="flex flex-wrap items-center gap-1">
            {formatarDataBR(it.data)} · {it.descricao} {it.previsto && <Badge variant="warning">Previsto</Badge>}
          </span>
          <span className={`whitespace-nowrap font-bold ${cor}`}>{formatarMoeda(it.valor)}</span>
        </div>
      ))}
    </div>
  );
}
