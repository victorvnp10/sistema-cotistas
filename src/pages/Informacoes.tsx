import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useInformacoes, useSalvarInformacao, useExcluirInformacao } from "@/lib/queries/useInformacoes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CategoriaInformacao } from "@/types/database.types";

const CATEGORIAS: CategoriaInformacao[] = ["Contato", "Documento", "Senha_Acesso", "Procedimento", "Outro"];
const LABEL_CATEGORIA: Record<CategoriaInformacao, string> = {
  Contato: "Contato",
  Documento: "Documento",
  Senha_Acesso: "Senha/Acesso",
  Procedimento: "Procedimento",
  Outro: "Outro",
};

export default function Informacoes() {
  const { ehAdmin } = useAuth();
  const toast = useToast();
  const { data: informacoes, isLoading } = useInformacoes();
  const salvar = useSalvarInformacao();
  const excluir = useExcluirInformacao();

  const [categoria, setCategoria] = useState<CategoriaInformacao>("Contato");
  const [rotulo, setRotulo] = useState("");
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");

  async function adicionar() {
    if (!rotulo || !valor) {
      toast.erro("Preencha rótulo e valor.");
      return;
    }
    try {
      await salvar.mutateAsync({ categoria, rotulo, valor, observacao });
      toast.sucesso("Informação salva!");
      setRotulo("");
      setValor("");
      setObservacao("");
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  async function remover(id: string) {
    try {
      await excluir.mutateAsync(id);
      toast.sucesso("Excluído!");
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  }

  const agrupado = new Map<CategoriaInformacao, typeof informacoes>();
  for (const info of informacoes ?? []) {
    const lista = agrupado.get(info.categoria) ?? [];
    lista.push(info);
    agrupado.set(info.categoria, lista);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>ℹ️ Nova informação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>Categoria</Label>
              <select
                className="h-10 rounded-md border border-input px-2 text-sm"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaInformacao)}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{LABEL_CATEGORIA[c]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Rótulo</Label>
              <Input value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder="Ex: Marina - telefone" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Valor</Label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex: (61) 99999-9999" />
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            <Label>Observação (opcional)</Label>
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
          <Button className="mt-3" size="sm" onClick={adicionar} disabled={salvar.isPending}>
            Adicionar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>📋 Informações cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !informacoes?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma informação cadastrada.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {[...agrupado.entries()].map(([cat, lista]) => (
                <div key={cat}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {LABEL_CATEGORIA[cat]}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {lista!.map((info) => (
                      <div key={info.id} className="flex items-center gap-2 rounded-lg border bg-white p-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">{info.rotulo}</p>
                          <p className="truncate text-sm font-semibold">{info.valor}</p>
                          {info.observacao && (
                            <p className="truncate text-xs text-muted-foreground">{info.observacao}</p>
                          )}
                        </div>
                        {ehAdmin && (
                          <button
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => remover(info.id)}
                            title="Excluir"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
