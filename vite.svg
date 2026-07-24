import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
import PainelGestor from "@/pages/PainelGestor";
import ProvisionarGrupo from "@/pages/ProvisionarGrupo";
import AppLayout from "@/components/AppLayout";

function TelaCarregando() {
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Carregando...
    </div>
  );
}

export default function App() {
  const { carregando, session, membresias, ehAdmin, ehMaster } = useAuth();

  if (carregando) return <TelaCarregando />;

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/criar-grupo"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : membresias.length > 0 ? (
            <Navigate to="/" replace />
          ) : ehMaster ? (
            <CriarGrupo />
          ) : (
            <Navigate to="/aguardando-convite" replace />
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
          ) : ehMaster ? (
            <Navigate to="/criar-grupo" replace />
          ) : (
            <AguardandoConvite />
          )
        }
      />
      <Route
        path="/*"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : membresias.length === 0 ? (
            <Navigate to={ehMaster ? "/criar-grupo" : "/aguardando-convite"} replace />
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
                <Route path="/painel-gestor" element={<PainelGestor />} />
                {ehAdmin && <Route path="/cotistas" element={<Cotistas />} />}
                {ehAdmin && <Route path="/feriados" element={<Feriados />} />}
                {ehMaster && <Route path="/provisionar-grupo" element={<ProvisionarGrupo />} />}
              </Routes>
            </AppLayout>
          )
        }
      />
    </Routes>
  );
}
