import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Anchor } from "lucide-react";
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

    const { data: grupo, error: erroGrupo } = await supabase.rpc("criar_grupo", {
      p_nome: nome,
      p_nome_recurso: nomeRecurso,
      p_dia_virada: diaVirada,
      p_nome_admin: nomeAdmin || session.user.email || "Admin",
    });

    if (erroGrupo || !grupo) {
      setErro("Não foi possível criar o grupo: " + erroGrupo?.message);
      setCarregando(false);
      return;
    }

    await recarregarMembresias();
    selecionarGrupo(grupo.id);
    setCarregando(false);
    navigate("/", { replace: true });
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
              <Anchor size={26} />
            </div>
            <CardTitle className="text-[20px]">Criar novo grupo</CardTitle>
            <CardDescription>
              Cada grupo é totalmente independente — dados, cotistas e finanças não se
              misturam entre grupos diferentes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={aoEnviar} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Nome do grupo</Label>
                <Input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder='Ex: "Amigos - Jolly Roger"' />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Como vocês chamam o que é compartilhado?</Label>
                <Input
                  required
                  value={nomeRecurso}
                  onChange={(e) => setNomeRecurso(e.target.value)}
                  placeholder='Ex: "Embarcação", "Cabana", "Chácara"'
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Dia de virada do mês (cobrança)</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  required
                  value={diaVirada}
                  onChange={(e) => setDiaVirada(Number(e.target.value))}
                />
                <p className="text-[12px] text-muted-foreground">
                  Dia do mês em que mensalidades/taxas recorrentes são devidas. Pode mudar
                  depois nas configurações do grupo.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Seu nome (você será o administrador)</Label>
                <Input required value={nomeAdmin} onChange={(e) => setNomeAdmin(e.target.value)} placeholder="Seu nome completo" />
              </div>

              {erro && (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive">
                  {erro}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={carregando}>
                {carregando ? "Criando..." : "Criar grupo"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
