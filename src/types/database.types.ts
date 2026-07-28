// Tipos do banco de dados. Este arquivo pode ser regenerado automaticamente
// mais tarde com:
//   npx supabase gen types typescript --project-id SEU_PROJECT_ID > src/types/database.types.ts
// Por enquanto, foi escrito à mão espelhando exatamente o schema SQL
// (supabase/migrations/0001_schema_inicial.sql), para já termos autocomplete
// e checagem de tipos em todo o app desde o início.

export type Papel = "admin" | "gestor" | "cotista";
export type TipoLancamento = "receita" | "despesa";
export type StatusReserva = "confirmado" | "cancelado";
export type Periodo = "M" | "T";
export type OrigemLancamento =
  | "manual"
  | "caixa_inicial"
  | "ajuste_caixa"
  | "recorrente"
  | "manutencao_horas"
  | "seguro";
export type TipoGatilhoManutencao = "data" | "horas";
export type PrioridadeDiario = "normal" | "atencao" | "urgente";
export type CategoriaInformacao =
  | "Contato"
  | "Documento"
  | "Senha_Acesso"
  | "Procedimento"
  | "Outro";

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      grupos: {
        Row: {
          id: string;
          nome: string;
          nome_recurso: string;
          termo_cota: string;
          dia_virada: number;
          moeda: string;
          timezone: string;
          logo_url: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          nome_recurso?: string;
          termo_cota?: string;
          dia_virada?: number;
          moeda?: string;
          timezone?: string;
          logo_url?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["grupos"]["Insert"]>;
        Relationships: [];
      };
      grupo_membros: {
        Row: {
          id: string;
          grupo_id: string;
          user_id: string | null;
          nome: string;
          email: string;
          telefone: string | null;
          role: Papel;
          cotas: number;
          ativo: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          grupo_id: string;
          user_id?: string | null;
          nome: string;
          email: string;
          telefone?: string | null;
          role?: Papel;
          cotas?: number;
          ativo?: boolean;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["grupo_membros"]["Insert"]>;
        Relationships: [];
      };
      feriados: {
        Row: { id: string; grupo_id: string; data: string; descricao: string };
        Insert: { id?: string; grupo_id: string; data: string; descricao: string };
        Update: Partial<Database["public"]["Tables"]["feriados"]["Insert"]>;
        Relationships: [];
      };
      reservas: {
        Row: {
          id: string;
          grupo_id: string;
          membro_id: string;
          data: string;
          periodo: Periodo;
          status: StatusReserva;
          criado_em: string;
        };
        Insert: {
          id?: string;
          grupo_id: string;
          membro_id: string;
          data: string;
          periodo: Periodo;
          status?: StatusReserva;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reservas"]["Insert"]>;
        Relationships: [];
      };
      recorrentes: {
        Row: {
          id: string;
          grupo_id: string;
          tipo: TipoLancamento;
          descricao: string;
          valor_atual: number;
          dia_cobranca: number;
          ativo: boolean;
          data_inicio: string | null;
          data_fim: string | null;
          subtipo: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          grupo_id: string;
          tipo: TipoLancamento;
          descricao: string;
          valor_atual: number;
          dia_cobranca: number;
          ativo?: boolean;
          data_inicio?: string | null;
          data_fim?: string | null;
          subtipo?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recorrentes"]["Insert"]>;
        Relationships: [];
      };
      recorrentes_historico: {
        Row: {
          id: string;
          recorrente_id: string;
          valor_anterior: number;
          valor_novo: number;
          alterado_por: string | null;
          vigencia_inicio: string;
          vigencia_fim: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          recorrente_id: string;
          valor_anterior: number;
          valor_novo: number;
          alterado_por?: string | null;
          vigencia_inicio: string;
          vigencia_fim?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recorrentes_historico"]["Insert"]>;
        Relationships: [];
      };
      lancamentos: {
        Row: {
          id: string;
          grupo_id: string;
          tipo: TipoLancamento;
          descricao: string;
          valor: number;
          valor_por_cota: number | null;
          data: string;
          lancado_por: string | null;
          origem: OrigemLancamento;
          origem_ref_id: string | null;
          observacao: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          grupo_id: string;
          tipo: TipoLancamento;
          descricao: string;
          valor: number;
          valor_por_cota?: number | null;
          data: string;
          lancado_por?: string | null;
          origem?: OrigemLancamento;
          origem_ref_id?: string | null;
          observacao?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lancamentos"]["Insert"]>;
        Relationships: [];
      };
      confirmacoes_pagamento: {
        Row: {
          id: string;
          recorrente_id: string;
          membro_id: string;
          mes_referencia: string;
          confirmado: boolean;
          data_confirmacao: string | null;
          confirmado_por: string | null;
        };
        Insert: {
          id?: string;
          recorrente_id: string;
          membro_id: string;
          mes_referencia: string;
          confirmado?: boolean;
          data_confirmacao?: string | null;
          confirmado_por?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["confirmacoes_pagamento"]["Insert"]>;
        Relationships: [];
      };
      historico_custo_combustivel: {
        Row: {
          id: string;
          grupo_id: string;
          consumo_por_hora: number;
          custo_unidade: number;
          unidades: number;
          custo_por_hora: number;
          vigencia_inicio: string;
          vigencia_fim: string | null;
          alterado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          grupo_id: string;
          consumo_por_hora: number;
          custo_unidade: number;
          unidades: number;
          vigencia_inicio: string;
          vigencia_fim?: string | null;
          alterado_por?: string | null;
          criado_em?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["historico_custo_combustivel"]["Insert"]
        >;
        Relationships: [];
      };
      historico_custo_oleo: {
        Row: {
          id: string;
          grupo_id: string;
          custo_galao: number;
          data_inicio: string;
          data_fim: string | null;
          alterado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          grupo_id: string;
          custo_galao: number;
          data_inicio?: string;
          data_fim?: string | null;
          alterado_por?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["historico_custo_oleo"]["Insert"]>;
        Relationships: [];
      };
      ajustes_horimetro: {
        Row: {
          id: string;
          grupo_id: string;
          data: string;
          delta: number;
          motivo: string | null;
          criado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          grupo_id: string;
          data?: string;
          delta: number;
          motivo?: string | null;
          criado_por?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ajustes_horimetro"]["Insert"]>;
        Relationships: [];
      };
      avisos_embarcacao: {
        Row: {
          id: string;
          grupo_id: string;
          mensagem: string;
          criado_por: string | null;
          criado_em: string;
          resolvido: boolean;
          resolvido_por: string | null;
          resolvido_em: string | null;
        };
        Insert: {
          id?: string;
          grupo_id: string;
          mensagem: string;
          criado_por?: string | null;
          criado_em?: string;
          resolvido?: boolean;
          resolvido_por?: string | null;
          resolvido_em?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["avisos_embarcacao"]["Insert"]>;
        Relationships: [];
      };
      diario_bordo: {
        Row: {
          id: string;
          grupo_id: string;
          autor_id: string;
          titulo: string;
          relato: string;
          prioridade: PrioridadeDiario;
          resolvido: boolean;
          data_resolucao: string | null;
          resolvido_por: string | null;
          horimetro_inicio: number;
          horimetro_fim: number;
          tempo_uso: number;
          diferenca_anterior: number | null;
          observacoes: string | null;
          data_uso_reportado: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          grupo_id: string;
          autor_id: string;
          titulo: string;
          relato: string;
          prioridade?: PrioridadeDiario;
          resolvido?: boolean;
          data_resolucao?: string | null;
          resolvido_por?: string | null;
          horimetro_inicio?: number;
          horimetro_fim?: number;
          diferenca_anterior?: number | null;
          observacoes?: string | null;
          data_uso_reportado?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["diario_bordo"]["Insert"]>;
        Relationships: [];
      };
      manutencoes: {
        Row: {
          id: string;
          grupo_id: string;
          descricao: string;
          periodicidade: string | null;
          tipo_gatilho: TipoGatilhoManutencao;
          proxima_data: string | null;
          intervalo_horas: number | null;
          horimetro_base: number;
          data_inicio_ciclo: string;
          custo_previsto: number | null;
          custo_real: number | null;
          feito: boolean;
          data_execucao: string | null;
          feito_por: string | null;
          observacao: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          grupo_id: string;
          descricao: string;
          periodicidade?: string | null;
          tipo_gatilho?: TipoGatilhoManutencao;
          proxima_data?: string | null;
          intervalo_horas?: number | null;
          horimetro_base?: number;
          data_inicio_ciclo?: string;
          custo_previsto?: number | null;
          custo_real?: number | null;
          feito?: boolean;
          data_execucao?: string | null;
          feito_por?: string | null;
          observacao?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["manutencoes"]["Insert"]>;
        Relationships: [];
      };
      rateio_manutencao: {
        Row: {
          id: string;
          manutencao_id: string;
          descricao: string;
          membro_id: string;
          horas: number;
          valor: number;
          data: string;
          confirmado: boolean;
          data_confirmacao: string | null;
        };
        Insert: {
          id?: string;
          manutencao_id: string;
          descricao: string;
          membro_id: string;
          horas?: number;
          valor: number;
          data: string;
          confirmado?: boolean;
          data_confirmacao?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["rateio_manutencao"]["Insert"]>;
        Relationships: [];
      };
      seguros: {
        Row: {
          id: string;
          grupo_id: string;
          apolice: string;
          seguradora: string | null;
          data_inicio: string;
          valor: number;
          data_vencimento: string;
          renovado_por: string | null;
          observacao: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          grupo_id: string;
          apolice: string;
          seguradora?: string | null;
          data_inicio: string;
          valor?: number;
          data_vencimento: string;
          renovado_por?: string | null;
          observacao?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["seguros"]["Insert"]>;
        Relationships: [];
      };
      informacoes_uteis: {
        Row: {
          id: string;
          grupo_id: string;
          categoria: CategoriaInformacao;
          rotulo: string;
          valor: string;
          observacao: string | null;
          autor_id: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          grupo_id: string;
          categoria: CategoriaInformacao;
          rotulo: string;
          valor: string;
          observacao?: string | null;
          autor_id?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["informacoes_uteis"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      total_cotas_ativas: {
        Args: { p_grupo_id: string };
        Returns: number;
      };
      saldo_atual: {
        Args: { p_grupo_id: string };
        Returns: number;
      };
      reserva_acumulada_ate: {
        Args: { p_grupo_id: string; p_data: string };
        Returns: number;
      };
      custo_fixo_mes: {
        Args: { p_grupo_id: string; p_mes_ref: string };
        Returns: number;
      };
      reserva_emergencia_mes: {
        Args: { p_grupo_id: string; p_mes_ref: string };
        Returns: number;
      };
      mensalidade_membro: {
        Args: { p_membro_id: string; p_mes_ref?: string };
        Returns: MensalidadeMembro;
      };
      mensalidades_todos: {
        Args: { p_grupo_id: string };
        Returns: {
          membro_id: string;
          nome: string;
          cotas: number;
          custo_fixo_mes: number;
          custo_variavel_mes: number;
          reserva_emergencia_mes: number;
          total_mes_atual: number;
          custo_fixo_proximo_mes: number;
          reserva_emergencia_proximo_mes: number;
          total_proximo_mes: number;
        }[];
      };
      criar_lancamento: {
        Args: {
          p_grupo_id: string;
          p_tipo: TipoLancamento;
          p_descricao: string;
          p_valor: number;
          p_data: string;
          p_observacao?: string | null;
        };
        Returns: Database["public"]["Tables"]["lancamentos"]["Row"];
      };
      alterar_valor_recorrente: {
        Args: { p_recorrente_id: string; p_novo_valor: number };
        Returns: void;
      };
      ultimo_horimetro: {
        Args: { p_grupo_id: string };
        Returns: number;
      };
      criar_registro_diario: {
        Args: {
          p_grupo_id: string;
          p_titulo: string;
          p_relato: string;
          p_prioridade?: PrioridadeDiario;
          p_horimetro_inicio?: number | null;
          p_horimetro_fim?: number;
          p_observacoes?: string | null;
          p_uso_rotina?: boolean;
          p_data_uso?: string | null;
        };
        Returns: Database["public"]["Tables"]["diario_bordo"]["Row"];
      };
      relatorios_pendentes_membro: {
        Args: { p_membro_id: string };
        Returns: { reserva_id: string; data: string; periodo: string }[];
      };
      relatorios_pendentes_todos: {
        Args: { p_grupo_id: string };
        Returns: { membro_id: string; nome: string; pendentes: number }[];
      };
      definir_custo_combustivel: {
        Args: {
          p_grupo_id: string;
          p_consumo_por_hora: number;
          p_custo_unidade: number;
          p_unidades: number;
          p_data_inicio?: string;
        };
        Returns: Database["public"]["Tables"]["historico_custo_combustivel"]["Row"];
      };
      editar_custo_combustivel_atual: {
        Args: {
          p_id: string;
          p_consumo_por_hora: number;
          p_custo_unidade: number;
          p_unidades: number;
          p_data_inicio: string;
        };
        Returns: void;
      };
      definir_custo_oleo: {
        Args: { p_grupo_id: string; p_custo_galao: number; p_data_inicio?: string };
        Returns: Database["public"]["Tables"]["historico_custo_oleo"]["Row"];
      };
      registrar_troca_horimetro: {
        Args: {
          p_grupo_id: string;
          p_horas_reais_ate_troca: number;
          p_leitura_aparelho_novo: number;
          p_motivo?: string | null;
          p_data?: string;
        };
        Returns: Database["public"]["Tables"]["ajustes_horimetro"]["Row"];
      };
      master_editar_nome_grupo: {
        Args: { p_grupo_id: string; p_nome: string };
        Returns: Database["public"]["Tables"]["grupos"]["Row"];
      };
      editar_custo_oleo_atual: {
        Args: { p_id: string; p_custo_galao: number; p_data_inicio: string };
        Returns: void;
      };
      fechar_custo_oleo: {
        Args: { p_id: string; p_data_fim: string };
        Returns: void;
      };
      resumo_custo_oleo: {
        Args: { p_grupo_id: string };
        Returns: {
          id: string;
          custo_galao: number;
          data_inicio: string;
          data_fim: string | null;
          horas_consumidas: number;
          custo_por_hora: number | null;
        }[];
      };
      concluir_manutencao: {
        Args: {
          p_manutencao_id: string;
          p_data_fechamento: string;
          p_custo_real?: number | null;
          p_reagendar_dias?: number | null;
        };
        Returns: void;
      };
      horas_membro_periodo: {
        Args: { p_membro_id: string; p_data_inicio: string; p_data_fim?: string | null };
        Returns: number;
      };
      horas_grupo_periodo: {
        Args: { p_grupo_id: string; p_data_inicio: string; p_data_fim?: string | null };
        Returns: number;
      };
      horas_por_membro_periodo: {
        Args: { p_grupo_id: string; p_data_inicio: string; p_data_fim?: string | null };
        Returns: { membro_id: string; horas: number }[];
      };
      projecao_manutencao_horas: {
        Args: { p_grupo_id: string };
        Returns: {
          manutencao_id: string;
          descricao: string;
          proxima_data: string | null;
          data_inicio_ciclo: string;
          intervalo_horas: number;
          horas_usadas: number;
          horas_restantes: number;
          custo_previsto: number;
          membro_id: string;
          membro_nome: string;
          horas: number;
          valor_estimado: number;
        }[];
      };
      renovar_seguro: {
        Args: {
          p_grupo_id: string;
          p_apolice: string;
          p_seguradora: string | null;
          p_data_inicio: string;
          p_valor: number;
          p_data_vencimento: string;
          p_lancar_despesa: boolean;
          p_observacao?: string | null;
        };
        Returns: Database["public"]["Tables"]["seguros"]["Row"];
      };
      painel_gestor: {
        Args: { p_grupo_id: string; p_mes_ref: string; p_ano_ref: number };
        Returns: PainelGestor;
      };
      criar_grupo: {
        Args: {
          p_nome: string;
          p_nome_recurso: string;
          p_dia_virada: number;
          p_admin_nome: string;
          p_admin_email: string;
        };
        Returns: Database["public"]["Tables"]["grupos"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export interface ItemFinanceiroDetalhe {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  isAuto: boolean;
  previsto: boolean;
  observacao: string;
}

export interface PainelGestor {
  mesRef: string;
  anoRef: number;
  porUsuario: {
    membroId: string;
    nome: string;
    ativo: boolean;
    diasUteisMes: number;
    diasTodosMes: number;
    diasUteisAno: number;
    diasTodosAno: number;
    horasMes: number;
    horasAno: number;
    custoOleoMes: number;
  }[];
  totais: {
    diasUteisMes: number;
    diasTodosMes: number;
    diasUteisAno: number;
    diasTodosAno: number;
    horasMes: number;
    horasAno: number;
  };
  financeiro: {
    custoFixoMes: number;
    custoVariavelMes: number;
    despesaTotalMes: number;
    reservaEmergencia: number;
    receitasDetalhe: ItemFinanceiroDetalhe[];
    despesasDetalhe: ItemFinanceiroDetalhe[];
  };
  seguro: {
    apolice: string;
    seguradora: string | null;
    dataInicio: string;
    dataVencimento: string;
    valor: number;
    diasParaVencer: number;
  } | null;
  proximaManutencao: {
    descricao: string;
    periodicidade: string | null;
    proximaData: string | null;
    horimetroAtual: number | null;
    horasRestantes: number | null;
    diasParaVencer: number | null;
    custoPrevisto: number;
  } | null;
  custosVariaveis: {
    custoOleoPorHora: number;
    custoOleoTotalMes: number;
    manutencoesHoras: {
      descricao: string;
      proximaData: string | null;
      intervaloHoras: number | null;
      dataInicioCiclo: string;
      horasUsadas: number;
      horasRestantes: number;
      custoPrevisto: number;
    }[];
    rateiosPendentes: number;
  };
  relatoriosPendentesTodos: { membroId: string; nome: string; pendentes: number }[];
}

export interface MensalidadeMembro {
  cotas: number;
  mesAtual: {
    mesRef: string;
    custoFixo: number;
    custoVariavel: number;
    reservaEmergencia: number;
    cobertoPelaReserva: number;
    totalAPagar: number;
  };
  proximoMes: {
    mesRef: string;
    custoFixo: number;
    custoVariavel: number;
    reservaEmergencia: number;
    totalAPagar: number;
  };
}
