import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MASTER_EMAIL } from "@/lib/constants";
import Login from "@/pages/Login";
import CriarGrupo from "@/pages/CriarGrupo";
import AguardandoConvite from "@/pages/AguardandoConvite";
import Dashboard from "@/pages/Dashboard";
import Calendario from "@/pages/Calendario";
import Cotistas from "@/pages/Cotistas";
import Feriados from "@/pages/Feriados";
import Orcamento from "@/pages/Orcamento";
import Manutencao from "@/pages/Manutencao";
import Diario from "@/pages/Diario";
import Seguro from "@/pages/Seguro";
import Informacoes from "@/pages/Informacoes";
import Avisos from "@/pages/Avisos";
import PainelGestor from "@/pages/PainelGestor";
import Administrador from "@/pages/Administrador";
import DefinirNovaSenha from "@/pages/DefinirNovaSenha";
import AppLayout from "@/components/AppLayout";

function TelaCarregando() {
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Carregando...
    </div>
  );
}

export default function App() {
  const { carregando, membresiasCarregadas, emRecuperacaoSenha, session, membresias, ehAdmin } = useAuth();

  // Enquanto a sessão OU as membresias ainda estão carregando, não avalia
  // nenhuma rota de onboarding/dashboard -- evita o flash da tela de criar
  // grupo (ou aguardando convite) antes do dashboard aparecer.
  if (carregando || (session && !membresiasCarregadas)) return <TelaCarregando />;

  // Usuário chegou aqui por um link de redefinição de senha por e-mail --
  // bloqueia qualquer outra tela até definir a senha nova.
  if (emRecuperacaoSenha) return <DefinirNovaSenha />;

  const ehMaster = session?.user.email === MASTER_EMAIL;

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/criar-grupo"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : ehMaster ? (
            <CriarGrupo />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/aguardando-convite"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : membresias.length > 0 ? (
            <Navigate to="/" replace />
          ) : (
            <AguardandoConvite />
          )
        }
      />
      <Route
        path="/administrador"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : ehMaster ? (
            <AppLayout>
              <Administrador />
            </AppLayout>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/*"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : membresias.length === 0 ? (
            // Nunca redireciona pra /criar-grupo automaticamente, nem
            // pro master -- essa tela só é alcançada clicando em
            // Administração. Zero grupos, pra qualquer usuário, sempre
            // cai na tela de espera.
            <Navigate to="/aguardando-convite" replace />
          ) : (
            <AppLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/calendario" element={<Calendario />} />
                <Route path="/orcamento" element={<Orcamento />} />
                <Route path="/manutencao" element={<Manutencao />} />
                <Route path="/diario" element={<Diario />} />
                <Route path="/seguro" element={<Seguro />} />
                <Route path="/informacoes" element={<Informacoes />} />
                <Route path="/avisos" element={<Avisos />} />
                <Route path="/painel-gestor" element={<PainelGestor />} />
                {ehAdmin && <Route path="/cotistas" element={<Cotistas />} />}
                {ehAdmin && <Route path="/feriados" element={<Feriados />} />}
              </Routes>
            </AppLayout>
          )
        }
      />
    </Routes>
  );
}
