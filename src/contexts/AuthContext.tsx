import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database, Papel } from "@/types/database.types";
import { MASTER_EMAIL } from "@/lib/constants";

type Grupo = Database["public"]["Tables"]["grupos"]["Row"];
type Membro = Database["public"]["Tables"]["grupo_membros"]["Row"];

interface AuthContextValue {
  carregando: boolean;
  /** true assim que as membresias do usuário logado terminaram de ser buscadas (mesmo que vazias) */
  membresiasCarregadas: boolean;
  /** true quando o usuário chegou aqui por um link de redefinição de senha por e-mail -- a UI deve bloquear tudo e pedir a senha nova antes de liberar o app */
  emRecuperacaoSenha: boolean;
  session: Session | null;
  /** Grupo(s) a que o usuário logado pertence, com seu papel/cotas em cada um */
  membresias: (Membro & { grupo: Grupo })[];
  /** Grupo atualmente selecionado (normalmente o único, na maioria dos casos de uso) */
  grupoAtual: Grupo | null;
  membroAtual: Membro | null;
  selecionarGrupo: (grupoId: string) => void;
  podeGerenciarOrcamento: boolean;
  ehAdmin: boolean;
  ehMaster: boolean;
  recarregarMembresias: () => Promise<void>;
  /** Define uma nova senha para o usuário logado (self-service ou após clicar no link de recuperação) */
  atualizarSenha: (novaSenha: string) => Promise<void>;
  /** Envia um e-mail de redefinição de senha para o endereço informado (usado pelo admin para resetar a senha de outro cotista) */
  enviarLinkRedefinicaoSenha: (email: string) => Promise<void>;
  sair: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [carregando, setCarregando] = useState(true);
  const [membresiasCarregadas, setMembresiasCarregadas] = useState(false);
  const [emRecuperacaoSenha, setEmRecuperacaoSenha] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [membresias, setMembresias] = useState<(Membro & { grupo: Grupo })[]>([]);
  const [grupoIdSelecionado, setGrupoIdSelecionado] = useState<string | null>(
    () => localStorage.getItem("grupoIdSelecionado")
  );
  // Guarda o ID do último usuário autenticado visto, só pra detectar troca
  // de usuário dentro do listener -- não dispara re-render sozinho.
  const ultimoUserIdRef = useRef<string | null>(null);

  /**
   * Limpa TUDO que pertence ao usuário anterior: membresias em memória,
   * grupo selecionado (inclusive o localStorage) e o cache inteiro do
   * React Query (dados de diário, orçamento, manutenção etc.). Chamado
   * sempre que o listener de auth detecta troca de usuário -- login,
   * logout, ou troca de sessão num dispositivo compartilhado -- nunca
   * dependendo só do botão "Sair", que pode não ser o gatilho real.
   */
  function limparEstadoDoUsuarioAnterior() {
    setMembresias([]);
    setMembresiasCarregadas(false);
    setGrupoIdSelecionado(null);
    localStorage.removeItem("grupoIdSelecionado");
    queryClient.clear();
  }

  async function carregarMembresias() {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setMembresias([]);
      setMembresiasCarregadas(true);
      return;
    }

    const { data, error } = await supabase
      .from("grupo_membros")
      .select("*, grupo:grupos(*)")
      .eq("ativo", true)
      .eq("user_id", userId);

    if (error) {
      // Erro transitório (rede, token expirando etc.) -- NUNCA zera
      // membresias aqui. Se zerasse, o roteador acharia que o usuário
      // não pertence a grupo nenhum e o mandaria pra tela errada (esse
      // era exatamente o bug de "voltar pra criar grupo" do nada).
      console.error("Erro ao carregar grupos do usuário:", error.message);
      setMembresiasCarregadas(true);
      return;
    }
    setMembresias((data ?? []) as unknown as (Membro & { grupo: Grupo })[]);
    setMembresiasCarregadas(true);
  }

  useEffect(() => {
    let ativo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      ultimoUserIdRef.current = data.session?.user.id ?? null;
      setSession(data.session);
      setCarregando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, novaSession) => {
      const novoUserId = novaSession?.user.id ?? null;
      if (novoUserId !== ultimoUserIdRef.current) {
        // Trocou de usuário (login, logout, ou troca de sessão num
        // dispositivo compartilhado) -- limpa tudo do usuário anterior
        // ANTES de aceitar a nova sessão, pra nunca misturar dados.
        limparEstadoDoUsuarioAnterior();
        ultimoUserIdRef.current = novoUserId;
      }
      if (event === "PASSWORD_RECOVERY") {
        setEmRecuperacaoSenha(true);
      }
      setSession(novaSession);
    });

    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) {
      setMembresiasCarregadas(false);
      carregarMembresias();
    } else {
      setMembresias([]);
      setMembresiasCarregadas(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const membroAtual =
    membresias.find((m) => m.grupo_id === grupoIdSelecionado) ??
    membresias[0] ??
    null;
  const grupoAtual = membroAtual?.grupo ?? null;

  function selecionarGrupo(grupoId: string) {
    localStorage.setItem("grupoIdSelecionado", grupoId);
    setGrupoIdSelecionado(grupoId);
  }

  async function atualizarSenha(novaSenha: string) {
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) throw error;
    setEmRecuperacaoSenha(false);
  }

  async function enviarLinkRedefinicaoSenha(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  }

  async function sair() {
    await supabase.auth.signOut();
    // A limpeza de membresias, grupo selecionado e cache do React Query
    // já acontece automaticamente no listener de auth acima, assim que
    // ele detecta que o usuário virou null -- não duplica aqui.
  }

  const ehAdmin = membroAtual?.role === "admin";
  const ehMaster = session?.user.email === MASTER_EMAIL;
  const podeGerenciarOrcamento: boolean =
    membroAtual?.role === "admin" || membroAtual?.role === "gestor";

  const value: AuthContextValue = {
    carregando,
    membresiasCarregadas,
    emRecuperacaoSenha,
    session,
    membresias,
    grupoAtual,
    membroAtual,
    selecionarGrupo,
    podeGerenciarOrcamento,
    ehAdmin,
    ehMaster,
    recarregarMembresias: carregarMembresias,
    atualizarSenha,
    enviarLinkRedefinicaoSenha,
    sair,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}

export type { Papel };
