import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useMembros } from "@/lib/queries/useMembros";
import { formatarMoeda, mesReferenciaAtual } from "@/lib/formato";
import { formatarDataBR } from "@/lib/ranking";
import {
  useLancamentos,
  useCriarLancamento,
  useExcluirLancamento,
  useRecorrentes,
  useCriarRecorrente,
  useAlterarValorRecorrente,
  useAtivarRecorrente,
  useConfirmacoes,
  useConfirmarPagamento,
  useMensalidadeMembro,
  useMensalidadesTodos,
  useSaldoAtual,
  useCustoFixoMes,
} from "@/lib/queries/useOrcamento";
import {
  useHistoricoCombustivel,
  useDefinirCustoCombustivel,
  useEditarCustoCombustivelAtual,
} from "@/lib/queries/useCombustivel";
import { useProjecaoManutencaoHoras } from "@/lib/queries/useManutencoes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import type { Database, TipoLancamento } from "@/types/database.types";

type Recorrente = Database["public"]["Tables"]["recorrentes"]["Row"];

export default function Orcamento() {
  const { grupoAtual, membroAtual, podeGerenciarOrcamento } = useAuth();
  const mesRef = mesReferenciaAtual();

  const { data: saldoAtual } = useSaldoAtual();
  const { data: custoFixoMes } = useCustoFixoMes(mesRef);
  const { data: mensalidade } = useMensalidadeMembro(membroAtual?.id);
  const { data: mensalidadesTodos } = useMensalidadesTodos();

  const termoCota = grupoAtual?.termo_cota ?? "cota";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>💰 Resumo do caixa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MiniKpi titulo="Saldo atual" valor={formatarMoeda(saldoAtual ?? 0)} cor="bg-teal-700" />
            <MiniKpi titulo="Custo fixo do mês" valor={formatarMoeda(custoFixoMes ?? 0)} cor="bg-red-600" />
            <MiniKpi
              titulo="Reserva de emergência"
              valor={formatarMoeda(mensalidade?.mesAtual.reservaEmergencia ?? 0)}
              cor="bg-cyan-700"
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            O Saldo Atual só conta lançamentos cuja data já ocorreu, e nunca é exibido
            negativo. A Reserva de Emergência cobre automaticamente o Custo Fixo do mês
            quando há saldo disponível.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>💵 Quanto você deve pagar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {mensalidade && (
              <>
                <CardMes titulo={`📅 ${mensalidade.mesAtual.mesRef} (atual)`} dados={mensalidade.mesAtual} destaque />
                <CardMes titulo={`⏩ ${mensalidade.proximoMes.mesRef} (próximo)`} dados={mensalidade.proximoMes} />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>👥 Mensalidade de todos os cotistas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-muted-foreground">
                <th className="pb-2">Cotista</th>
                <th className="pb-2">{termoCota}s</th>
                <th className="pb-2">Custo fixo</th>
                <th className="pb-2">Custo variável</th>
                <th className="pb-2">Reserva</th>
                <th className="pb-2">Total mês atual</th>
                <th className="pb-2">Total próximo mês</th>
              </tr>
            </thead>
            <tbody>
              {mensalidadesTodos?.map((v) => (
                <tr key={v.membro_id} className={v.membro_id === membroAtual?.id ? "bg-blue-50" : ""}>
                  <td className="py-1.5">{v.nome}</td>
                  <td className="py-1.5">{v.cotas}</td>
                  <td className="py-1.5">{formatarMoeda(v.custo_fixo_mes)}</td>
                  <td className="py-1.5">{formatarMoeda(v.custo_variavel_mes)}</td>
                  <td className="py-1.5">{formatarMoeda(v.reserva_emergencia_mes)}</td>
                  <td className="py-1.5 font-bold">{formatarMoeda(v.total_mes_atual)}</td>
                  <td className="py-1.5">{formatarMoeda(v.total_proximo_mes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {podeGerenciarOrcamento && <SecaoCombustivel />}
      <SecaoProjecaoManutencao />
      {podeGerenciarOrcamento && <SecaoLancamentos />}
      {podeGerenciarOrcamento && <SecaoRecorrentes />}
      {podeGerenciarOrcamento && <SecaoConfirmacoes />}
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

function CardMes({
  titulo,
  dados,
  destaque,
}: {
  titulo: string;
  dados: {
    custoFixo: number;
    custoVariavel?: number;
    reservaEmergencia: number;
    totalAPagar: number;
    cobertoPelaReserva?: number;
  };
  destaque?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${destaque ? "border-red-200 bg-red-50" : "border-sky-200 bg-sky-50"}`}>
      <p className="mb-1 text-xs font-bold uppercase">{titulo}</p>
      <p className="mb-2 text-2xl font-extrabold">{formatarMoeda(dados.totalAPagar)}</p>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Custo Fixo</span>
        <span className="font-semibold">{formatarMoeda(dados.custoFixo)}</span>
      </div>
      {!!dados.custoVariavel && (
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Custo Variável (combustível/manutenção)</span>
          <span className="font-semibold">{formatarMoeda(dados.custoVariavel)}</span>
        </div>
      )}
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Reserva de Emergência</span>
        <span className="font-semibold">{formatarMoeda(dados.reservaEmergencia)}</span>
      </div>
      {!!dados.cobertoPelaReserva && (
        <div className="flex justify-between text-xs text-green-700">
          <span>Coberto pela Reserva</span>
          <span className="font-semibold">-{formatarMoeda(dados.cobertoPelaReserva)}</span>
        </div>
      )}
    </div>
  );
}

function SecaoLancamentos() {
  const toast = useToast();
  const { data: lancamentos, isLoading } = useLancamentos();
  const criar = useCriarLancamento();
  const excluir = useExcluirLancamento();
  const [modalAberto, setModalAberto] = useState(false);

  const [tipo, setTipo] = useState<TipoLancamento>("receita");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));

  async function salvar() {
    if (!descricao || !valor) {
      toast.erro("Preencha descrição e valor.");
      return;
    }
    try {
      await criar.mutateAsync({ tipo, descricao, valor: Number(valor), data });
      toast.sucesso("Lançamento salvo!");
      setModalAberto(false);
      setDescricao("");
      setValor("");
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  async function remover(id: string) {
    try {
      await excluir.mutateAsync(id);
      toast.sucesso("Lançamento excluído.");
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>📋 Lançamentos</CardTitle>
        <Button size="sm" onClick={() => setModalAberto(true)}>
          + Novo lançamento
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="flex flex-col divide-y">
            {lancamentos?.slice(0, 30).map((l) => (
              <div key={l.id} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {l.descricao}{" "}
                    {l.origem !== "manual" && (
                      <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                        auto
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatarDataBR(l.data)}</p>
                </div>
                <span className={`font-bold ${l.tipo === "receita" ? "text-green-700" : "text-red-700"}`}>
                  {formatarMoeda(l.valor)}
                </span>
                <button
                  className="ml-3 text-xs font-semibold text-destructive hover:underline"
                  onClick={() => remover(l.id)}
                >
                  Excluir
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Modal aberto={modalAberto} aoFechar={() => setModalAberto(false)} titulo="Novo lançamento">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Tipo</Label>
            <select
              className="h-10 rounded-md border border-input px-2 text-sm"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoLancamento)}
            >
              <option value="receita">Reserva de Emergência (receita)</option>
              <option value="despesa">Despesa (Custo Fixo)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{tipo === "receita" ? "Valor por cota (R$)" : "Valor total (R$)"}</Label>
            <Input type="number" min={0} step={0.01} value={valor} onChange={(e) => setValor(e.target.value)} />
            {tipo === "receita" && (
              <p className="text-xs text-muted-foreground">
                O total lançado será este valor multiplicado pelo total de cotas ativas.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={criar.isPending}>
              {criar.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

function SecaoRecorrentes() {
  const toast = useToast();
  const { ehAdmin, grupoAtual } = useAuth();
  const { data: recorrentes, isLoading } = useRecorrentes();
  const criar = useCriarRecorrente();
  const alterarValor = useAlterarValorRecorrente();
  const ativar = useAtivarRecorrente();

  const [modalAberto, setModalAberto] = useState(false);
  const [modalValor, setModalValor] = useState<Recorrente | null>(null);
  const [novoValor, setNovoValor] = useState("");

  const [tipo, setTipo] = useState<TipoLancamento>("receita");
  const [descricao, setDescricao] = useState("");
  const [valorAtual, setValorAtual] = useState("");
  const [diaCobranca, setDiaCobranca] = useState(String(grupoAtual?.dia_virada ?? 4));

  async function salvarNovo() {
    if (!descricao || !valorAtual || !diaCobranca) {
      toast.erro("Preencha todos os campos.");
      return;
    }
    try {
      await criar.mutateAsync({
        tipo,
        descricao,
        valorAtual: Number(valorAtual),
        diaCobranca: Number(diaCobranca),
      });
      toast.sucesso("Recorrente criado!");
      setModalAberto(false);
      setDescricao("");
      setValorAtual("");
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao criar.");
    }
  }

  async function salvarNovoValor() {
    if (!modalValor || !novoValor) return;
    try {
      await alterarValor.mutateAsync({ recorrenteId: modalValor.id, novoValor: Number(novoValor) });
      toast.sucesso("Valor alterado!");
      setModalValor(null);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao alterar.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>🔁 Receitas e despesas recorrentes</CardTitle>
        {ehAdmin && (
          <Button size="sm" onClick={() => setModalAberto(true)}>
            + Novo recorrente
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recorrentes?.map((r) => (
              <div key={r.id} className={`rounded-lg border p-3 ${!r.ativo ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">
                    {r.descricao}{" "}
                    <span
                      className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        r.tipo === "receita" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {r.tipo === "receita" ? "Reserva de Emergência" : "Custo Fixo"}
                    </span>
                  </p>
                  <p className="font-bold">{formatarMoeda(r.valor_atual)}</p>
                </div>
                <p className="text-xs text-muted-foreground">Dia de cobrança: {r.dia_cobranca}</p>
                {ehAdmin && (
                  <div className="mt-2 flex gap-2">
                    <button
                      className="text-xs font-semibold text-primary hover:underline"
                      onClick={() => {
                        setModalValor(r);
                        setNovoValor(String(r.valor_atual));
                      }}
                    >
                      Alterar valor
                    </button>
                    <button
                      className="text-xs font-semibold text-muted-foreground hover:underline"
                      onClick={() => ativar.mutate({ id: r.id, ativo: !r.ativo })}
                    >
                      {r.ativo ? "Desativar" : "Reativar"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Modal aberto={modalAberto} aoFechar={() => setModalAberto(false)} titulo="Novo recorrente">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Tipo</Label>
            <select
              className="h-10 rounded-md border border-input px-2 text-sm"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoLancamento)}
            >
              <option value="receita">Reserva de Emergência (receita)</option>
              <option value="despesa">Despesa (Custo Fixo)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Garagem, Marinheiro, Mensalidade" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{tipo === "receita" ? "Valor por cota (R$)" : "Valor total (R$)"}</Label>
            <Input type="number" min={0} step={0.01} value={valorAtual} onChange={(e) => setValorAtual(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Dia de cobrança (1-31)</Label>
            <Input type="number" min={1} max={31} value={diaCobranca} onChange={(e) => setDiaCobranca(e.target.value)} />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={salvarNovo} disabled={criar.isPending}>
              {criar.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal aberto={!!modalValor} aoFechar={() => setModalValor(null)} titulo="Alterar valor">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            O valor anterior fica registrado no histórico — meses já fechados continuam
            usando o valor que estava vigente na época.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label>Novo valor (R$)</Label>
            <Input type="number" min={0} step={0.01} value={novoValor} onChange={(e) => setNovoValor(e.target.value)} />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalValor(null)}>Cancelar</Button>
            <Button onClick={salvarNovoValor} disabled={alterarValor.isPending}>
              {alterarValor.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

function SecaoConfirmacoes() {
  const toast = useToast();
  const { data: confirmacoes } = useConfirmacoes();
  const { data: recorrentes } = useRecorrentes();
  const { data: membros } = useMembros();
  const confirmar = useConfirmarPagamento();

  const mesPrefixo = new Date().toISOString().slice(0, 7);
  const confsMes = (confirmacoes ?? []).filter((c) => c.mes_referencia === mesPrefixo);

  async function alternar(id: string, atual: boolean) {
    try {
      await confirmar.mutateAsync({ confirmacaoId: id, confirmado: !atual });
      toast.sucesso(!atual ? "Confirmado!" : "Desfeito.");
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>✅ Confirmações de pagamento (este mês)</CardTitle>
      </CardHeader>
      <CardContent>
        {!confsMes.length ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma confirmação para este mês ainda — são geradas automaticamente pelo
            recorrente diário.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {confsMes.map((c) => {
              const rec = recorrentes?.find((r) => r.id === c.recorrente_id);
              const membro = membros?.find((m) => m.id === c.membro_id);
              return (
                <div
                  key={c.id}
                  className={`flex items-center justify-between rounded-md p-2 text-sm ${
                    c.confirmado ? "bg-green-50" : "bg-amber-50"
                  }`}
                >
                  <span>
                    <strong>{membro?.nome}</strong> — {rec?.descricao}
                  </span>
                  <Button size="sm" variant={c.confirmado ? "outline" : "success"} onClick={() => alternar(c.id, c.confirmado)}>
                    {c.confirmado ? "Desfazer" : "Confirmar"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SecaoCombustivel() {
  const toast = useToast();
  const { data: historico, isLoading } = useHistoricoCombustivel();
  const definir = useDefinirCustoCombustivel();
  const editar = useEditarCustoCombustivelAtual();

  const atual = historico?.find((h) => !h.vigencia_fim) ?? null;
  const [modo, setModo] = useState<"novo" | "editar" | null>(null);
  const [consumo, setConsumo] = useState("");
  const [custoUnidade, setCustoUnidade] = useState("");
  const [unidades, setUnidades] = useState("20");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));

  function abrir(m: "novo" | "editar") {
    if (m === "editar" && atual) {
      setConsumo(String(atual.consumo_por_hora));
      setCustoUnidade(String(atual.custo_unidade));
      setUnidades(String(atual.unidades));
      setDataInicio(atual.vigencia_inicio);
    } else {
      setConsumo("");
      setCustoUnidade("");
      setUnidades("20");
      setDataInicio(new Date().toISOString().slice(0, 10));
    }
    setModo(m);
  }

  async function salvar() {
    try {
      if (modo === "editar" && atual) {
        await editar.mutateAsync({
          id: atual.id,
          consumoPorHora: Number(consumo),
          custoUnidade: Number(custoUnidade),
          unidades: Number(unidades),
          dataInicio,
        });
        toast.sucesso("Atualizado!");
      } else {
        await definir.mutateAsync({
          consumoPorHora: Number(consumo),
          custoUnidade: Number(custoUnidade),
          unidades: Number(unidades),
          dataInicio,
        });
        toast.sucesso("Novo período de combustível registrado!");
      }
      setModo(null);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>⛽ Custo variável — combustível</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => abrir("editar")} disabled={!atual}>
            Editar atual
          </Button>
          <Button size="sm" onClick={() => abrir("novo")}>
            Novo galão/tanque
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !atual ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma configuração cadastrada ainda. Cadastre a primeira para começar a calcular
            o custo variável de uso.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniKpi titulo="Consumo médio" valor={`${atual.consumo_por_hora} L/h`} cor="bg-gray-500" />
            <MiniKpi titulo="Custo do último tanque" valor={formatarMoeda(atual.custo_unidade)} cor="bg-gray-500" />
            <MiniKpi titulo="Litros por tanque" valor={`${atual.unidades} L`} cor="bg-gray-500" />
            <MiniKpi titulo="Custo por hora" valor={formatarMoeda(atual.custo_por_hora)} cor="bg-amber-700" />
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Este custo por hora compõe a parte variável da mensalidade: cada cotista paga
          proporcional às horas que ELE usou no mês (não pelas cotas), sempre com um mês de
          atraso na cobrança.
        </p>
      </CardContent>

      <Modal aberto={!!modo} aoFechar={() => setModo(null)} titulo={modo === "editar" ? "Editar galão atual" : "Novo galão/tanque"}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Data de início</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Consumo (litros por hora de uso)</Label>
            <Input type="number" min={0} step={0.01} value={consumo} onChange={(e) => setConsumo(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Custo do tanque (R$)</Label>
              <Input type="number" min={0} step={0.01} value={custoUnidade} onChange={(e) => setCustoUnidade(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Litros do tanque</Label>
              <Input type="number" min={0.1} step={0.1} value={unidades} onChange={(e) => setUnidades(e.target.value)} />
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModo(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={definir.isPending || editar.isPending}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

function SecaoProjecaoManutencao() {
  const { data: projecao } = useProjecaoManutencaoHoras();
  const { membroAtual } = useAuth();

  const porManutencao = new Map<string, typeof projecao>();
  for (const p of projecao ?? []) {
    if (!porManutencao.has(p.manutencao_id)) porManutencao.set(p.manutencao_id, []);
    porManutencao.get(p.manutencao_id)!.push(p);
  }

  if (!porManutencao.size) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>⏳ Acumulado estimado das manutenções por horímetro</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {[...porManutencao.entries()].map(([manutencaoId, linhas]) => {
          const primeira = linhas![0];
          return (
            <div key={manutencaoId} className="rounded-lg border p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="font-semibold">{primeira.descricao}</p>
                <p className="text-sm font-bold text-amber-800">
                  {primeira.custo_previsto > 0 ? formatarMoeda(primeira.custo_previsto) + " previsto" : "sem custo previsto"}
                </p>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">
                Horímetro: {primeira.horimetro_atual.toFixed(1)}h de{" "}
                {(primeira.horimetro_base + primeira.intervalo_horas).toFixed(1)}h (
                {primeira.horas_restantes < 0
                  ? `vencida há ${Math.abs(primeira.horas_restantes).toFixed(1)}h`
                  : `${primeira.horas_restantes.toFixed(1)}h restantes`}
                )
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-1">Cotista</th>
                    <th className="pb-1">Horas usadas</th>
                    <th className="pb-1">Estimativa se vencer agora</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas!
                    .slice()
                    .sort((a, b) => b.horas - a.horas)
                    .map((l) => (
                      <tr key={l.membro_id} className={l.membro_id === membroAtual?.id ? "bg-blue-50" : ""}>
                        <td className="py-1">{l.membro_nome}</td>
                        <td className="py-1">{l.horas.toFixed(1)}h</td>
                        <td className="py-1">{formatarMoeda(l.valor_estimado)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
