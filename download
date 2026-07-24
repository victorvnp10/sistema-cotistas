import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default function ProvisionarGrupo() {
  const navigate = useNavigate();
  const toast = useToast();
  const { session, recarregarMembresias, selecionarGrupo } = useAuth();

  const [nome, setNome] = useState("");
  const [nomeRecurso, setNomeRecurso] = useState("Embarcação");
  const [diaVirada, setDiaVirada] = useState(4);
  const [adminNome, setAdminNome] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setCarregando(true);

    const { data: grupo, error } = await supabase.rpc("criar_grupo", {
      p_nome: nome,
      p_nome_recurso: nomeRecurso,
      p_dia_virada: diaVirada,
      p_admin_nome: adminNome,
      p_admin_email: adminEmail,
    });

    setCarregando(false);

    if (error || !grupo) {
      toast.erro("Não foi possível criar o grupo: " + error?.message);
      return;
    }

    await recarregarMembresias();

    const criouParaSiMesmo =
      !adminEmail.trim() || adminEmail.trim().toLowerCase() === session.user.email?.toLowerCase();

    toast.sucesso(
      criouParaSiMesmo
        ? "Grupo criado!"
        : `Grupo criado! Avise ${adminEmail} para se cadastrar com este e-mail — ele já entra como admin.`
    );

    if (criouParaSiMesmo) {
      selecionarGrupo(grupo.id);
      navigate("/", { replace: true });
    } else {
      setNome("");
      setAdminNome("");
      setAdminEmail("");
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-royal">
            <ShieldPlus size={20} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold">Provisionar novo grupo</h2>
            <p className="text-[12px] text-muted-foreground">Visível só para o usuário master</p>
          </div>
        </div>

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
                <Input value={adminNome} onChange={(e) => setAdminNome(e.target.value)} placeholder="Deixe em branco para ser você mesmo" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>E-mail do administrador</Label>
                <Input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="Deixe em branco para ser você mesmo"
                />
                <p className="text-[12px] text-muted-foreground">
                  Se preencher o e-mail de outra pessoa, ela recebe um convite (mesmo
                  mecanismo de convidar cotistas) e já entra como Admin ao se cadastrar.
                </p>
              </div>
            </div>
          </div>

          <Button type="submit" size="lg" disabled={carregando}>
            {carregando ? "Criando..." : "Criar grupo"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
