import { useState } from "react";
import { Info, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useInformacoes, useSalvarInformacao, useExcluirInformacao } from "@/lib/queries/useInformacoes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import type { CategoriaInformacao } from "@/types/database.types";

const CATEGORIAS: CategoriaInformacao[] = ["Contato", "Documento", "Senha_Acesso", "Procedimento", "Outro"];
const LABEL_CATEGORIA: Record<CategoriaInformacao, string> = {
  Contato: "Contato", Documento: "Documento", Senha_Acesso: "Senha/Acesso", Procedimento: "Procedimento", Outro: "Outro",
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
    if (!rotulo || !valor) { toast.erro("Preencha rótulo e valor."); return; }
    try {
      await salvar.mutateAsync({ categoria, rotulo, valor, observacao });
      toast.sucesso("Informação salva!");
      setRotulo(""); setValor(""); setObservacao("");
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
    <div className="flex flex-col gap-4 pb-6">
      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-[15px] font-bold"><Info size={17} className="text-royal" /> Nova informação</h2>
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>Categoria</Label>
              <select className="h-12 rounded-2xl border border-input bg-white px-3 text-[14px]" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaInformacao)}>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{LABEL_CATEGORIA[c]}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5"><Label>Rótulo</Label><Input value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder="Ex: Marina - telefone" /></div>
            <div className="flex flex-col gap-1.5"><Label>Valor</Label><Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex: (61) 99999-9999" /></div>
          </div>
          <div className="flex flex-col gap-1.5"><Label>Observação (opcional)</Label><Input value={observacao} onChange={(e) => setObservacao(e.target.value)} /></div>
          <Button onClick={adicionar} disabled={salvar.isPending} className="self-start">Adicionar</Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-[15px] font-bold">Informações cadastradas</h2>
        {isLoading ? null : !informacoes?.length ? (
          <EmptyState titulo="Nenhuma informação cadastrada" />
        ) : (
          <div className="flex flex-col gap-5">
            {[...agrupado.entries()].map(([cat, lista]) => (
              <div key={cat}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{LABEL_CATEGORIA[cat]}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {lista!.map((info) => (
                    <div key={info.id} className="flex items-center gap-2 rounded-2xl border border-border/60 bg-white p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">{info.rotulo}</p>
                        <p className="truncate text-[14px] font-semibold">{info.valor}</p>
                        {info.observacao && <p className="truncate text-[11.5px] text-muted-foreground">{info.observacao}</p>}
                      </div>
                      {ehAdmin && (
                        <button onClick={() => remover(info.id)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
