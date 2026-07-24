import { useState } from "react";
import { usePainelGestor } from "@/lib/queries/usePainelGestor";
import { formatarMoeda } from "@/lib/formato";
import { formatarDataBR } from "@/lib/ranking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function PainelGestor() {
  const hoje = new Date();
  const [mesRefInput, setMesRefInput] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
  );
  const mesRef = `${mesRefInput}-01`;
  const anoRef = Number(mesRefInput.split("-")[0]);

  const { data: painel, isLoading, isError } = usePainelGestor(mesRef, anoRef);

  return (
    <div className="flex flex-col gap-4">
      <Card className="no-print">
        <CardHeader>
          <CardTitle>📊 Painel do Gestor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Mês de referência</Label>
              <Input type="month" value={mesRefInput} onChange={(e) => setMesRefInput(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => window.print()}>
              🖨️ Imprimir relatório (A4)
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {isError && (
        <p className="text-sm text-destructive">
          Não foi possível carregar o painel (só Admin/Gestor podem acessar).
        </p>
      )}

      {painel && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                🏆 Totais de uso — {MESES[Number(painel.mesRef.split("-")[1]) - 1]}/{painel.anoRef}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                <MiniKpi titulo="Dias úteis (mês)" valor={String(painel.totais.diasUteisMes)} cor="bg-sky-700" />
                <MiniKpi titulo="Todos os dias (mês)" valor={String(painel.totais.diasTodosMes)} cor="bg-gray-500" />
                <MiniKpi titulo="Dias úteis (ano)" valor={String(painel.totais.diasUteisAno)} cor="bg-sky-700" />
                <MiniKpi titulo="Todos os dias (ano)" valor={String(painel.totais.diasTodosAno)} cor="bg-gray-500" />
                <MiniKpi titulo="Horas (mês)" valor={`${painel.totais.horasMes.toFixed(1)}h`} cor="bg-green-700" />
                <MiniKpi titulo="Horas (ano)" valor={`${painel.totais.horasAno.toFixed(1)}h`} cor="bg-green-900" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>👥 Uso por cotista</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-muted-foreground">
                    <th className="pb-2">Cotista</th>
                    <th className="pb-2">Dias úteis (mês)</th>
                    <th className="pb-2">Todos (mês)</th>
                    <th className="pb-2">Dias úteis (ano)</th>
                    <th className="pb-2">Todos (ano)</th>
                    <th className="pb-2">Horas (mês)</th>
                    <th className="pb-2">Horas (ano)</th>
                    <th className="pb-2">Combustível (mês)</th>
                  </tr>
                </thead>
                <tbody>
                  {painel.porUsuario.map((u) => (
                    <tr key={u.membroId} className={!u.ativo ? "opacity-50" : ""}>
                      <td className="py-1.5">{u.nome} {!u.ativo && <span className="text-[10px]">(inativo)</span>}</td>
                      <td className="py-1.5">{u.diasUteisMes}</td>
                      <td className="py-1.5">{u.diasTodosMes}</td>
                      <td className="py-1.5">{u.diasUteisAno}</td>
                      <td className="py-1.5">{u.diasTodosAno}</td>
                      <td className="py-1.5">{u.horasMes.toFixed(1)}h</td>
                      <td className="py-1.5">{u.horasAno.toFixed(1)}h</td>
                      <td className="py-1.5">{formatarMoeda(u.custoCombustivelMes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>💰 Balanço financeiro do mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniKpi titulo="Custo fixo" valor={formatarMoeda(painel.financeiro.custoFixoMes)} cor="bg-red-600" />
                <MiniKpi titulo="Custo variável" valor={formatarMoeda(painel.financeiro.custoVariavelMes)} cor="bg-amber-700" />
                <MiniKpi titulo="Despesa total do mês" valor={formatarMoeda(painel.financeiro.despesaTotalMes)} cor="bg-orange-700" />
                <MiniKpi titulo="Reserva de emergência" valor={formatarMoeda(painel.financeiro.reservaEmergencia)} cor="bg-teal-700" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>⛽ Custos variáveis (combustível e manutenção por horas)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MiniKpi titulo="Combustível / hora" valor={formatarMoeda(painel.custosVariaveis.custoCombustivelPorHora)} cor="bg-amber-700" />
                <MiniKpi titulo="Combustível total (mês)" valor={formatarMoeda(painel.custosVariaveis.custoCombustivelTotalMes)} cor="bg-amber-800" />
                <MiniKpi titulo="Rateios de manutenção pendentes" valor={String(painel.custosVariaveis.rateiosPendentes)} cor="bg-gray-600" />
              </div>
              {!!painel.custosVariaveis.manutencoesHoras.length && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-1">Descrição</th>
                      <th className="pb-1">Data provável</th>
                      <th className="pb-1">Intervalo</th>
                      <th className="pb-1">Horímetro base</th>
                      <th className="pb-1">Horímetro atual</th>
                      <th className="pb-1">Restante</th>
                      <th className="pb-1">Custo previsto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {painel.custosVariaveis.manutencoesHoras.map((m, i) => (
                      <tr key={i} className={m.horasRestantes < 0 ? "bg-red-50" : ""}>
                        <td className="py-1">{m.descricao}</td>
                        <td className="py-1">{m.proximaData ? formatarDataBR(m.proximaData) : "—"}</td>
                        <td className="py-1">{m.intervaloHoras}h</td>
                        <td className="py-1">{m.horimetroBase.toFixed(1)}h</td>
                        <td className="py-1">{m.horimetroAtual.toFixed(1)}h</td>
                        <td className="py-1">
                          {m.horasRestantes < 0
                            ? `vencida há ${Math.abs(m.horasRestantes).toFixed(1)}h`
                            : `${m.horasRestantes.toFixed(1)}h`}
                        </td>
                        <td className="py-1">{formatarMoeda(m.custoPrevisto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>📈 Receitas do mês (discriminado)</CardTitle>
              </CardHeader>
              <CardContent>
                <TabelaDiscriminado itens={painel.financeiro.receitasDetalhe} cor="text-green-700" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>📉 Despesas do mês (discriminado)</CardTitle>
              </CardHeader>
              <CardContent>
                <TabelaDiscriminado itens={painel.financeiro.despesasDetalhe} cor="text-red-700" />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>🛡️ Validade do seguro</CardTitle>
              </CardHeader>
              <CardContent>
                {!painel.seguro ? (
                  <p className="text-sm text-muted-foreground">Nenhuma apólice cadastrada.</p>
                ) : (
                  <div>
                    <p className="font-bold">
                      Apólice {painel.seguro.apolice} {painel.seguro.seguradora ? `— ${painel.seguro.seguradora}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Validade: {formatarDataBR(painel.seguro.dataInicio)} até {formatarDataBR(painel.seguro.dataVencimento)} (
                      {painel.seguro.diasParaVencer < 0
                        ? `vencida há ${Math.abs(painel.seguro.diasParaVencer)} dia(s)`
                        : `${painel.seguro.diasParaVencer} dia(s) para vencer`}
                      )
                    </p>
                    <p className="mt-1 text-sm">Valor: {formatarMoeda(painel.seguro.valor)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>🔧 Próxima manutenção</CardTitle>
              </CardHeader>
              <CardContent>
                {!painel.proximaManutencao ? (
                  <p className="text-sm text-muted-foreground">Nenhuma manutenção pendente.</p>
                ) : (
                  <div>
                    <p className="font-bold">{painel.proximaManutencao.descricao}</p>
                    {painel.proximaManutencao.tipoGatilho === "horas" ? (
                      <p className="text-sm text-muted-foreground">
                        {painel.proximaManutencao.proximaData && `Data provável: ${formatarDataBR(painel.proximaManutencao.proximaData)} · `}
                        {(painel.proximaManutencao.horasRestantes ?? 0) < 0
                          ? `vencida há ${Math.abs(painel.proximaManutencao.horasRestantes ?? 0).toFixed(1)}h`
                          : `${(painel.proximaManutencao.horasRestantes ?? 0).toFixed(1)}h restantes`}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Próxima: {painel.proximaManutencao.proximaData ? formatarDataBR(painel.proximaManutencao.proximaData) : "—"} (
                        {(painel.proximaManutencao.diasParaVencer ?? 0) < 0
                          ? `vencida há ${Math.abs(painel.proximaManutencao.diasParaVencer ?? 0)} dia(s)`
                          : `${painel.proximaManutencao.diasParaVencer} dia(s) para vencer`}
                        )
                      </p>
                    )}
                    {!!painel.proximaManutencao.custoPrevisto && (
                      <p className="text-sm">Custo previsto: {formatarMoeda(painel.proximaManutencao.custoPrevisto)}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>⏳ Relatórios de uso pendentes (por cotista)</CardTitle>
            </CardHeader>
            <CardContent>
              {!painel.relatoriosPendentesTodos.length ? (
                <p className="text-sm text-muted-foreground">Nenhum relatório pendente. Todos em dia!</p>
              ) : (
                <div className="flex flex-col divide-y">
                  {painel.relatoriosPendentesTodos.map((p) => (
                    <div key={p.membroId} className="flex justify-between py-1.5 text-sm">
                      <span>{p.nome}</span>
                      <span className="font-bold text-orange-700">{p.pendentes} pendente(s)</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MiniKpi({ titulo, valor, cor }: { titulo: string; valor: string; cor: string }) {
  return (
    <div className={`rounded-lg ${cor} p-3 text-center text-white`}>
      <p className="text-lg font-extrabold">{valor}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-90">{titulo}</p>
    </div>
  );
}

function TabelaDiscriminado({
  itens,
  cor,
}: {
  itens: { id: string; descricao: string; valor: number; data: string; previsto: boolean }[];
  cor: string;
}) {
  if (!itens.length) return <p className="text-sm text-muted-foreground">Nenhum lançamento no mês.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] uppercase text-muted-foreground">
          <th className="pb-2">Data</th>
          <th className="pb-2">Descrição</th>
          <th className="pb-2">Valor</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((it) => (
          <tr key={it.id} className={it.previsto ? "bg-amber-50" : ""}>
            <td className="py-1">{formatarDataBR(it.data)}</td>
            <td className="py-1">
              {it.descricao}{" "}
              {it.previsto && (
                <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                  Previsto
                </span>
              )}
            </td>
            <td className={`py-1 font-bold ${cor}`}>{formatarMoeda(it.valor)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
