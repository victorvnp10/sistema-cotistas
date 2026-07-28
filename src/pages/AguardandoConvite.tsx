import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MailCheck, ShieldEllipsis, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/**
 * Exibida pra qualquer usuário autenticado que ainda não pertence a
 * nenhum grupo. Note: com a correção de roteamento, o master NUNCA mais
 * cai aqui automaticamente por engano -- só chega numa tela sem grupo se
 * genuinamente ainda não foi adicionado a nenhum. Nesse caso, mostramos
 * um atalho pra Administração em vez de deixá-lo preso sem saída.
 */
export default function AguardandoConvite() {
  const navigate = useNavigate();
  const { ehMaster, sair } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-petrol via-ocean to-royal p-5">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="shadow-floating">
          <CardHeader className="items-center text-center">
            <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-royal to-ocean text-white shadow-soft">
              <MailCheck size={26} />
            </div>
            <CardTitle className="text-[20px]">Aguardando convite</CardTitle>
            <CardDescription>
              Você ainda não foi adicionado a nenhum grupo. Peça para o administrador do seu grupo te
              convidar usando exatamente o e-mail com que você entrou aqui.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {ehMaster && (
                <Button size="lg" className="w-full" onClick={() => navigate("/administrador")}>
                  <ShieldEllipsis size={17} /> Ir para Administração
                </Button>
              )}
              <Button size="lg" variant="outline" className="w-full" onClick={sair}>
                <LogOut size={17} /> Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
