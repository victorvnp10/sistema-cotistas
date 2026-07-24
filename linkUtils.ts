import { useState } from "react";
import { PartyPopper } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useFeriados, useSalvarFeriado, useExcluirFeriado } from "@/lib/queries/useFeriados";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListItem } from "@/components/ui/list-item";
import { EmptyState } from "@/components/ui/empty-state";
import { formatarDataBR } from "@/lib/ranking";

export default function Feriados() {
  const { ehAdmin } = useAuth();
  const toast = useToast();
  const { data: feriados, isLoading } = useFeriados();
  const salvar = useSalvarFeriado();
  const excluir = useExcluirFeriado();

  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");

  async function adicionar() {
    if (!data || !descricao) {
      toast.erro("Preencha data e descrição.");
      return;
    }
    try {
      await salvar.mutateAsync({ data, descricao });
      toast.sucesso("Feriado adicionado!");
      setData("");
      setDescricao("");
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao adicionar.");
    }
  }

  async function remover(id: string) {
    try {
      await excluir.mutateAsync(id);
      toast.sucesso("Feriado removido.");
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao remover.");
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      {ehAdmin && (
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-[15px] font-bold">
            <PartyPopper size={18} className="text-royal" /> Novo feriado / data especial
          </h2>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Descrição</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Aniversário da cidade" />
            </div>
            <Button onClick={adicionar} disabled={salvar.isPending}>Adicionar</Button>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-[15px] font-bold">Feriados cadastrados</h2>
        {isLoading ? null : !feriados?.length ? (
          <EmptyState titulo="Nenhum feriado cadastrado" />
        ) : (
          <div className="flex flex-col gap-2">
            {feriados.map((f) => (
              <ListItem
                key={f.id}
                title={f.descricao}
                subtitle={formatarDataBR(f.data)}
                trailing={
                  ehAdmin && (
                    <button onClick={() => remover(f.id)} className="text-[12.5px] font-bold text-destructive hover:underline">
                      Excluir
                    </button>
                  )
                }
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
