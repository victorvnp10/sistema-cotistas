import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useMembros, useSalvarMembro } from "@/lib/queries/useMembros";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import type { Database, Papel } from "@/types/database.types";

type Membro = Database["public"]["Tables"]["grupo_membros"]["Row"];

export default function Cotistas() {
  const { ehAdmin, grupoAtual } = useAuth();
  const { data: membros, isLoading } = useMembros();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Membro | null>(null);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold">Cotistas</h2>
            <p className="text-[12.5px] text-muted-foreground">
              Rateio proporcional ao número de {grupoAtual?.termo_cota}s.
            </p>
          </div>
          {ehAdmin && (
            <Button size="sm" onClick={() => { setEditando(null); setModalAberto(true); }}>
              <UserPlus size={16} /> Convidar
            </Button>
          )}
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {membros?.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white p-3.5 shadow-softer">
                <Avatar nome={m.nome} destaque={m.role === "admin"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold">{m.nome}</p>
                  <p className="truncate text-[12px] text-muted-foreground">{m.email}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge variant="neutral">{m.cotas} {grupoAtual?.termo_cota}{m.cotas !== 1 ? "s" : ""}</Badge>
                  <div className="flex gap-1">
                    {m.role !== "cotista" && <Badge variant="info">{m.role}</Badge>}
                    <Badge variant={m.ativo ? "success" : "error"}>{m.ativo ? "Ativo" : "Inativo"}</Badge>
                  </div>
                  {ehAdmin && (
                    <button
                      className="text-[11.5px] font-bold text-royal hover:underline"
                      onClick={() => { setEditando(m); setModalAberto(true); }}
                    >
                      Editar
                    </button>
                  )}
                  {!m.user_id && <span className="text-[10px] italic text-muted-foreground">convite pendente</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ModalCotista aberto={modalAberto} aoFechar={() => setModalAberto(false)} membro={editando} />
    </div>
  );
}

function ModalCotista({ aberto, aoFechar, membro }: { aberto: boolean; aoFechar: () => void; membro: Membro | null }) {
  const { grupoAtual } = useAuth();
  const toast = useToast();
  const salvar = useSalvarMembro();

  const [nome, setNome] = useState(membro?.nome ?? "");
  const [email, setEmail] = useState(membro?.email ?? "");
  const [telefone, setTelefone] = useState(membro?.telefone ?? "");
  const [role, setRole] = useState<Papel>(membro?.role ?? "cotista");
  const [cotas, setCotas] = useState(membro?.cotas ?? 1);
  const [ativo, setAtivo] = useState(membro?.ativo ?? true);

  const chaveForm = membro?.id ?? "novo";
  const [ultimaChave, setUltimaChave] = useState(chaveForm);
  if (chaveForm !== ultimaChave) {
    setUltimaChave(chaveForm);
    setNome(membro?.nome ?? "");
    setEmail(membro?.email ?? "");
    setTelefone(membro?.telefone ?? "");
    setRole(membro?.role ?? "cotista");
    setCotas(membro?.cotas ?? 1);
    setAtivo(membro?.ativo ?? true);
  }

  async function aoSalvar() {
    if (!nome || !email) {
      toast.erro("Preencha nome e e-mail.");
      return;
    }
    try {
      await salvar.mutateAsync({ id: membro?.id, nome, email, telefone: telefone || null, role, cotas, ativo });
      toast.sucesso(membro ? "Cotista atualizado!" : "Convite criado! Peça para a pessoa se cadastrar com este e-mail.");
      aoFechar();
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={membro ? "Editar cotista" : "Convidar cotista"}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>E-mail</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!membro} />
          {!membro && <p className="text-[12px] text-muted-foreground">A pessoa deve se cadastrar com exatamente este e-mail.</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Telefone</Label>
          <Input value={telefone ?? ""} onChange={(e) => setTelefone(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Função</Label>
            <select className="h-12 rounded-2xl border border-input bg-white px-3 text-[16px]" value={role} onChange={(e) => setRole(e.target.value as Papel)}>
              <option value="cotista">Cotista</option>
              <option value="gestor">Gestor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{grupoAtual?.termo_cota}s</Label>
            <Input type="number" min={0.5} step={0.5} value={cotas} onChange={(e) => setCotas(Number(e.target.value))} />
          </div>
        </div>
        {membro && (
          <label className="flex items-center gap-2 text-[13.5px] font-medium">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 accent-royal" />
            Ativo
          </label>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button onClick={aoSalvar} disabled={salvar.isPending}>{salvar.isPending ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </Modal>
  );
}
