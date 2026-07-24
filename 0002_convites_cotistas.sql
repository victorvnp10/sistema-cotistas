import { useState } from "react";
import { Info, X, Copy, ExternalLink, Eye, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useInformacoes, useSalvarInformacao, useExcluirInformacao } from "@/lib/queries/useInformacoes";
import { extrairDriveFileId, extrairYoutubeId, ehUrl } from "@/lib/linkUtils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import type { CategoriaInformacao, Database } from "@/types/database.types";

type Informacao = Database["public"]["Tables"]["informacoes_uteis"]["Row"];

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
  const [visualizando, setVisualizando] = useState<Informacao | null>(null);
  const [excluindo, setExcluindo] = useState<Informacao | null>(null);

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

  async function confirmarExclusao() {
    if (!excluindo) return;
    try {
      await excluir.mutateAsync(excluindo.id);
      toast.sucesso("Excluído!");
      setExcluindo(null);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.sucesso("Copiado para a área de transferência!");
    } catch {
      toast.erro("Não foi possível copiar.");
    }
  }

  function aoClicarValor(info: Informacao) {
    const driveId = extrairDriveFileId(info.valor);
    const youtubeId = extrairYoutubeId(info.valor);
    if (driveId || youtubeId) {
      setVisualizando(info);
      return;
    }
    if (ehUrl(info.valor)) {
      window.open(info.valor, "_blank", "noopener,noreferrer");
      return;
    }
    // Contato, PIX, senha etc. — copia direto
    copiar(info.valor);
  }

  const agrupado = new Map<CategoriaInformacao, Informacao[]>();
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
              <select className="h-12 rounded-2xl border border-input bg-white px-3 text-[16px]" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaInformacao)}>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{LABEL_CATEGORIA[c]}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5"><Label>Rótulo</Label><Input value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder="Ex: Marina - telefone" /></div>
            <div className="flex flex-col gap-1.5"><Label>Valor</Label><Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Telefone, PIX, link, documento..." /></div>
          </div>
          <div className="flex flex-col gap-1.5"><Label>Observação (opcional)</Label><Input value={observacao} onChange={(e) => setObservacao(e.target.value)} /></div>
          <Button onClick={adicionar} disabled={salvar.isPending} className="self-start">Adicionar</Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-[15px] font-bold">Informações cadastradas</h2>
        <p className="mb-4 -mt-2 text-[11.5px] text-muted-foreground">
          Toque em documentos/vídeos para visualizar, em links para abrir, e em contatos/PIX para copiar.
        </p>
        {isLoading ? null : !informacoes?.length ? (
          <EmptyState titulo="Nenhuma informação cadastrada" />
        ) : (
          <div className="flex flex-col gap-5">
            {[...agrupado.entries()].map(([cat, lista]) => (
              <div key={cat}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{LABEL_CATEGORIA[cat]}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {lista.map((info) => {
                    const driveId = extrairDriveFileId(info.valor);
                    const youtubeId = extrairYoutubeId(info.valor);
                    const isLink = ehUrl(info.valor);
                    const Icone = driveId || youtubeId ? Eye : isLink ? ExternalLink : Copy;
                    return (
                      <button
                        key={info.id}
                        onClick={() => aoClicarValor(info)}
                        className="flex items-center gap-2 rounded-2xl border border-border/60 bg-white p-3 text-left transition-colors hover:bg-secondary/60 active:scale-[0.99]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">{info.rotulo}</p>
                          <p className="truncate text-[14px] font-semibold">{info.valor}</p>
                          {info.observacao && <p className="truncate text-[11.5px] text-muted-foreground">{info.observacao}</p>}
                        </div>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-royal">
                          <Icone size={15} />
                        </span>
                        {ehAdmin && (
                          <span
                            role="button"
                            onClick={(e) => { e.stopPropagation(); setExcluindo(info); }}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X size={14} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Visualização rápida de documentos/vídeos */}
      <Modal aberto={!!visualizando} aoFechar={() => setVisualizando(null)} titulo={visualizando?.rotulo ?? ""} className="sm:max-w-2xl">
        {visualizando && (
          <div className="flex flex-col gap-3">
            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
              {extrairYoutubeId(visualizando.valor) ? (
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube.com/embed/${extrairYoutubeId(visualizando.valor)}`}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <iframe
                  className="h-full w-full"
                  src={`https://drive.google.com/file/d/${extrairDriveFileId(visualizando.valor)}/preview`}
                  allow="autoplay"
                />
              )}
            </div>
            <Button variant="outline" onClick={() => window.open(visualizando.valor, "_blank", "noopener,noreferrer")}>
              <ExternalLink size={16} /> Abrir em nova aba
            </Button>
          </div>
        )}
      </Modal>

      {/* Dupla confirmação de exclusão */}
      <Modal aberto={!!excluindo} aoFechar={() => setExcluindo(null)} titulo="Excluir informação">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-2xl bg-destructive/5 p-4">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-destructive" />
            <p className="text-[13.5px] text-foreground">
              Tem certeza que deseja excluir <strong>"{excluindo?.rotulo}"</strong>? Essa ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setExcluindo(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarExclusao} disabled={excluir.isPending}>
              {excluir.isPending ? "Excluindo..." : "Sim, excluir"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
