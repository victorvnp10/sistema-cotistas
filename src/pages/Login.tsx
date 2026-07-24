import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-blue-500 p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <div className="text-4xl mb-1">⛵</div>
          <CardTitle className="text-xl">Gestão de Cotistas</CardTitle>
          <CardDescription>
            {modo === "entrar" ? "Entre com sua conta" : "Crie sua conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={aoEnviar} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="********"
              />
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}
            {avisoCadastro && <p className="text-sm text-success">{avisoCadastro}</p>}

            <Button type="submit" disabled={carregando}>
              {carregando ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar conta"}
            </Button>

            <button
              type="button"
              className="text-xs text-muted-foreground hover:underline"
              onClick={() => {
                setErro(null);
                setAvisoCadastro(null);
                setModo(modo === "entrar" ? "cadastrar" : "entrar");
              }}
            >
              {modo === "entrar"
                ? "Ainda não tem conta? Cadastre-se"
                : "Já tem conta? Entrar"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
