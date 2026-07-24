import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, CalendarCheck2, CalendarDays, Users2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMembros } from "@/lib/queries/useMembros";
import { useFeriados } from "@/lib/queries/useFeriados";
import { useReservas } from "@/lib/queries/useReservas";
import { useSeguros } from "@/lib/queries/useSeguro";
import {
  calcularRanking,
  calcularProximosDias,
  construirSetFeriados,
  formatarDataBR,
  formatarDataISO,
} from "@/lib/ranking";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";

export default function Dashboard() {
  const { grupoAtual, membroAtual } = useAuth();
  const { data: membros } = useMembros();
  const { data: feriados } = useFeriados();
  const { data: reservas } = useReservas();
  const { data: seguros } = useSeguros();

  const feriadosSet = useMemo(() => construirSetFeriados(feriados ?? []), [feriados]);

  const ranking = useMemo(
    () => calcularRanking(membros ?? [], reservas ?? [], feriadosSet),
    [membros, reservas, feriadosSet]
  );

  const proximosDias = useMemo(
    () => calcularProximosDias(reservas ?? [], feriados ?? [], feriadosSet),
    [reservas, feriados, feriadosSet]
  );

  const posicaoRanking = ranking.findIndex((l) => l.membroId === membroAtual?.id) + 1;

  const hojeISO = formatarDataISO(new Date());
  const minhaProximaReserva = (reservas ?? [])
    .filter((r) => r.membro_id === membroAtual?.id && r.status !== "cancelado" && r.data >= hojeISO)
    .sort((a, b) => (a.data < b.data ? -1 : 1))[0];

  const mesAtualPrefixo = hojeISO.substring(0, 7);
  const reservasEsteMes = (reservas ?? []).filter(
    (r) => r.status !== "cancelado" && r.data.startsWith(mesAtualPrefixo)
  ).length;

  const cotistasAtivos = (membros ?? []).filter((m) => m.ativo).length;

  const apoliceAtual = seguros?.[0] ?? null;
  let seguroValor = "—";
  let seguroSub = "nenhuma apólice cadastrada";
  if (apoliceAtual) {
    const dias = Math.round(
      (new Date(apoliceAtual.data_vencimento + "T00:00:00").getTime() - new Date(hojeISO + "T00:00:00").getTime()) /
        86400000
    );
    seguroValor = formatarDataBR(apoliceAtual.data_vencimento);
    seguroSub = dias < 0 ? `vencido há ${Math.abs(dias)} dia(s)` : `${dias} dia(s) para vencer`;
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <p className="text-[13px] font-medium text-muted-foreground">Olá, {membroAtual?.nome?.split(" ")[0]} 👋</p>
        <h2 className="text-[22px] font-extrabold tracking-tight">{grupoAtual?.nome_recurso}</h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="grid grid-cols-2 gap-3"
      >
        <StatCard
          titulo="Sua posição"
          valor={posicaoRanking > 0 ? `#${posicaoRanking}` : "—"}
          sub={posicaoRanking > 0 ? `de ${ranking.length} cotistas` : "sem reservas"}
          icon={<Trophy size={18} />}
          destaque
        />
        <StatCard
          titulo="Sua reserva"
          valor={minhaProximaReserva ? formatarDataBR(minhaProximaReserva.data) : "—"}
          sub={
            minhaProximaReserva
              ? `${minhaProximaReserva.periodo === "M" ? "Manhã" : "Tarde"} · próxima reserva`
              : "Sem reserva agendada"
          }
          icon={<CalendarCheck2 size={18} />}
        />
        <Link to="/calendario">
          <StatCard titulo="Este mês" valor={String(reservasEsteMes)} sub="reservas no calendário" icon={<CalendarDays size={18} />} onClick={() => {}} />
        </Link>
        <Link to="/seguro">
          <StatCard titulo="Seguro" valor={seguroValor} sub={seguroSub} icon={<ShieldCheck size={18} />} onClick={() => {}} />
        </Link>
      </motion.div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[15px] font-bold">
            <Trophy size={17} className="text-royal" /> Ranking de prioridade
          </h3>
          <span className="flex items-center gap-1 text-[12px] font-semibold text-muted-foreground">
            <Users2 size={14} /> {cotistasAtivos} ativos
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {ranking.map((linha, i) => (
            <div
              key={linha.membroId}
              className={`flex items-center gap-3 rounded-2xl p-2.5 ${
                linha.membroId === membroAtual?.id ? "bg-accent" : ""
              }`}
            >
              <span className="w-5 shrink-0 text-center text-[13px] font-bold text-muted-foreground">{i + 1}</span>
              <Avatar nome={linha.nome} size="sm" destaque={linha.membroId === membroAtual?.id} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold">{linha.nome}</p>
                <p className="text-[11px] text-muted-foreground">
                  {linha.cotas} cota{linha.cotas !== 1 ? "s" : ""} · {linha.utilizados} usados · {linha.agendados} agendados
                </p>
              </div>
              <span className="text-[15px] font-extrabold text-royal">{linha.total}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11.5px] leading-relaxed text-muted-foreground">
          Menor pontuação = maior prioridade para reservar fins de semana e feriados,
          ponderado pelo número de cotas.
        </p>
      </Card>

      <Card>
        <h3 className="mb-4 text-[15px] font-bold">📅 Próximos fins de semana e feriados</h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {proximosDias.map((d) => (
            <Link
              to="/calendario"
              key={d.data}
              className="rounded-2xl border border-border/60 p-3 text-[12px] transition-colors hover:border-royal/40 hover:bg-accent/40"
            >
              <p className="font-bold">{formatarDataBR(d.data)}</p>
              <p className="mb-1.5 truncate text-muted-foreground">{d.descricao || "—"}</p>
              <div className="flex gap-1">
                {d.manhaLivre && (
                  <span className="rounded-full bg-success-soft px-1.5 py-0.5 text-[10px] font-bold text-success">
                    M livre
                  </span>
                )}
                {d.tardeLivre && (
                  <span className="rounded-full bg-success-soft px-1.5 py-0.5 text-[10px] font-bold text-success">
                    T livre
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
