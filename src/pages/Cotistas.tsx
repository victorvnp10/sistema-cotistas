import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useMembros, useSalvarMembro } from "@/lib/queries/useMembros";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { Database, Papel } from "@/types/database.types";

type Membro = Database["public"]["Tables"]["grupo_membros"]["Row"];

export default function Cotistas() {
  const { ehAdmin, grupoAtual } = useAuth();
  const { data: membros, isLoading } = useMembros();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Membro | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>👥 Cotistas</CardTitle>
            <CardDescription>
              Cada cotista paga e usa a {grupoAtual?.nome_recurso.toLowerCase()} proporcional
              ao número de {grupoAtual?.termo_cota}s que possui.
            </CardDescription>
          </div>
          {ehAdmin && (
            <Button
              size="sm"
              onClick={() => {
                setEditando(null);
                setModalAberto(true);
              }}
            >
              + Convidar cotista
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {membros?.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
                      m.role === "admin" ? "bg-amber-500" : "bg-primary"
                    )}
                  >
                    {m.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.email} {m.telefone ? `· ${m.telefone}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">
                      {m.cotas} {grupoAtual?.termo_cota}
                      {m.cotas !== 1 ? "s" : ""}
                    </span>
                    <div className="flex gap-1">
                      {m.role !== "cotista" && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                          {m.role}
                        </span>
                      )}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          m.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}
                      >
                        {m.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    {ehAdmin && (
                      <button
                        className="text-[11px] font-semibold text-primary hover:underline"
                        onClick={() => {
                          setEditando(m);
                          setModalAberto(true);
                        }}
                      >
                        Editar
                      </button>
                    )}
                    {!m.user_id && (
                      <span className="text-[10px] italic text-muted-foreground">
                        convite pendente
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ModalCotista
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        membro={editando}
      />
    </div>
  );
}

function ModalCotista({
  aberto,
  aoFechar,
  membro,
}: {
  aberto: boolean;
  aoFechar: () => void;
  membro: Membro | null;
}) {
  const { grupoAtual } = useAuth();
  const toast = useToast();
  const salvar = useSalvarMembro();

  const [nome, setNome] = useState(membro?.nome ?? "");
  const [email, setEmail] = useState(membro?.email ?? "");
  const [telefone, setTelefone] = useState(membro?.telefone ?? "");
  const [role, setRole] = useState<Papel>(membro?.role ?? "cotista");
  const [cotas, setCotas] = useState(membro?.cotas ?? 1);
  const [ativo, setAtivo] = useState(membro?.ativo ?? true);

  // Reseta o formulário sempre que o membro em edição muda (ou ao abrir para criar um novo)
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
      await salvar.mutateAsync({
        id: membro?.id,
        nome,
        email,
        telefone: telefone || null,
        role,
        cotas,
        ativo,
      });
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
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!membro}
          />
          {!membro && (
            <p className="text-xs text-muted-foreground">
              A pessoa deve se cadastrar no app usando exatamente este e-mail.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Telefone</Label>
          <Input value={telefone ?? ""} onChange={(e) => setTelefone(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Função</Label>
            <select
              className="h-10 rounded-md border border-input px-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as Papel)}
            >
              <option value="cotista">Cotista</option>
              <option value="gestor">Gestor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{grupoAtual?.termo_cota}s</Label>
            <Input
              type="number"
              min={0.5}
              step={0.5}
              value={cotas}
              onChange={(e) => setCotas(Number(e.target.value))}
            />
          </div>
        </div>
        {membro && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Ativo
          </label>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={aoSalvar} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
