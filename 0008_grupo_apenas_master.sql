import { motion } from "framer-motion";
import { MailQuestion } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AguardandoConvite() {
  const { session, sair } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-petrol via-ocean to-royal p-5">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <Card className="shadow-floating text-center">
          <CardContent className="flex flex-col items-center gap-4 py-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-accent text-royal">
              <MailQuestion size={26} />
            </div>
            <div>
              <h1 className="text-[19px] font-extrabold tracking-tight">Aguardando convite</h1>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                Sua conta ainda não está vinculada a nenhum grupo. Peça ao administrador do
                seu grupo para te cadastrar como cotista usando exatamente este e-mail:
              </p>
              <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-[13.5px] font-bold">
                {session?.user.email}
              </p>
            </div>
            <Button variant="ghost" onClick={sair}>Sair</Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
