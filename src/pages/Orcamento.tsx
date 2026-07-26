import { useState } from "react";
import { Wallet, PlusCircle, Repeat, CheckCircle2, Droplet, Clock } from "lucide-react";
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
  useResumoOleo,
  useDefinirCustoOleo,
  useEditarCustoOleoAtual,
  useFecharCustoOleo,
} from "@/lib/queries/useOleo";
import { useProjecaoManutencaoHoras } from "@/lib/queries/useManutencoes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { ListItem } from "@/components/ui/list-item";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { Database, TipoLancamento } from "@/types/database.types";

type Recorrente = Database["public"]["Tables"]["recorrentes"]["Row"];
type ResumoOleoItem = Database["public"]["Functions"]["resumo_custo_oleo"]["Returns"][number];

export default function Orcamento() {
  const { grupoAtual, membroAtual, podeGerenciarOrcamento } = useAuth();
  const mesRef = mesReferenciaAtual();

  const { data: saldoAtual } = useSaldoAtual();
  const { data: custoFixoMes } = useCustoFixoMes(mesRef);
  const { data: mensalidade } = useMensalidadeMembro(membroAtual?.id);
  const { data: mensalidadesTodos } = useMensalidadesTodos();

  const termoCota = grupoAtual?.termo_cota ?? "cota";

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
        <StatCard titulo="Saldo atual" valor={formatarMoeda(saldoAtual ?? 0)} icon={<Wallet size={16} />} destaque />
        <StatCard titulo="Custo fixo do mês" valor={formatarMoeda(custoFixoMes ?? 0)} />
        <StatCard titulo="Reserva de emergência" valor={formatarMoeda(mensalidade?.mesAtual.reservaEmergencia ?? 0)} />
      </div>

      <Card>
        <h2 className="mb-3 text-[15px] font-bold">💵 Quanto você deve pagar</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {mensalidade && (
            <>
              <CardMes titulo={`📅 ${mensalidade.mesAtual.mesRef} · atual`} dados={mensalidade.mesAtual} destaque />
              <CardMes titulo={`⏩ ${mensalidade.proximoMes.mesRef} · próximo`} dados={mensalidade.proximoMes} />
            </>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-[15px] font-bold">👥 Mensalidade de todos os cotistas</h2>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="text-left text-[10.5px] font-bold uppercase text-muted-foreground">
                <th className="whitespace-nowrap pb-2">Cotista</th>
                <th className="whitespace-nowrap pb-2 text-right">Fixo</th>
                <th className="whitespace-nowrap pb-2 text-right">Variável</th>
                <th className="whitespace-nowrap pb-2 text-right">Reserva</th>
                <th className="whitespace-nowrap pb-2 text-right">Total mês</th>
                <th className="whitespace-nowrap pb-2 text-right">Próximo</th>
              </tr>
            </thead>
            <tbody>
              {mensalidadesTodos?.map((v) => (
                <tr key={v.membro_id} className={v.membro_id === membroAtual?.id ? "bg-accent/60" : ""}>
                  <td className="whitespace-nowrap py-2 font-medium">{v.nome}</td>
                  <td className="whitespace-nowrap py-2 text-right">{formatarMoeda(v.custo_fixo_mes)}</td>
                  <td className="whitespace-nowrap py-2 text-right">{formatarMoeda(v.custo_variavel_mes)}</td>
                  <td className="whitespace-nowrap py-2 text-right">{formatarMoeda(v.reserva_emergencia_mes)}</td>
                  <td className="whitespace-nowrap py-2 text-right font-bold text-royal">{formatarMoeda(v.total_mes_atual)}</td>
                  <td className="whitespace-nowrap py-2 text-right">{formatarMoeda(v.total_proximo_mes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {podeGerenciarOrcamento && <SecaoOleo />}
      <SecaoProjecaoManutencao />
      {podeGerenciarOrcamento && <SecaoLancamentos />}
      {podeGerenciarOrcamento && <SecaoRecorrentes />}
      {podeGerenciarOrcamento && <SecaoConfirmacoes />}
    </div>
  );
}

function CardMes({
  titulo,
  dados,
  destaque,
}: {
  titulo: string;
  dados: { custoFixo: number; custoVariavel?: number; reservaEmergencia: number; totalAPagar: number; cobertoPelaReserva?: number };
  destaque?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 ${destaque ? "bg-gradient-to-br from-royal to-ocean text-white" : "bg-secondary/60"}`}>
      <p className={`mb-1 text-[11px] font-bold uppercase tracking-wide ${destaque ? "text-white/80" : "text-muted-foreground"}`}>{titulo}</p>
      <p className="mb-3 text-[26px] font-extrabold tracking-tight">{formatarMoeda(dados.totalAPagar)}</p>
      <div className={`flex justify-between text-[12px] ${destaque ? "text-white/85" : ""}`}>
        <span className={destaque ? "" : "text-muted-foreground"}>Custo fixo</span>
        <span className="font-semibold">{formatarMoeda(dados.custoFixo)}</span>
      </div>
      {!!dados.custoVariavel && (
        <div className={`flex justify-between text-[12px] ${destaque ? "text-white/85" : ""}`}>
          <span className={destaque ? "" : "text-muted-foreground"}>Variável</span>
          <span className="font-semibold">{formatarMoeda(dados.custoVariavel)}</span>
        </div>
      )}
      <div className={`flex justify-between text-[12px] ${destaque ? "text-white/85" : ""}`}>
        <span className={destaque ? "" : "text-muted-foreground"}>Reserva de emergência</span>
        <span className="font-semibold">{formatarMoeda(dados.reservaEmergencia)}</span>
      </div>
      {!!dados.cobertoPelaReserva && (
        <div className={`flex justify-between text-[12px] ${destaque ? "text-success" : "text-success"}`}>
          <span>Coberto pela reserva</span>
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
    if (!descricao || !valor) { toast.erro("Preencha descrição e valor."); return; }
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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[15px] font-bold"><PlusCircle size={17} className="text-royal" /> Lançamentos</h2>
        <Button size="sm" onClick={() => setModalAberto(true)}>Novo</Button>
      </div>
      {isLoading ? null : !lancamentos?.length ? (
        <EmptyState titulo="Nenhum lançamento ainda" />
      ) : (
        <div className="flex flex-col gap-2">
          {lancamentos?.slice(0, 30).map((l) => (
            <ListItem
              key={l.id}
              title={l.descricao}
              subtitle={formatarDataBR(l.data)}
              trailing={
                <div className="flex items-center gap-2">
                  {l.origem !== "manual" && <Badge variant="info">auto</Badge>}
                  <span className={`text-[13.5px] font-bold ${l.tipo === "receita" ? "text-success" : "text-destructive"}`}>
                    {formatarMoeda(l.valor)}
                  </span>
                  <button onClick={() => remover(l.id)} className="text-[12px] font-bold text-destructive hover:underline">×</button>
                </div>
              }
            />
          ))}
        </div>
      )}

      <Modal aberto={modalAberto} aoFechar={() => setModalAberto(false)} titulo="Novo lançamento">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Tipo</Label>
            <SegmentedControl
              opcoes={[{ valor: "receita", label: "Receita" }, { valor: "despesa", label: "Despesa" }]}
              valor={tipo}
              aoMudar={setTipo}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{tipo === "receita" ? "Valor por cota (R$)" : "Valor total (R$)"}</Label>
            <Input type="number" min={0} step={0.01} value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={criar.isPending}>{criar.isPending ? "Salvando..." : "Salvar"}</Button>
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
    if (!descricao || !valorAtual || !diaCobranca) { toast.erro("Preencha todos os campos."); return; }
    try {
      await criar.mutateAsync({ tipo, descricao, valorAtual: Number(valorAtual), diaCobranca: Number(diaCobranca) });
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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[15px] font-bold"><Repeat size={17} className="text-royal" /> Recorrentes</h2>
        {ehAdmin && <Button size="sm" onClick={() => setModalAberto(true)}>Novo</Button>}
      </div>
      {isLoading ? null : (
        <div className="flex flex-col gap-2">
          {recorrentes?.map((r) => (
            <div key={r.id} className={`rounded-2xl border border-border/60 bg-white p-3.5 ${!r.ativo ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-bold">{r.descricao}</p>
                <p className="text-[14px] font-extrabold">{formatarMoeda(r.valor_atual)}</p>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <Badge variant={r.tipo === "receita" ? "info" : "error"}>
                  {r.tipo === "receita" ? "Reserva de emergência" : "Custo fixo"}
                </Badge>
                <span className="text-[11.5px] text-muted-foreground">Dia {r.dia_cobranca}</span>
              </div>
              {ehAdmin && (
                <div className="mt-2 flex gap-3">
                  <button className="text-[12px] font-bold text-royal hover:underline" onClick={() => { setModalValor(r); setNovoValor(String(r.valor_atual)); }}>
                    Alterar valor
                  </button>
                  <button className="text-[12px] font-bold text-muted-foreground hover:underline" onClick={() => ativar.mutate({ id: r.id, ativo: !r.ativo })}>
                    {r.ativo ? "Desativar" : "Reativar"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal aberto={modalAberto} aoFechar={() => setModalAberto(false)} titulo="Novo recorrente">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Tipo</Label>
            <SegmentedControl
              opcoes={[{ valor: "receita", label: "Receita" }, { valor: "despesa", label: "Despesa" }]}
              valor={tipo}
              aoMudar={setTipo}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Garagem, Marinheiro" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{tipo === "receita" ? "Valor por cota (R$)" : "Valor total (R$)"}</Label>
            <Input type="number" min={0} step={0.01} value={valorAtual} onChange={(e) => setValorAtual(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Dia de cobrança</Label>
            <Input type="number" min={1} max={31} value={diaCobranca} onChange={(e) => setDiaCobranca(e.target.value)} />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={salvarNovo} disabled={criar.isPending}>{criar.isPending ? "Salvando..." : "Salvar"}</Button>
          </div>
        </div>
      </Modal>

      <Modal aberto={!!modalValor} aoFechar={() => setModalValor(null)} titulo="Alterar valor">
        <div className="flex flex-col gap-3">
          <p className="text-[12px] text-muted-foreground">O valor anterior fica registrado no histórico.</p>
          <div className="flex flex-col gap-1.5">
            <Label>Novo valor (R$)</Label>
            <Input type="number" min={0} step={0.01} value={novoValor} onChange={(e) => setNovoValor(e.target.value)} />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalValor(null)}>Cancelar</Button>
            <Button onClick={salvarNovoValor} disabled={alterarValor.isPending}>{alterarValor.isPending ? "Salvando..." : "Confirmar"}</Button>
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
      <h2 className="mb-4 flex items-center gap-2 text-[15px] font-bold"><CheckCircle2 size={17} className="text-royal" /> Confirmações (este mês)</h2>
      {!confsMes.length ? (
        <EmptyState titulo="Nenhuma confirmação para este mês" descricao="São geradas automaticamente todo dia." />
      ) : (
        <div className="flex flex-col gap-2">
          {confsMes.map((c) => {
            const rec = recorrentes?.find((r) => r.id === c.recorrente_id);
            const membro = membros?.find((m) => m.id === c.membro_id);
            return (
              <ListItem
                key={c.id}
                title={membro?.nome ?? ""}
                subtitle={rec?.descricao}
                trailing={
                  <Button size="sm" variant={c.confirmado ? "outline" : "success"} onClick={() => alternar(c.id, c.confirmado)}>
                    {c.confirmado ? "Desfazer" : "Confirmar"}
                  </Button>
                }
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

function SecaoOleo() {
  const toast = useToast();
  const { data: galoes, isLoading } = useResumoOleo();
  const definir = useDefinirCustoOleo();
  const editar = useEditarCustoOleoAtual();
  const fechar = useFecharCustoOleo();

  const atual = galoes?.find((g: ResumoOleoItem) => !g.data_fim) ?? null;

  const [modo, setModo] = useState<"novo" | "editar" | null>(null);
  const [custoGalao, setCustoGalao] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));

  const [modalFechar, setModalFechar] = useState<typeof atual>(null);
  const [dataFim, setDataFim] = useState(new Date().toISOString().slice(0, 10));

  function abrir(m: "novo" | "editar") {
    if (m === "editar" && atual) {
      setCustoGalao(String(atual.custo_galao));
      setDataInicio(atual.data_inicio);
    } else {
      setCustoGalao("");
      setDataInicio(new Date().toISOString().slice(0, 10));
    }
    setModo(m);
  }

  async function salvar() {
    if (!custoGalao) { toast.erro("Preencha o custo do galão."); return; }
    try {
      if (modo === "editar" && atual) {
        await editar.mutateAsync({ id: atual.id, custoGalao: Number(custoGalao), dataInicio });
        toast.sucesso("Atualizado!");
      } else {
        await definir.mutateAsync({ custoGalao: Number(custoGalao), dataInicio });
        toast.sucesso("Novo galão registrado!");
      }
      setModo(null);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  async function confirmarFechamento() {
    if (!modalFechar) return;
    try {
      await fechar.mutateAsync({ id: modalFechar.id, dataFim });
      toast.sucesso("Galão encerrado!");
      setModalFechar(null);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao encerrar.");
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[15px] font-bold"><Droplet size={17} className="text-royal" /> Óleo</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => abrir("editar")} disabled={!atual}>Editar</Button>
          <Button size="sm" onClick={() => abrir("novo")}>Novo galão</Button>
        </div>
      </div>

      {isLoading ? null : !galoes?.length ? (
        <EmptyState titulo="Nenhum galão cadastrado" />
      ) : (
        <div className="flex flex-col gap-2.5">
          {galoes.map((g: ResumoOleoItem) => (
            <div key={g.id} className="rounded-2xl border border-border/60 bg-white p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <p className="text-[13.5px] font-bold">{formatarMoeda(g.custo_galao)}</p>
                {!g.data_fim ? (
                  <Badge variant="info">Em uso</Badge>
                ) : (
                  <Badge variant="neutral">Encerrado</Badge>
                )}
              </div>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                {formatarDataBR(g.data_inicio)} até {g.data_fim ? formatarDataBR(g.data_fim) : "hoje"}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12.5px]">
                <span>{g.horas_consumidas.toFixed(1)}h consumidas</span>
                <span className="font-semibold text-royal">
                  {g.custo_por_hora !== null ? `${formatarMoeda(g.custo_por_hora)}/h` : "aguardando uso"}
                </span>
              </div>
              {!g.data_fim && (
                <button
                  className="mt-2 text-[12px] font-bold text-royal hover:underline"
                  onClick={() => { setModalFechar(g); setDataFim(new Date().toISOString().slice(0, 10)); }}
                >
                  Encerrar este galão
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11.5px] text-muted-foreground">
        Cobrado com 1 mês de atraso, proporcional às horas de uso de cada cotista, usando o preço do galão
        em uso no momento (custo do galão ÷ horas consumidas por ele até agora).
      </p>

      <Modal aberto={!!modo} aoFechar={() => setModo(null)} titulo={modo === "editar" ? "Editar galão atual" : "Novo galão"}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Data de início</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Custo do galão (R$)</Label>
            <Input type="number" min={0} step={0.01} value={custoGalao} onChange={(e) => setCustoGalao(e.target.value)} />
          </div>
          {modo === "novo" && (
            <p className="text-[11.5px] text-muted-foreground">
              Se houver um galão em uso, ele é encerrado automaticamente na véspera desta data.
            </p>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModo(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={definir.isPending || editar.isPending}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal aberto={!!modalFechar} aoFechar={() => setModalFechar(null)} titulo="Encerrar galão">
        <div className="flex flex-col gap-3">
          <p className="text-[13.5px] text-muted-foreground">
            Marque a data em que este galão realmente acabou (não precisa ser hoje).
          </p>
          <div className="flex flex-col gap-1.5">
            <Label>Data de término</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalFechar(null)}>Cancelar</Button>
            <Button variant="success" onClick={confirmarFechamento} disabled={fechar.isPending}>
              {fechar.isPending ? "Encerrando..." : "Confirmar"}
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
      <h2 className="mb-4 flex items-center gap-2 text-[15px] font-bold"><Clock size={17} className="text-royal" /> Acumulado de manutenção por horímetro</h2>
      <div className="flex flex-col gap-4">
        {[...porManutencao.entries()].map(([manutencaoId, linhas]) => {
          const primeira = linhas![0];
          return (
            <div key={manutencaoId} className="rounded-2xl border border-border/60 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <p className="text-[14px] font-bold">{primeira.descricao}</p>
                <p className="whitespace-nowrap text-[13px] font-bold text-royal">{primeira.custo_previsto > 0 ? formatarMoeda(primeira.custo_previsto) : "sem previsão"}</p>
              </div>
              <p className="mb-2 text-[12px] text-muted-foreground">
                {primeira.horas_usadas.toFixed(1)}h de {primeira.intervalo_horas.toFixed(1)}h neste ciclo (desde {formatarDataBR(primeira.data_inicio_ciclo)})
              </p>
              <div className="flex flex-col gap-1.5">
                {linhas!.slice().sort((a, b) => b.horas - a.horas).map((l) => (
                  <div key={l.membro_id} className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-[12.5px] ${l.membro_id === membroAtual?.id ? "bg-accent" : ""}`}>
                    <span className="truncate">{l.membro_nome}</span>
                    <span className="whitespace-nowrap font-semibold">{l.horas.toFixed(1)}h · {formatarMoeda(l.valor_estimado)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
