import type { Database } from "@/types/database.types";

type Reserva = Database["public"]["Tables"]["reservas"]["Row"];
type Membro = Database["public"]["Tables"]["grupo_membros"]["Row"];
type Feriado = Database["public"]["Tables"]["feriados"]["Row"];

/** Sábado, domingo ou feriado cadastrado conta para a escala de prioridade. */
export function contaParaEscala(dataISO: string, feriadosSet: Set<string>): boolean {
  const dow = new Date(dataISO + "T12:00:00").getDay();
  return dow === 0 || dow === 6 || feriadosSet.has(dataISO);
}

export function construirSetFeriados(feriados: Feriado[]): Set<string> {
  return new Set(feriados.map((f) => f.data));
}

export interface LinhaRanking {
  membroId: string;
  nome: string;
  cotas: number;
  utilizados: number;
  agendados: number;
  total: number;
  totalGeral: number;
  pontuacao: number;
}

/**
 * pontuacao = total_contavel / cotas -- ordenado ascendente (menor pontuação
 * = maior prioridade). Ver seção 7.2 da especificação técnica.
 */
export function calcularRanking(
  membros: Membro[],
  reservas: Reserva[],
  feriadosSet: Set<string>
): LinhaRanking[] {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const linhas: LinhaRanking[] = [];

  for (const membro of membros) {
    if (!membro.ativo) continue;
    let utilizados = 0;
    let agendados = 0;
    let totalGeral = 0;

    for (const r of reservas) {
      if (r.membro_id !== membro.id || r.status === "cancelado") continue;
      totalGeral++;
      if (contaParaEscala(r.data, feriadosSet)) {
        const dataReserva = new Date(r.data + "T12:00:00");
        if (dataReserva < hoje) utilizados++;
        else agendados++;
      }
    }

    const total = utilizados + agendados;
    const cotas = membro.cotas || 1;

    linhas.push({
      membroId: membro.id,
      nome: membro.nome,
      cotas,
      utilizados,
      agendados,
      total,
      totalGeral,
      pontuacao: total / cotas,
    });
  }

  linhas.sort((a, b) => a.pontuacao - b.pontuacao);
  return linhas;
}

export interface ProximoDia {
  data: string;
  descricao: string;
  reservaManha: Reserva | null;
  reservaTarde: Reserva | null;
}

/** Próximos dias (até 60) que contam para a escala, com no máximo 10 resultados. */
export function calcularProximosDias(
  reservas: Reserva[],
  feriados: Feriado[],
  feriadosSet: Set<string>,
  maxResultados = 10
): ProximoDia[] {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const resultado: ProximoDia[] = [];

  for (let offset = 0; offset <= 60 && resultado.length < maxResultados; offset++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + offset);
    const dataISO = formatarDataISO(d);

    if (!contaParaEscala(dataISO, feriadosSet)) continue;

    const reservaManha =
      reservas.find((r) => r.data === dataISO && r.periodo === "M" && r.status !== "cancelado") ??
      null;
    const reservaTarde =
      reservas.find((r) => r.data === dataISO && r.periodo === "T" && r.status !== "cancelado") ??
      null;

    // Dia sem nenhum turno livre não é útil pra esta lista — pula sem contar
    // como um dos "maxResultados" (continua procurando o próximo dia com vaga).
    if (reservaManha && reservaTarde) continue;

    let descricao = "";
    const dow = d.getDay();
    if (dow === 0) descricao = "Domingo";
    else if (dow === 6) descricao = "Sábado";
    const feriado = feriados.find((f) => f.data === dataISO);
    if (feriado) descricao = feriado.descricao;

    resultado.push({ data: dataISO, descricao, reservaManha, reservaTarde });
  }

  return resultado;
}

export function formatarDataISO(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? "0" + m : m}-${day < 10 ? "0" + day : day}`;
}

export function formatarDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}
