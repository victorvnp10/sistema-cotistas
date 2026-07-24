import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Anchor, Mail, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisoCadastro, setAvisoCadastro] = useState<string | null>(null);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAvisoCadastro(null);
    setCarregando(true);

    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      setCarregando(false);
      if (error) {
        setErro("E-mail ou senha incorretos.");
        return;
      }
      navigate("/", { replace: true });
    } else {
      const { error } = await supabase.auth.signUp({ email, password: senha });
      setCarregando(false);
      if (error) {
        setErro(error.message);
        return;
      }
      setAvisoCadastro(
        "Conta criada! Verifique seu e-mail para confirmar o cadastro e depois faça login."
      );
      setModo("entrar");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-petrol via-ocean to-royal p-5">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <Card className="shadow-floating">
          <CardContent className="flex flex-col items-center gap-6 py-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-royal to-ocean text-white shadow-soft">
              <Anchor size={26} />
            </div>
            <div className="text-center">
              <h1 className="text-[22px] font-extrabold tracking-tight">Gestão de Cotistas</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {modo === "entrar" ? "Entre com sua conta" : "Crie sua conta"}
              </p>
            </div>

            <form onSubmit={aoEnviar} className="flex w-full flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>E-mail</Label>
                <Input
                  icon={<Mail size={17} />}
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Senha</Label>
                <Input
                  icon={<Lock size={17} />}
                  type="password"
                  autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {erro && (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive">
                  {erro}
                </p>
              )}
              {avisoCadastro && (
                <p className="rounded-xl bg-success-soft px-3 py-2 text-[13px] font-medium text-success">
                  {avisoCadastro}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={carregando}>
                {carregando ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar conta"}
              </Button>

              <button
                type="button"
                className="text-[13px] font-semibold text-muted-foreground hover:text-royal"
                onClick={() => {
                  setErro(null);
                  setAvisoCadastro(null);
                  setModo(modo === "entrar" ? "cadastrar" : "entrar");
                }}
              >
                {modo === "entrar" ? "Ainda não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
              </button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
