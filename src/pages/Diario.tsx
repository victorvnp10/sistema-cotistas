import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  useDiario,
  useUltimoHorimetro,
  useCriarRegistroDiario,
  useResolverDiario,
  useExcluirRegistroDiario,
  useRelatoriosPendentes,
} from "@/lib/queries/useDiario";
import { formatarDataBR } from "@/lib/ranking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PrioridadeDiario } from "@/types/database.types";

const LABEL_PRIORIDADE: Record<PrioridadeDiario, string> = {
  normal: "Relato",
  atencao: "Atenção",
  urgente: "Urgência",
};

export default function Diario() {
  const { membroAtual, podeGerenciarOrcamento } = useAuth();
  const toast = useToast();
  const { data: entradas, isLoading } = useDiario();
  const { data: ultimoHorimetro } = useUltimoHorimetro();
  const { data: pendentes } = useRelatoriosPendentes(membroAtual?.id);
  const criar = useCriarRegistroDiario();
  const resolver = useResolverDiario();
  const excluir = useExcluirRegistroDiario();

  const [titulo, setTitulo] = useState("");
  const [relato, setRelato] = useState("");
  const [prioridade, setPrioridade] = useState<PrioridadeDiario>("normal");
  const [horimetroInicio, setHorimetroInicio] = useState<string>(
    ultimoHorimetro ? String(ultimoHorimetro) : ""
  );
  const [horimetroFim, setHorimetroFim] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "abertos" | "resolvidos">("todos");

  // uso "de rotina" pré-preenchido ao clicar em "Preencher relatório" de um pendente
  const [usoRotina, setUsoRotina] = useState(false);
  const [dataUso, setDataUso] = useState<string | null>(null);

  function preencherPendente(data: string, periodo: string) {
    setTitulo(`Uso em ${formatarDataBR(data)} (${periodo === "M" ? "Manhã" : "Tarde"})`);
    setUsoRotina(true);
    setDataUso(data);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvar() {
    if (!titulo || !relato) {
      toast.erro("Preencha título e relato.");
      return;
    }
    try {
      await criar.mutateAsync({
        titulo,
        relato,
        prioridade,
        horimetroInicio: horimetroInicio ? Number(horimetroInicio) : null,
        horimetroFim: horimetroFim ? Number(horimetroFim) : 0,
        observacoes,
        usoRotina,
        dataUso,
      });
      toast.sucesso(usoRotina ? "Relatório de uso registrado!" : "Registro salvo!");
      setTitulo("");
      setRelato("");
      setHorimetroFim("");
      setObservacoes("");
      setUsoRotina(false);
      setDataUso(null);
      setPrioridade("normal");
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  const exibidos = (entradas ?? []).filter((e) => {
    if (filtroStatus === "abertos" && e.resolvido) return false;
    if (filtroStatus === "resolvidos" && !e.resolvido) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      {!!pendentes?.length && (
        <Card>
          <CardHeader>
            <CardTitle>⏳ Seus relatórios de uso pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-xs text-muted-foreground">
              Cada vez que você usa a {"embarcação"}, é preciso registrar um relatório
              (relato + horímetro). Os usos abaixo ainda não têm relatório.
            </p>
            <div className="flex flex-col divide-y">
              {pendentes.map((p) => (
                <div key={p.reserva_id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {formatarDataBR(p.data)} · {p.periodo === "M" ? "Manhã" : "Tarde"}
                  </span>
                  <Button size="sm" onClick={() => preencherPendente(p.data, p.periodo)}>
                    Preencher relatório
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>📝 Novo registro</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Motor com ruído estranho" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Relato</Label>
            <textarea
              className="min-h-[80px] rounded-md border border-input p-2 text-sm"
              value={relato}
              onChange={(e) => setRelato(e.target.value)}
              placeholder="Descreva o ocorrido..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Horímetro início</Label>
              <Input type="number" step="0.1" value={horimetroInicio} onChange={(e) => setHorimetroInicio(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Horímetro fim</Label>
              <Input type="number" step="0.1" value={horimetroFim} onChange={(e) => setHorimetroFim(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Observações (opcional)</Label>
            <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Prioridade:</span>
            {(["normal", "atencao", "urgente"] as PrioridadeDiario[]).map((p) => (
              <button
                key={p}
                onClick={() => setPrioridade(p)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-bold",
                  prioridade === p
                    ? p === "urgente"
                      ? "border-red-400 bg-red-100 text-red-700"
                      : p === "atencao"
                        ? "border-amber-400 bg-amber-100 text-amber-700"
                        : "border-gray-400 bg-gray-100 text-gray-700"
                    : "border-gray-200 text-muted-foreground"
                )}
              >
                {LABEL_PRIORIDADE[p]}
              </button>
            ))}
            <Button className="ml-auto" size="sm" onClick={salvar} disabled={criar.isPending}>
              {criar.isPending ? "Registrando..." : "Registrar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>📋 Registros</CardTitle>
          <select
            className="h-8 rounded-md border border-input px-2 text-xs"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}
          >
            <option value="todos">Todos</option>
            <option value="abertos">Abertos</option>
            <option value="resolvidos">Resolvidos</option>
          </select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !exibidos.length ? (
            <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {exibidos.map((e) => (
                <div
                  key={e.id}
                  className={cn(
                    "rounded-lg border-l-4 bg-white p-3 shadow-sm",
                    e.resolvido
                      ? "border-l-gray-300 opacity-60"
                      : e.prioridade === "urgente"
                        ? "border-l-red-500"
                        : e.prioridade === "atencao"
                          ? "border-l-amber-400"
                          : "border-l-gray-400"
                  )}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        e.resolvido
                          ? "bg-green-100 text-green-700"
                          : e.prioridade === "urgente"
                            ? "bg-red-100 text-red-700"
                            : e.prioridade === "atencao"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {e.resolvido ? "✅ Resolvido" : LABEL_PRIORIDADE[e.prioridade]}
                    </span>
                    <span className="text-sm font-bold">{e.titulo}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(e.criado_em).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{e.relato}</p>
                  {e.horimetro_fim > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      ⏱ Horímetro: {e.horimetro_inicio.toFixed(1)}h → {e.horimetro_fim.toFixed(1)}h (uso:{" "}
                      {e.tempo_uso.toFixed(1)}h)
                    </p>
                  )}
                  {e.observacoes && (
                    <p className="mt-1 text-xs text-muted-foreground">Obs: {e.observacoes}</p>
                  )}
                  {podeGerenciarOrcamento && (
                    <div className="mt-2 flex gap-2">
                      {!e.resolvido ? (
                        <button
                          className="text-xs font-semibold text-green-700 hover:underline"
                          onClick={() => resolver.mutate({ id: e.id, resolvido: true })}
                        >
                          Marcar resolvido
                        </button>
                      ) : (
                        <button
                          className="text-xs font-semibold text-muted-foreground hover:underline"
                          onClick={() => resolver.mutate({ id: e.id, resolvido: false })}
                        >
                          Reabrir
                        </button>
                      )}
                      <button
                        className="text-xs font-semibold text-destructive hover:underline"
                        onClick={() => excluir.mutate(e.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
