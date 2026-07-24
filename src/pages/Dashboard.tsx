import { useMemo } from "react";
import { Link } from "react-router-dom";
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
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          titulo="Sua posição"
          valor={posicaoRanking > 0 ? `#${posicaoRanking}` : "—"}
          sub={posicaoRanking > 0 ? `de ${ranking.length} cotistas` : "sem reservas"}
        />
        <Kpi
          titulo="Sua reserva"
          valor={minhaProximaReserva ? formatarDataBR(minhaProximaReserva.data) : "—"}
          sub={
            minhaProximaReserva
              ? `${minhaProximaReserva.periodo === "M" ? "Manhã" : "Tarde"} · sua próxima reserva`
              : "Você não tem uma reserva"
          }
        />
        <Kpi titulo="Calendário" valor={String(reservasEsteMes)} sub="reservas este mês" />
        <Kpi titulo="Cotistas" valor={String(cotistasAtivos)} sub="ativos" />
        <Link to="/seguro">
          <Kpi titulo="Seguro" valor={seguroValor} sub={seguroSub} />
        </Link>
      </div>

      <Card>
        <CardContent className="pt-5">
          <h2 className="mb-3 text-sm font-bold">🏆 Ranking de Prioridade</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-muted-foreground">
                  <th className="pb-2">#</th>
                  <th className="pb-2">Cotista</th>
                  <th className="pb-2">{grupoAtual?.termo_cota}s</th>
                  <th className="pb-2">Usados</th>
                  <th className="pb-2">Agendados</th>
                  <th className="pb-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((linha, i) => (
                  <tr
                    key={linha.membroId}
                    className={linha.membroId === membroAtual?.id ? "bg-blue-50" : ""}
                  >
                    <td className="py-1.5">{i + 1}</td>
                    <td className="py-1.5">
                      {linha.nome}
                      {linha.membroId === membroAtual?.id && (
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          Você
                        </span>
                      )}
                    </td>
                    <td className="py-1.5">{linha.cotas}</td>
                    <td className="py-1.5">{linha.utilizados}</td>
                    <td className="py-1.5">{linha.agendados}</td>
                    <td className="py-1.5 font-bold">{linha.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            🏆 Menor pontuação = maior prioridade para reservar fins de semana e feriados. A
            pontuação considera o número de {grupoAtual?.termo_cota}s.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <h2 className="mb-3 text-sm font-bold">📅 Próximos finais de semana / feriados</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {proximosDias.map((d) => (
              <Link
                to="/calendario"
                key={d.data}
                className="rounded-lg border p-2 text-xs hover:border-primary"
              >
                <p className="font-bold">{formatarDataBR(d.data)}</p>
                <p className="mb-1 text-muted-foreground">{d.descricao}</p>
                <p>M: {d.reservaManha ? "ocupado" : "livre"}</p>
                <p>T: {d.reservaTarde ? "ocupado" : "livre"}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ titulo, valor, sub }: { titulo: string; valor: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {titulo}
        </p>
        <p className="text-2xl font-extrabold text-primary">{valor}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
