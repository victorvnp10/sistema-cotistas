import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function CriarGrupo() {
  const navigate = useNavigate();
  const { session, recarregarMembresias, selecionarGrupo } = useAuth();

  const [nome, setNome] = useState("");
  const [nomeRecurso, setNomeRecurso] = useState("Embarcação");
  const [diaVirada, setDiaVirada] = useState(4);
  const [nomeAdmin, setNomeAdmin] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setErro(null);
    setCarregando(true);

    const { data: grupo, error: erroGrupo } = await supabase
      .from("grupos")
      .insert({ nome, nome_recurso: nomeRecurso, dia_virada: diaVirada })
      .select()
      .single();

    if (erroGrupo || !grupo) {
      setErro("Não foi possível criar o grupo: " + erroGrupo?.message);
      setCarregando(false);
      return;
    }

    const { error: erroMembro } = await supabase.from("grupo_membros").insert({
      grupo_id: grupo.id,
      user_id: session.user.id,
      nome: nomeAdmin || session.user.email || "Admin",
      email: session.user.email ?? "",
      role: "admin",
      cotas: 1,
      ativo: true,
    });

    if (erroMembro) {
      setErro("Grupo criado, mas houve um erro ao te cadastrar como admin: " + erroMembro.message);
      setCarregando(false);
      return;
    }

    await recarregarMembresias();
    selecionarGrupo(grupo.id);
    setCarregando(false);
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-blue-500 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader>
          <CardTitle>Criar novo grupo</CardTitle>
          <CardDescription>
            Cada grupo é totalmente independente — dados, cotistas e finanças não se
            misturam entre grupos diferentes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={aoEnviar} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nome">Nome do grupo</Label>
              <Input
                id="nome"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder='Ex: "Amigos - Jolly Roger"'
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="recurso">Como vocês chamam o que é compartilhado?</Label>
              <Input
                id="recurso"
                required
                value={nomeRecurso}
                onChange={(e) => setNomeRecurso(e.target.value)}
                placeholder='Ex: "Embarcação", "Cabana", "Chácara"'
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dia">Dia de virada do mês (cobrança)</Label>
              <Input
                id="dia"
                type="number"
                min={1}
                max={28}
                required
                value={diaVirada}
                onChange={(e) => setDiaVirada(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Dia do mês em que mensalidades/taxas recorrentes são devidas. Pode
                mudar depois nas configurações do grupo.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nomeAdmin">Seu nome (você será o administrador)</Label>
              <Input
                id="nomeAdmin"
                required
                value={nomeAdmin}
                onChange={(e) => setNomeAdmin(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <Button type="submit" disabled={carregando}>
              {carregando ? "Criando..." : "Criar grupo"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
