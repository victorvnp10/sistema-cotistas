import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Anchor, Mail, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

/** Logo oficial do Google (multicolorida) -- não existe no set de ícones lucide-react, que só traz símbolos genéricos. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03l3.05-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { enviarLinkRedefinicaoSenha } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"entrar" | "cadastrar" | "recuperar">("entrar");
  const [carregando, setCarregando] = useState(false);
  const [carregandoGoogle, setCarregandoGoogle] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisoCadastro, setAvisoCadastro] = useState<string | null>(null);
  const [avisoRecuperacao, setAvisoRecuperacao] = useState<string | null>(null);

  // O Supabase redireciona de volta com ?error=...&error_description=...
  // quando o login com Google falha (ex.: provedor não configurado no
  // painel) -- sem isso a pessoa só via a tela de login de novo, sem
  // entender o motivo.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace("#", "?"));
    const descricao = params.get("error_description");
    if (descricao) {
      setErro(decodeURIComponent(descricao.replace(/\+/g, " ")));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function entrarComGoogle() {
    setErro(null);
    setCarregandoGoogle(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setErro(error.message);
      setCarregandoGoogle(false);
    }
    // Em caso de sucesso, o navegador é redirecionado para o Google --
    // não há mais nada a fazer aqui.
  }

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAvisoCadastro(null);
    setCarregando(true);

    if (modo === "recuperar") {
      try {
        await enviarLinkRedefinicaoSenha(email);
        setAvisoRecuperacao(
          "Se esse e-mail tiver uma conta, enviamos um link para redefinir a senha. Confira sua caixa de entrada."
        );
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao enviar o link.");
      }
      setCarregando(false);
      return;
    }

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
                {modo === "entrar" ? "Entre com sua conta" : modo === "cadastrar" ? "Crie sua conta" : "Recupere sua senha"}
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

              {modo !== "recuperar" && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Senha</Label>
                    {modo === "entrar" && (
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-royal hover:underline"
                        onClick={() => {
                          setErro(null);
                          setAvisoCadastro(null);
                          setAvisoRecuperacao(null);
                          setModo("recuperar");
                        }}
                      >
                        Esqueci minha senha
                      </button>
                    )}
                  </div>
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
              )}

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
              {avisoRecuperacao && (
                <p className="rounded-xl bg-success-soft px-3 py-2 text-[13px] font-medium text-success">
                  {avisoRecuperacao}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={carregando || carregandoGoogle}>
                {carregando
                  ? "Aguarde..."
                  : modo === "entrar"
                    ? "Entrar"
                    : modo === "cadastrar"
                      ? "Criar conta"
                      : "Enviar link de redefinição"}
              </Button>

              {modo === "recuperar" ? (
                <button
                  type="button"
                  className="text-[13px] font-semibold text-muted-foreground hover:text-royal"
                  onClick={() => {
                    setErro(null);
                    setAvisoRecuperacao(null);
                    setModo("entrar");
                  }}
                >
                  Voltar para o login
                </button>
              ) : (
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
              )}
            </form>

            {modo !== "recuperar" && (
              <>
                <div className="flex w-full items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[12px] font-medium text-muted-foreground">ou</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  disabled={carregando || carregandoGoogle}
                  onClick={entrarComGoogle}
                >
                  <GoogleIcon />
                  {carregandoGoogle ? "Redirecionando..." : "Continuar com Google"}
                </Button>
                <p className="-mt-3 text-center text-[11.5px] text-muted-foreground">
                  Use o mesmo e-mail com que você foi convidado.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
