import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useFeriados, useSalvarFeriado, useExcluirFeriado } from "@/lib/queries/useFeriados";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="flex flex-col gap-4">
      {ehAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>🎉 Novo feriado / data especial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Data</Label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label>Descrição</Label>
                <Input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Aniversário da cidade"
                />
              </div>
              <Button onClick={adicionar} disabled={salvar.isPending}>
                Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>📅 Feriados cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !feriados?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum feriado cadastrado.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {feriados.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <strong>{formatarDataBR(f.data)}</strong> — {f.descricao}
                  </span>
                  {ehAdmin && (
                    <button
                      className="text-xs font-semibold text-destructive hover:underline"
                      onClick={() => remover(f.id)}
                    >
                      Excluir
                    </button>
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
