import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Anchor } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/**
 * Tela de PROVISIONAMENTO -- só o usuário master chega aqui (ver App.tsx,
 * que já bloqueia a rota para qualquer outro usuário). O guard abaixo é
 * uma segunda camada de proteção, direto no componente.
 * Ele cria o grupo e já indica quem vai ser o Admin (o novo gestor/cliente),
 * que recebe um convite por e-mail -- o mesmo mecanismo usado para
 * convidar cotistas. O master não precisa ser admin do grupo que cria.
 */
export default function CriarGrupo() {
  const navigate = useNavigate();
  const { session, ehMaster, recarregarMembresias, selecionarGrupo } = useAuth();

  useEffect(() => {
    if (!ehMaster) navigate("/", { replace: true });
  }, [ehMaster, navigate]);

  const [nome, setNome] = useState("");
  const [nomeRecurso, setNomeRecurso] = useState("Embarcação");
  const [diaVirada, setDiaVirada] = useState(4);
  const [adminNome, setAdminNome] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
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
      p_admin_nome: adminNome,
      p_admin_email: adminEmail,
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
            <CardTitle className="text-[20px]">Provisionar novo grupo</CardTitle>
            <CardDescription>
              Você é o usuário master. Crie o grupo e indique quem será o
              administrador (o gestor responsável por cadastrar os cotistas) —
              ele recebe um convite pelo e-mail informado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={aoEnviar} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Nome do grupo</Label>
                <Input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder='Ex: "Amigos - Jolly Roger"' />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Como chamam o que é compartilhado?</Label>
                <Input required value={nomeRecurso} onChange={(e) => setNomeRecurso(e.target.value)} placeholder='Ex: "Embarcação", "Cabana"' />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Dia de virada do mês (cobrança)</Label>
                <Input type="number" min={1} max={28} required value={diaVirada} onChange={(e) => setDiaVirada(Number(e.target.value))} />
              </div>
              <div className="border-t border-border/60 pt-3">
                <p className="mb-3 text-[12.5px] font-bold uppercase tracking-wide text-muted-foreground">
                  Administrador deste grupo
                </p>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Nome do administrador</Label>
                    <Input required value={adminNome} onChange={(e) => setAdminNome(e.target.value)} placeholder="Nome do gestor/cliente" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>E-mail do administrador</Label>
                    <Input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="email@dogestor.com"
                    />
                    <p className="text-[12px] text-muted-foreground">
                      Essa pessoa deve se cadastrar no app usando exatamente este e-mail.
                    </p>
                  </div>
                </div>
              </div>

              {erro && (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive">{erro}</p>
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
