import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldEllipsis, PlusCircle, KeyRound, Send, Pencil, Users, Trash2, ArrowLeftRight, UserMinus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useTodosGrupos, useMembrosDoGrupo, useEditarNomeGrupo, useExcluirGrupo, useTrocarAdmin, useExcluirMembroMaster, useEditarMembro } from "@/lib/queries/useAdministrador";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";

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
  const excluirGrupo = useExcluirGrupo();
  const trocarAdmin = useTrocarAdmin();
  const excluirMembroMaster = useExcluirMembroMaster();
  const editarMembro = useEditarMembro();

  // Modal: renomear grupo
  const [modalNomeAberto, setModalNomeAberto] = useState(false);
  const [novoNome, setNovoNome] = useState("");

  // Modal: excluir grupo
  const [modalExcluirGrupoAberto, setModalExcluirGrupoAberto] = useState(false);
  const [confirmacaoExcluirGrupo, setConfirmacaoExcluirGrupo] = useState("");

  // Modal: trocar admin
  const [modalTrocarAdminAberto, setModalTrocarAdminAberto] = useState(false);
  const [novoAdminEmail, setNovoAdminEmail] = useState("");
  const [novoAdminNome, setNovoAdminNome] = useState("");

  // Modal: excluir membro
  const [modalExcluirMembroAberto, setModalExcluirMembroAberto] = useState(false);
  const [membroParaExcluir, setMembroParaExcluir] = useState<{ id: string; nome: string } | null>(null);

  // Modal: editar membro (nome + email)
  const [modalEditarMembroAberto, setModalEditarMembroAberto] = useState(false);
  const [membroParaEditar, setMembroParaEditar] = useState<{ id: string; nome: string; email: string } | null>(null);
  const [editarNomeMembro, setEditarNomeMembro] = useState("");
  const [editarEmailMembro, setEditarEmailMembro] = useState("");

  // Reset de senha
  const [emailReset, setEmailReset] = useState("");
  const [enviandoPara, setEnviandoPara] = useState<string | null>(null);

  // ── Renomear grupo ──────────────────────────────────────

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

  // ── Excluir grupo ───────────────────────────────────────

  function abrirExcluirGrupo() {
    setConfirmacaoExcluirGrupo("");
    setModalExcluirGrupoAberto(true);
  }

  async function confirmarExcluirGrupo() {
    if (!grupoSelecionadoId) return;
    if (confirmacaoExcluirGrupo !== grupoSelecionado?.nome) {
      toast.erro("Digite o nome do grupo corretamente para confirmar.");
      return;
    }
    try {
      await excluirGrupo.mutateAsync(grupoSelecionadoId);
      toast.sucesso("Grupo excluído com sucesso!");
      setModalExcluirGrupoAberto(false);
      const restante = grupos?.filter((g) => g.id !== grupoSelecionadoId) ?? [];
      setGrupoSelecionadoId(restante.length ? restante[0].id : null);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao excluir grupo.");
    }
  }

  // ── Trocar admin ────────────────────────────────────────

  function abrirTrocarAdmin() {
    setNovoAdminEmail("");
    setNovoAdminNome("");
    setModalTrocarAdminAberto(true);
  }

  async function confirmarTrocarAdmin() {
    if (!grupoSelecionadoId || !novoAdminEmail.trim()) {
      toast.erro("Digite o e-mail do novo administrador.");
      return;
    }
    try {
      await trocarAdmin.mutateAsync({
        grupoId: grupoSelecionadoId,
        email: novoAdminEmail.trim(),
        nome: novoAdminNome.trim() || undefined,
      });
      toast.sucesso("Administrador atualizado com sucesso!");
      setModalTrocarAdminAberto(false);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao trocar administrador.");
    }
  }

  // ── Excluir membro ──────────────────────────────────────

  function abrirExcluirMembro(membro: { id: string; nome: string }) {
    setMembroParaExcluir(membro);
    setModalExcluirMembroAberto(true);
  }

  async function confirmarExcluirMembro() {
    if (!membroParaExcluir) return;
    try {
      await excluirMembroMaster.mutateAsync(membroParaExcluir.id);
      toast.sucesso("Membro excluído com sucesso!");
      setModalExcluirMembroAberto(false);
      setMembroParaExcluir(null);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao excluir membro.");
    }
  }

  // ── Editar membro (nome + email) ───────────────────────

  function abrirEditarMembro(membro: { id: string; nome: string; email: string }) {
    setMembroParaEditar(membro);
    setEditarNomeMembro(membro.nome);
    setEditarEmailMembro(membro.email);
    setModalEditarMembroAberto(true);
  }

  async function confirmarEditarMembro() {
    if (!membroParaEditar) return;
    if (!editarNomeMembro.trim()) { toast.erro("Digite um nome."); return; }
    if (!editarEmailMembro.trim()) { toast.erro("Digite um e-mail."); return; }
    try {
      await editarMembro.mutateAsync({
        membroId: membroParaEditar.id,
        nome: editarNomeMembro.trim(),
        email: editarEmailMembro.trim(),
      });
      toast.sucesso("Membro atualizado com sucesso!");
      setModalEditarMembroAberto(false);
      setMembroParaEditar(null);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao atualizar membro.");
    }
  }

  // ── Reset de senha ──────────────────────────────────────

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

  function roleBadge(role: string) {
    if (role === "admin") return <Badge variant="info">Admin</Badge>;
    if (role === "gestor") return <Badge variant="warning">Gestor</Badge>;
    return <Badge variant="neutral">Cotista</Badge>;
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
              <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border/60 bg-white px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold">{grupoSelecionado.nome}</p>
                    <p className="text-[11.5px] text-muted-foreground">{grupoSelecionado.nome_recurso}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={abrirEdicaoNome}>
                    <Pencil size={14} /> Renomear
                  </Button>
                  <Button size="sm" variant="outline" onClick={abrirTrocarAdmin}>
                    <ArrowLeftRight size={14} /> Trocar admin
                  </Button>
                  <Button size="sm" variant="outline" onClick={abrirExcluirGrupo}>
                    <Trash2 size={14} className="text-destructive" /> Excluir
                  </Button>
                </div>
              </div>
            )}

            {/* ── Membros do grupo ───────────────────────────── */}
            <div className="border-t border-border/60 pt-3">
              <div className="mb-2 flex items-center gap-2">
                <Users size={15} className="text-royal" />
                <p className="text-[13.5px] font-bold">Membros do grupo</p>
              </div>

              {carregandoMembros ? null : !membros?.length ? (
                <p className="mb-3 text-[13px] text-muted-foreground">Nenhum membro neste grupo.</p>
              ) : (
                <div className="mb-4 flex flex-col gap-2">
                  {membros.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-white px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-[13.5px] font-semibold">{m.nome}</p>
                            {roleBadge(m.role)}
                          </div>
                          <p className="truncate text-[11.5px] text-muted-foreground">{m.email}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirEditarMembro({ id: m.id, nome: m.nome, email: m.email })}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => enviarPara(m.email)}
                          disabled={enviandoPara === m.email}
                        >
                          {enviandoPara === m.email ? "Enviando..." : "Enviar senha"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirExcluirMembro({ id: m.id, nome: m.nome })}
                        >
                          <UserMinus size={14} className="text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Reset de senha (manual) ─────────────────────── */}
            <div className="border-t border-border/60 pt-3">
              <div className="mb-2 flex items-center gap-2">
                <KeyRound size={15} className="text-royal" />
                <p className="text-[13.5px] font-bold">Redefinir senha manual</p>
              </div>
              <p className="mb-3 text-[12px] text-muted-foreground">
                Envia um e-mail com link para redefinir senha de qualquer endereço.
              </p>
              <div className="flex gap-2">
                <Input type="email" value={emailReset} onChange={(e) => setEmailReset(e.target.value)} placeholder="email@exemplo.com" />
                <Button variant="outline" onClick={enviarParaEmailDigitado} disabled={!!enviandoPara}>
                  <Send size={15} /> Enviar
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ── Modal: renomear grupo ───────────────────────────── */}
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

      {/* ── Modal: excluir grupo ────────────────────────────── */}
      <Modal aberto={modalExcluirGrupoAberto} aoFechar={() => setModalExcluirGrupoAberto(false)} titulo="Excluir grupo">
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-muted-foreground">
            Tem certeza que deseja excluir o grupo <strong>{grupoSelecionado?.nome}</strong>?
            Todos os dados serão permanentemente apagados (membros, reservas, diário, finanças).
          </p>
          <div className="flex flex-col gap-1.5">
            <Label>Digite o nome do grupo para confirmar</Label>
            <Input
              value={confirmacaoExcluirGrupo}
              onChange={(e) => setConfirmacaoExcluirGrupo(e.target.value)}
              placeholder={grupoSelecionado?.nome ?? ""}
            />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalExcluirGrupoAberto(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={confirmarExcluirGrupo}
              disabled={excluirGrupo.isPending || confirmacaoExcluirGrupo !== grupoSelecionado?.nome}
            >
              {excluirGrupo.isPending ? "Excluindo..." : "Excluir grupo"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: trocar admin ─────────────────────────────── */}
      <Modal aberto={modalTrocarAdminAberto} aoFechar={() => setModalTrocarAdminAberto(false)} titulo="Trocar administrador">
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-muted-foreground">
            O administrador atual do grupo será rebaixado a cotista. O novo administrador será promovido
            (ou receberá um convite se ainda não for membro do grupo).
          </p>
          <div className="flex flex-col gap-1.5">
            <Label>E-mail do novo administrador</Label>
            <Input
              type="email"
              value={novoAdminEmail}
              onChange={(e) => setNovoAdminEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Nome (opcional)</Label>
            <Input
              value={novoAdminNome}
              onChange={(e) => setNovoAdminNome(e.target.value)}
              placeholder="Se vazio, usa o antes do @"
            />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalTrocarAdminAberto(false)}>Cancelar</Button>
            <Button onClick={confirmarTrocarAdmin} disabled={trocarAdmin.isPending || !novoAdminEmail.trim()}>
              {trocarAdmin.isPending ? "Salvando..." : "Trocar administrador"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: excluir membro ───────────────────────────── */}
      <Modal aberto={modalExcluirMembroAberto} aoFechar={() => setModalExcluirMembroAberto(false)} titulo="Excluir membro">
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-muted-foreground">
            Tem certeza que deseja excluir <strong>{membroParaExcluir?.nome}</strong> deste grupo?
            Os dados serão anonimizados e o membro perderá acesso.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalExcluirMembroAberto(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={confirmarExcluirMembro}
              disabled={excluirMembroMaster.isPending}
            >
              {excluirMembroMaster.isPending ? "Excluindo..." : "Excluir membro"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: editar membro ────────────────────────────── */}
      <Modal aberto={modalEditarMembroAberto} aoFechar={() => setModalEditarMembroAberto(false)} titulo="Editar membro">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Nome</Label>
            <Input
              value={editarNomeMembro}
              onChange={(e) => setEditarNomeMembro(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={editarEmailMembro}
              onChange={(e) => setEditarEmailMembro(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalEditarMembroAberto(false)}>Cancelar</Button>
            <Button onClick={confirmarEditarMembro} disabled={editarMembro.isPending || !editarNomeMembro.trim() || !editarEmailMembro.trim()}>
              {editarMembro.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
