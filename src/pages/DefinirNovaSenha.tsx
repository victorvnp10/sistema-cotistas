import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/**
 * Exibida em vez de qualquer outra tela (ver App.tsx) quando o usuário
 * chega ao app através de um link de redefinição de senha por e-mail.
 * Só libera o resto do app depois que uma senha nova é definida.
 */
export default function DefinirNovaSenha() {
  const { atualizarSenha } = useAuth();
  const toast = useToast();

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (novaSenha.length < 6) { setErro("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (novaSenha !== confirmarSenha) { setErro("As senhas não coincidem."); return; }

    setSalvando(true);
    try {
      await atualizarSenha(novaSenha);
      toast.sucesso("Senha definida! Você já pode continuar.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao definir a senha.");
    } finally {
      setSalvando(false);
    }
  }

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
              <KeyRound size={26} />
            </div>
            <CardTitle className="text-[20px]">Defina sua nova senha</CardTitle>
            <CardDescription>
              Escolha uma senha nova para continuar. Você já está autenticado, então é só confirmar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={aoEnviar} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Nova senha</Label>
                <Input type="password" required value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Confirmar nova senha</Label>
                <Input type="password" required value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} />
              </div>

              {erro && (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive">{erro}</p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={salvando}>
                {salvando ? "Salvando..." : "Definir senha"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
