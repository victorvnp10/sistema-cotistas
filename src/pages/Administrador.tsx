import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldEllipsis, PlusCircle, KeyRound, Send, Pencil, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useTodosGrupos, useMembrosDoGrupo, useEditarNomeGrupo } from "@/lib/queries/useAdministrador";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

/**
 * Só o usuário master (victornogueirapinto@gmail.com) acessa esta tela --
 * ver App.tsx, que só monta essa rota quando ehMaster. O guard abaixo é
 * uma segunda camada de proteção, direto no componente. A visibilidade
 * de dados de qualquer grupo é garantida pelo RLS (migration 0017), não
 * só por esta tela.
 */
export default function Administrador() {
  const navigate = useNavigate();
  const { ehMaster, grupoAtual, enviarLinkRedefinicaoSenha } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (!ehMaster) navigate("/", { replace: true });
  }, [ehMaster, navigate]);

  const { data: grupos, isLoading: carregandoGrupos } = useTodosGrupos();
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<string | null>(null);

  useEffect(() => {
    if (!grupoSelecionadoId && grupos?.length) {
      setGrupoSelecionadoId(grupoAtual?.id ?? grupos[0].id);
    }
  }, [grupos, grupoAtual, grupoSelecionadoId]);

  const grupoSelecionado = grupos?.find((g) => g.id === grupoSelecionadoId) ?? null;
  const { data: membros, isLoading: carregandoMembros } = useMembrosDoGrupo(grupoSelecionadoId);
  const editarNome = useEditarNomeGrupo();

  const [modalNomeAberto, setModalNomeAberto] = useState(false);
  const [novoNome, setNovoNome] = useState("");

  const [emailReset, setEmailReset] = useState("");
  const [enviandoPara, setEnviandoPara] = useState<string | null>(null);

  function abrirEdicaoNome() {
    setNovoNome(grupoSelecionado?.nome ?? "");
    setModalNomeAberto(true);
  }

  async function salvarNome() {
    if (!grupoSelecionadoId || !novoNome.trim()) { toast.erro("Digite um nome."); return; }
    try {
      await editarNome.mutateAsync({ grupoId: grupoSelecionadoId, nome: novoNome.trim() });
      toast.sucesso("Nome do grupo atualizado!");
      setModalNomeAberto(false);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  async function enviarPara(email: string) {
    setEnviandoPara(email);
    try {
      await enviarLinkRedefinicaoSenha(email);
      toast.sucesso(`E-mail de redefinição enviado para ${email}.`);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao enviar e-mail.");
    } finally {
      setEnviandoPara(null);
    }
  }

  async function enviarParaEmailDigitado() {
    if (!emailReset) { toast.erro("Digite um e-mail."); return; }
    await enviarPara(emailReset);
    setEmailReset("");
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Card>
        <h2 className="mb-1 flex items-center gap-2 text-[15px] font-bold">
          <ShieldEllipsis size={17} className="text-royal" /> Administrador
        </h2>
        <p className="text-[12.5px] text-muted-foreground">
          Visível apenas para o usuário master.
        </p>
      </Card>

      <Card>
        <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold">
          <PlusCircle size={17} className="text-royal" /> Novo grupo
        </h2>
        <p className="mb-3 text-[12.5px] text-muted-foreground">
          Cria um novo grupo (embarcação, cabana, etc.) e convida o administrador responsável por ele.
        </p>
        <Button onClick={() => navigate("/criar-grupo")}>Criar novo grupo</Button>
      </Card>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold">
          <Users size={17} className="text-royal" /> Grupos
        </h2>

        {carregandoGrupos ? null : !grupos?.length ? (
          <p className="text-[13px] text-muted-foreground">Nenhum grupo cadastrado ainda.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-col gap-1.5">
              <Label>Selecione um grupo</Label>
              <select
                className="h-11 rounded-2xl border border-input bg-white px-3.5 text-[15px]"
                value={grupoSelecionadoId ?? ""}
                onChange={(e) => setGrupoSelecionadoId(e.target.value)}
              >
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>{g.nome}</option>
                ))}
              </select>
            </div>

            {grupoSelecionado && (
              <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-white px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold">{grupoSelecionado.nome}</p>
                  <p className="text-[11.5px] text-muted-foreground">{grupoSelecionado.nome_recurso}</p>
                </div>
                <Button size="sm" variant="outline" onClick={abrirEdicaoNome}>
                  <Pencil size={14} /> Renomear
                </Button>
              </div>
            )}

            <div className="border-t border-border/60 pt-3">
              <div className="mb-2 flex items-center gap-2">
                <KeyRound size={15} className="text-royal" />
                <p className="text-[13.5px] font-bold">Redefinir senha de cotista</p>
              </div>
              <p className="mb-3 text-[12px] text-muted-foreground">
                Envia um e-mail com um link para o cotista definir uma senha nova. Ele não recebe a senha
                atual, só o link.
              </p>

              {carregandoMembros ? null : !membros?.length ? (
                <p className="mb-3 text-[13px] text-muted-foreground">Nenhum cotista neste grupo.</p>
              ) : (
                <div className="mb-4 flex flex-col gap-2">
                  {membros.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-white px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold">{m.nome}</p>
                        <p className="truncate text-[11.5px] text-muted-foreground">{m.email} · {m.role}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => enviarPara(m.email)}
                        disabled={enviandoPara === m.email}
                      >
                        {enviandoPara === m.email ? "Enviando..." : "Enviar"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-border/60 pt-3">
                <Label>Ou digite o e-mail de um cotista de outro grupo</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input type="email" value={emailReset} onChange={(e) => setEmailReset(e.target.value)} placeholder="email@exemplo.com" />
                  <Button variant="outline" onClick={enviarParaEmailDigitado} disabled={!!enviandoPara}>
                    <Send size={15} /> Enviar
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal aberto={modalNomeAberto} aoFechar={() => setModalNomeAberto(false)} titulo="Renomear grupo">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Nome do grupo</Label>
            <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalNomeAberto(false)}>Cancelar</Button>
            <Button onClick={salvarNome} disabled={editarNome.isPending}>
              {editarNome.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
