import { useState } from "react";
import { AlertTriangle, Megaphone, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useMembros } from "@/lib/queries/useMembros";
import { useAvisos, useCriarAviso, useResolverAviso, useExcluirAviso } from "@/lib/queries/useAvisos";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

function tempoAtras(iso: string) {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}

export default function Avisos() {
  const { podeGerenciarOrcamento } = useAuth();
  const toast = useToast();
  const { data: avisos, isLoading } = useAvisos();
  const { data: membros } = useMembros();
  const criar = useCriarAviso();
  const resolver = useResolverAviso();
  const excluir = useExcluirAviso();

  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const ativos = (avisos ?? []).filter((a) => !a.resolvido);
  const resolvidos = (avisos ?? []).filter((a) => a.resolvido);

  function nomeMembro(id: string | null) {
    if (!id) return "—";
    return membros?.find((m) => m.id === id)?.nome ?? "—";
  }

  async function salvarNovo() {
    if (!mensagem.trim()) { toast.erro("Escreva a mensagem do aviso."); return; }
    try {
      await criar.mutateAsync(mensagem.trim());
      toast.sucesso("Aviso publicado para todos os cotistas!");
      setMensagem("");
      setModalNovoAberto(false);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao publicar.");
    }
  }

  async function marcarResolvido(id: string) {
    try {
      await resolver.mutateAsync(id);
      toast.sucesso("Aviso marcado como resolvido.");
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao resolver.");
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Card>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[15px] font-bold">
            <Megaphone size={17} className="text-royal" /> Avisos
          </h2>
          {podeGerenciarOrcamento && (
            <Button size="sm" onClick={() => setModalNovoAberto(true)}>Novo aviso</Button>
          )}
        </div>
        <p className="text-[12.5px] text-muted-foreground">
          Avisos ativos aparecem em destaque pra todo mundo, em qualquer tela do app.
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 text-[15px] font-bold">Ativos</h2>
        {isLoading ? null : !ativos.length ? (
          <EmptyState titulo="Nenhum aviso ativo" descricao="Tudo em ordem." />
        ) : (
          <div className="flex flex-col gap-2.5">
            {ativos.map((a) => (
              <div key={a.id} className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0 text-destructive" />
                    <p className="text-[14px] font-semibold text-foreground">{a.mensagem}</p>
                  </div>
                  <Badge variant="error">Ativo</Badge>
                </div>
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                  {nomeMembro(a.criado_por)} · {tempoAtras(a.criado_em)}
                </p>
                {podeGerenciarOrcamento && (
                  <div className="mt-2.5 flex gap-3">
                    <button
                      className="flex items-center gap-1 text-[12px] font-bold text-success hover:underline"
                      onClick={() => marcarResolvido(a.id)}
                    >
                      <CheckCircle2 size={13} /> Marcar como resolvido
                    </button>
                    <button
                      className="text-[12px] font-bold text-destructive hover:underline"
                      onClick={() => excluir.mutate(a.id)}
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {!!resolvidos.length && (
        <Card>
          <h2 className="mb-3 text-[15px] font-bold">Histórico</h2>
          <div className="flex flex-col gap-2">
            {resolvidos.map((a) => (
              <div key={a.id} className="rounded-2xl border border-border/60 bg-white p-3 opacity-70">
                <p className="text-[13.5px] font-medium line-through decoration-muted-foreground/50">{a.mensagem}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {nomeMembro(a.criado_por)} · {tempoAtras(a.criado_em)}
                  {a.resolvido_em && ` — resolvido por ${nomeMembro(a.resolvido_por)} ${tempoAtras(a.resolvido_em)}`}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal aberto={modalNovoAberto} aoFechar={() => setModalNovoAberto(false)} titulo="Novo aviso">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Mensagem</Label>
            <Input value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder='Ex: "Lancha interditada", "Sem óleo"' />
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            Fica visível em destaque pra todos os cotistas, em qualquer tela, até alguém marcar como resolvido.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalNovoAberto(false)}>Cancelar</Button>
            <Button onClick={salvarNovo} disabled={criar.isPending}>{criar.isPending ? "Publicando..." : "Publicar"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
