import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Home,
  CalendarDays,
  BookOpen,
  Wallet,
  MoreHorizontal,
  Wrench,
  ShieldCheck,
  Info,
  BarChart3,
  Users,
  PartyPopper,
  ShieldEllipsis,
  KeyRound,
  LogOut,
  ChevronRight,
  Megaphone,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useAvisosAtivos } from "@/lib/queries/useAvisos";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BottomNavigation, type ItemNav } from "@/components/ui/bottom-navigation";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { grupoAtual, membroAtual, ehAdmin, ehMaster, podeGerenciarOrcamento, atualizarSenha, sair } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: avisosAtivos } = useAvisosAtivos();
  const [maisAberto, setMaisAberto] = useState(false);
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const itensPrincipais: ItemNav[] = [
    { to: "/", label: "Início", icon: <Home size={21} strokeWidth={2.1} /> },
    { to: "/calendario", label: "Agenda", icon: <CalendarDays size={21} strokeWidth={2.1} /> },
    { to: "/diario", label: "Diário", icon: <BookOpen size={21} strokeWidth={2.1} /> },
    { to: "/orcamento", label: "Orçamento", icon: <Wallet size={21} strokeWidth={2.1} /> },
    { label: "Mais", icon: <MoreHorizontal size={21} strokeWidth={2.1} />, onClick: () => setMaisAberto(true) },
  ];

  const itensMais = [
    { to: "/avisos", label: "Avisos", icon: <Megaphone size={18} /> },
    { to: "/manutencao", label: "Manutenção", icon: <Wrench size={18} /> },
    { to: "/seguro", label: "Seguro", icon: <ShieldCheck size={18} /> },
    { to: "/informacoes", label: "Informações Úteis", icon: <Info size={18} /> },
    ...(podeGerenciarOrcamento
      ? [{ to: "/painel-gestor", label: "Painel do Gestor", icon: <BarChart3 size={18} /> }]
      : []),
    ...(ehAdmin ? [{ to: "/cotistas", label: "Cotistas", icon: <Users size={18} /> }] : []),
    ...(ehAdmin ? [{ to: "/feriados", label: "Feriados", icon: <PartyPopper size={18} /> }] : []),
    ...(ehMaster ? [{ to: "/administrador", label: "Administrador", icon: <ShieldEllipsis size={18} /> }] : []),
  ];

  function abrirTrocaSenha() {
    setNovaSenha("");
    setConfirmarSenha("");
    setModalSenhaAberto(true);
    setMaisAberto(false);
  }

  async function salvarNovaSenha() {
    if (novaSenha.length < 6) { toast.erro("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (novaSenha !== confirmarSenha) { toast.erro("As senhas não coincidem."); return; }
    setSalvandoSenha(true);
    try {
      await atualizarSenha(novaSenha);
      toast.sucesso("Senha atualizada!");
      setModalSenhaAberto(false);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao atualizar senha.");
    } finally {
      setSalvandoSenha(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-background/80 px-5 backdrop-blur-md">
        <h1 className="truncate text-[19px] font-extrabold tracking-tight text-foreground">
          ⛵ {grupoAtual?.nome ?? "..."}
        </h1>
        <button onClick={() => setMaisAberto(true)}>
          <Avatar nome={membroAtual?.nome ?? "?"} destaque />
        </button>
      </header>

      {!!avisosAtivos?.length && (
        <button
          onClick={() => navigate("/avisos")}
          className="mx-auto block w-full max-w-2xl px-4 pt-2 text-left"
        >
          <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              {avisosAtivos.map((a) => (
                <p key={a.id} className="truncate text-[13px] font-semibold text-destructive">{a.mensagem}</p>
              ))}
            </div>
          </div>
        </button>
      )}

      <main className="mx-auto max-w-2xl px-4 pt-2">{children}</main>

      <BottomNavigation itens={itensPrincipais} />

      <Modal aberto={maisAberto} aoFechar={() => setMaisAberto(false)} titulo="Mais">
        <button
          onClick={abrirTrocaSenha}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-secondary/60 p-3.5 text-left hover:bg-secondary"
        >
          <Avatar nome={membroAtual?.nome ?? "?"} destaque size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold">{membroAtual?.nome}</p>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-royal">{membroAtual?.role}</p>
          </div>
          <span className="flex items-center gap-1 text-[11.5px] font-semibold text-muted-foreground">
            <KeyRound size={14} /> Trocar senha
          </span>
        </button>

        <div className="flex flex-col gap-2">
          {itensMais.map((item) => (
            <button
              key={item.to}
              onClick={() => {
                navigate(item.to);
                setMaisAberto(false);
              }}
              className="flex items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-softer border border-border/50 hover:bg-secondary/60"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-royal">
                {item.icon}
              </span>
              <span className="flex-1 text-[14.5px] font-semibold">{item.label}</span>
              <ChevronRight size={18} className="text-muted-foreground/50" />
            </button>
          ))}

          <button
            onClick={sair}
            className="mt-2 flex items-center gap-3 rounded-2xl p-3.5 text-left text-destructive hover:bg-destructive/5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10">
              <LogOut size={18} />
            </span>
            <span className="text-[14.5px] font-semibold">Sair</span>
          </button>
        </div>
      </Modal>

      <Modal aberto={modalSenhaAberto} aoFechar={() => setModalSenhaAberto(false)} titulo="Trocar senha">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Nova senha</Label>
            <Input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Confirmar nova senha</Label>
            <Input type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalSenhaAberto(false)}>Cancelar</Button>
            <Button onClick={salvarNovaSenha} disabled={salvandoSenha}>{salvandoSenha ? "Salvando..." : "Salvar"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
