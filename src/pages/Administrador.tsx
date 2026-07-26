import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldEllipsis, PlusCircle, KeyRound, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useMembros } from "@/lib/queries/useMembros";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Só o usuário master (victornogueirapinto@gmail.com) acessa esta tela --
 * ver App.tsx, que só monta essa rota quando ehMaster. O guard abaixo é
 * uma segunda camada de proteção, direto no componente.
 */
export default function Administrador() {
  const navigate = useNavigate();
  const { ehMaster, grupoAtual, enviarLinkRedefinicaoSenha } = useAuth();
  const toast = useToast();
  const { data: membros } = useMembros();

  useEffect(() => {
    if (!ehMaster) navigate("/", { replace: true });
  }, [ehMaster, navigate]);

  const [emailReset, setEmailReset] = useState("");
  const [enviandoPara, setEnviandoPara] = useState<string | null>(null);

  async function enviarPara(email: string) {
    setEnviandoPara(email);
    try {
      await enviarLinkRedefinicaoSenha(email);
      toast.sucesso(`E-mail de redefinição enviado para ${email}.`);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao enviar e-mail.");
    } finally {
      setEnviandoPara(null);
    }
  }

  async function enviarParaEmailDigitado() {
    if (!emailReset) { toast.erro("Digite um e-mail."); return; }
    await enviarPara(emailReset);
    setEmailReset("");
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Card>
        <h2 className="mb-1 flex items-center gap-2 text-[15px] font-bold">
          <ShieldEllipsis size={17} className="text-royal" /> Administrador
        </h2>
        <p className="text-[12.5px] text-muted-foreground">
          Visível apenas para o usuário master.
        </p>
      </Card>

      <Card>
        <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold">
          <PlusCircle size={17} className="text-royal" /> Novo grupo
        </h2>
        <p className="mb-3 text-[12.5px] text-muted-foreground">
          Cria um novo grupo (embarcação, cabana, etc.) e convida o administrador responsável por ele.
        </p>
        <Button onClick={() => navigate("/criar-grupo")}>Criar novo grupo</Button>
      </Card>

      <Card>
        <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold">
          <KeyRound size={17} className="text-royal" /> Redefinir senha de cotista
        </h2>
        <p className="mb-3 text-[12.5px] text-muted-foreground">
          Envia um e-mail com um link para o cotista definir uma senha nova. Ele não recebe a senha atual,
          só o link.
        </p>

        {!!membros?.length && (
          <div className="mb-4 flex flex-col gap-2">
            <Label>Cotistas de {grupoAtual?.nome ?? "este grupo"}</Label>
            {membros.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-white px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold">{m.nome}</p>
                  <p className="truncate text-[11.5px] text-muted-foreground">{m.email}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => enviarPara(m.email)}
                  disabled={enviandoPara === m.email}
                >
                  {enviandoPara === m.email ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border/60 pt-3">
          <Label>Ou digite o e-mail de um cotista de outro grupo</Label>
          <div className="mt-1.5 flex gap-2">
            <Input type="email" value={emailReset} onChange={(e) => setEmailReset(e.target.value)} placeholder="email@exemplo.com" />
            <Button variant="outline" onClick={enviarParaEmailDigitado} disabled={!!enviandoPara}>
              <Send size={15} /> Enviar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
