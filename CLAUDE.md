# CLAUDE.md — sistema-cotistas

Referência técnica densa do projeto, mantida para reduzir a necessidade de reler o código-fonte inteiro a cada sessão. Escrita para ser *grepada*, não lida como prosa.

## Protocolo obrigatório

1. **Antes de alterar qualquer coisa**: leia a seção relevante deste arquivo primeiro (Glossário, Mapa de páginas, Hooks → backend, Schema do banco, Particularidades conhecidas). Só abra os arquivos-fonte reais depois, e só os que essa leitura apontar como necessários.
2. **Depois de terminar uma alteração**: atualize a seção correspondente deste arquivo (novo hook, nova tabela, nova página, nova migração, comportamento mudou, quirk resolvido) e adicione uma linha no **Changelog** no fim do arquivo. Se a mudança tocou o banco, registre o número da migração aqui também.
3. Nunca leia nem confie nos arquivos soltos na raiz do repositório fora de `src/` e `supabase/` — ver "Lixo na raiz do repo" abaixo.
4. Se este arquivo e o código discordarem, o código (e o banco via MCP do Supabase) manda — corrija este arquivo, não o contrário.

## Visão geral

Sistema de gestão para grupos de cotistas de embarcação compartilhada ("Jolly Roger" é o grupo principal). Cada **grupo** (`grupos`) é um barco com seus **cotistas** (`grupo_membros`), reservas, orçamento, diário de bordo, manutenções e seguro. Multi-tenant: tudo é particionado por `grupo_id`, com RLS no Postgres como camada real de segurança (não o frontend).

Reescrita web de um sistema antigo em Google Apps Script (ver `README.md` na raiz para o changelog histórico voltado ao cliente/dono do produto — este arquivo aqui é a referência técnica para IA).

**Stack**: React 19 + TypeScript + Vite 5 + Tailwind CSS 3 + TanStack React Query v5 + react-router-dom v7 + Framer Motion + react-hook-form + zod + Supabase (Postgres + Auth + RLS) + PWA (vite-plugin-pwa), deploy na Vercel.

**Comandos**: `npm run dev` (vite, porta 5173) · `npm run build` (`tsc -b && vite build`) · `npm run lint` (oxlint) · `npm run preview`.

**Supabase**: projeto `oniaznwsevpkvvspitie` (nome "jolly-roger"), região us-west-2. O schema completo do banco vive em **`supabase/schema.sql`** — um arquivo único (não uma sequência de migrações), gerado por introspecção direta do banco. Veja "Schema do banco" e o cabeçalho do próprio arquivo para o fluxo de trabalho.

**PWA**: nome "Gestão de Cotistas", short_name "Cotistas", theme `#0d47a1`, display standalone, service worker com autoUpdate. Ícones em `icons/`.

## Glossário de domínio (PT)

| Termo | Significado |
|---|---|
| cotista | Co-proprietário do barco; linha em `grupo_membros` |
| cota | Fração de propriedade (`grupo_membros.cotas`, numeric); custos são rateados proporcionalmente |
| grupo | O barco + seus cotistas (tabela `grupos`); `nome_recurso` = como a embarcação é chamada na UI (default "Embarcação") |
| role | `admin` \| `gestor` \| `cotista` em `grupo_membros.role` — ver seção Permissões |
| master | Um único e-mail hardcoded (`MASTER_EMAIL`) com poder cross-grupo; não é um `role` |
| diário de bordo | Log de uso/ocorrências do barco (`diario_bordo`) — cada entrada pode registrar horímetro início/fim de um uso |
| horímetro | Contador de horas do motor (como um odômetro). Ver seção dedicada abaixo — teve bug de sincronia corrigido na migração 0022 |
| rateio | Divisão de um custo entre cotistas (por cota ou por horas de uso) |
| lançamento | Entrada financeira manual (`lancamentos`): receita ou despesa |
| recorrente | Cobrança/receita que se repete todo mês (`recorrentes`, ex: mensalidade fixa) |
| mensalidade | Valor que cada cotista deve pagar no mês, calculado por `mensalidade_membro()` (custo fixo rateado + variável + reserva) |
| custo variável | Combustível + óleo, cobrados com 1 mês de atraso proporcional às horas de uso |
| reserva de emergência | Fatia da mensalidade guardada para imprevistos (`reserva_emergencia_mes`) |
| escala / conta para escala | Dias que "contam" para o ranking de prioridade de reserva (fins de semana + feriados, ver `contaParaEscala`) |
| apólice | Seguro obrigatório do barco (`seguros`) |
| aviso | Alerta/comunicado do grupo, banner destrutivo enquanto ativo (`avisos_embarcacao`) |
| óleo | Custo de troca de óleo por hora de uso, ciclo por galão (`historico_custo_oleo`) |
| manutenção | Item de manutenção agendado por data OU por horímetro (`manutencoes.tipo_gatilho`) |
| convite pendente | `grupo_membros` criado com `user_id = null`; vinculado à conta real no login via trigger (ver Autenticação) |

## Arquitetura & fluxo de dados

```
página (src/pages/*.tsx)
  → hook React Query (src/lib/queries/*.ts)
    → supabase-js: select/insert/update/delete direto NA TABELA, ou .rpc(nome_funcao)
      → Postgres: tabela com RLS, ou função SECURITY [DEFINER|INVOKER] (supabase/schema.sql)
```

- Regra geral: leituras simples e CRUD trivial vão direto na tabela (RLS decide quem pode); qualquer coisa com lógica de negócio (cálculo, validação entre linhas, side-effects) vira uma função RPC no Postgres. **Não duplique lógica de negócio no frontend** — se uma conta/validação já existe como função no banco, chame-a via `.rpc()`.
- Estado global: só `AuthContext` (sessão/grupo atual/permissões) e `ToastContext` (toasts). Tudo mais é cache do React Query, chave por `grupoAtual.id` (ou `membroAtual.id` quando é dado pessoal).
- Pastas reais:
  - `src/pages/*.tsx` — uma tela por rota (ver Mapa de páginas)
  - `src/lib/queries/*.ts` — hooks React Query, um arquivo por domínio
  - `src/lib/{utils,formato,ranking,supabase,constants,linkUtils}.ts` — helpers puros (ver abaixo)
  - `src/contexts/{AuthContext,ToastContext}.tsx`
  - `src/components/AppLayout.tsx` — shell: header, bottom nav, menu "Mais", modal de troca de senha, banner de avisos ativos
  - `src/components/ui/*` — kit de componentes (ver lista abaixo)
  - `src/types/database.types.ts` — tipos gerados do schema Supabase (regenerar com a tool MCP `generate_typescript_types` depois de qualquer mudança de schema)
  - `supabase/schema.sql` — schema completo do banco, arquivo único (ver "Schema do banco")

**Kit de UI** (`src/components/ui/`): `avatar, badge (variants: success/error/warning/info/neutral), bottom-navigation, button, card (Card/CardHeader/CardTitle/CardDescription/CardContent, variant "destaque" = gradiente), empty-state, fab, header, horimetro-gauge (HorimetroGauge — mostrador circular estilo instrumento físico, usado no Diário), input (aceita prop icon), label, list-item, loading-skeleton, modal (bottom-sheet), segmented-control, stat-card`. Convenção em todo CRUD: `useState` de formulário local + `Modal` + `useToast().sucesso/erro()`.

## Autenticação e permissões

`AuthContext` expõe: `carregando`, `membresiasCarregadas`, `emRecuperacaoSenha`, `session`, `membresias` (linhas de `grupo_membros` com `grupo` embutido), `grupoAtual` (persistido em `localStorage["grupoIdSelecionado"]`), `membroAtual`, `selecionarGrupo()`, `podeGerenciarOrcamento`, `ehAdmin`, `ehMaster`, `recarregarMembresias()`, `atualizarSenha()`, `enviarLinkRedefinicaoSenha()`, `sair()`.

- `ehAdmin` = `membroAtual.role === "admin"`
- `podeGerenciarOrcamento` = `role === "admin" || role === "gestor"` (cotista comum não gerencia)
- `ehMaster` = `session.user.email === MASTER_EMAIL` (`src/lib/constants.ts`, hoje `victornogueirapinto@gmail.com`) — **não é role**, é comparação de e-mail; a garantia real é no banco (RLS + função `eh_master()`), a flag no frontend é só UX
- Essas flags do frontend são conveniência de UI — **a segurança de verdade é RLS no Postgres** (toda tabela tem `rls_enabled = true`; padrão: `SELECT` exige `eh_membro_ativo(grupo_id)`, `INSERT/UPDATE/DELETE` sensíveis exigem `eh_gestor_ou_admin(grupo_id)` ou `eh_admin(grupo_id)`)

**Fluxo de convite** (cotista ou admin de novo grupo): admin cria uma linha em `grupo_membros` com `user_id = null` e o e-mail da pessoa (= "convite pendente"). Quando essa pessoa cria conta (e-mail/senha ou Google OAuth) com o mesmo e-mail, um trigger vincula automaticamente:
- `auth.users` AFTER INSERT → `vincular_convite_pendente()` (convite existia antes da conta)
- `grupo_membros` BEFORE INSERT → `vincular_membro_a_conta_existente()` (conta já existia antes do convite)
- Bidirecional desde a migração `0021_vincular_convite_bidirecional.sql` (antes só funcionava numa direção — bug real já corrigido, não reabrir)

**Criar novo grupo**: só `MASTER_EMAIL` pode (migração `0008_grupo_apenas_master.sql`, reforçado no banco). Master roda `criar_grupo()` (RPC `SECURITY DEFINER`) informando nome do grupo + nome/e-mail do admin; esse admin recebe convite igual a um cotista normal.

**Limpeza ao trocar de usuário**: `limparEstadoDoUsuarioAnterior()` limpa estado React, remove `grupoIdSelecionado` do localStorage e chama `queryClient.clear()` quando detecta mudança de `user_id` no listener de auth.

## Mapa de páginas

| Rota | Arquivo | Resumo | Modais | Gating |
|---|---|---|---|---|
| `/` | `Dashboard.tsx` | Ranking de prioridade, próximos dias livres, atalhos | — | nenhum |
| `/calendario` | `Calendario.tsx` | Calendário mensal M/T, reservar/cancelar, FAB de reserva rápida | ModalNovaReserva, ModalDia | admin reserva/cancela por qualquer um; cotista só as próprias futuras |
| `/orcamento` | `Orcamento.tsx` | Hub financeiro: mensalidades, óleo, projeção de manutenção por horas, lançamentos, recorrentes, confirmações | 6 (lanc, recorr, valor recorr, óleo, encerrar óleo, excluir lanc) | `podeGerenciarOrcamento` nas seções de gestão; `ehAdmin` para criar/alterar recorrentes |
| `/manutencao` | `Manutencao.tsx` | Cards de manutenção, status por data OU horímetro (5 níveis), projeção por horas | ModalFormManutencao, modalConcluir, modalExcluir | `podeGerenciarOrcamento` |
| `/diario` | `Diario.tsx` | Diário de bordo + mostrador de horímetro + sincronização de aparelho | modalTroca (sincronizar horímetro) | `podeGerenciarOrcamento` na seção "Gerenciar horímetro" e ações de resolver/excluir |
| `/seguro` | `Seguro.tsx` | Apólice atual (status 5 níveis por vencimento), histórico de renovação | modalRenovar, modalExcluir | `podeGerenciarOrcamento` renova/edita; `ehAdmin` exclui |
| `/informacoes` | `Informacoes.tsx` | Contatos/documentos/senhas/procedimentos, preview embutido de Drive/YouTube | visualização (iframe), excluir | `ehAdmin` exclui |
| `/avisos` | `Avisos.tsx` | Avisos ativos (banner global via AppLayout) + histórico resolvido | novo aviso, excluir | `podeGerenciarOrcamento` |
| `/painel-gestor` | `PainelGestor.tsx` | Relatório mensal/anual (uso, financeiro, seguro, manutenção), imprimível A4 | — | checado no backend (RPC retorna erro se não for gestor/admin) |
| `/cotistas` | `Cotistas.tsx` | CRUD de cotistas, convite pendente | ModalCotista, excluir | rota só existe se `ehAdmin` (registrada condicionalmente em `App.tsx`) |
| `/feriados` | `Feriados.tsx` | CRUD de feriados (usados no cálculo de escala) | — | rota só existe se `ehAdmin` |
| `/administrador` | `Administrador.tsx` | Console cross-grupo: criar grupo, listar/renomear/excluir grupos, trocar admin, gerenciar membros (editar nome+email), reset de senha | renomear grupo, excluir grupo, trocar admin, excluir membro, editar membro | master only (rota + `useEffect` redirect) |
| `/criar-grupo` | `CriarGrupo.tsx` | Provisiona grupo novo + convite do admin dele via RPC `criar_grupo` | — | master only |
| `/aguardando-convite` | `AguardandoConvite.tsx` | Tela de espera para conta sem nenhum grupo | — | atalho "Ir para Administração" só se `ehMaster` |
| `/login` | `Login.tsx` | Login/cadastro/recuperação + Google OAuth | — | — |
| (sem rota) | `DefinirNovaSenha.tsx` | Renderizada por `App.tsx` no lugar de tudo quando `emRecuperacaoSenha` (veio de link de reset) | — | — |

**Lógica de rotas em `App.tsx`**: `carregando` ou `session && !membresiasCarregadas` → tela de loading; `emRecuperacaoSenha` → `DefinirNovaSenha` (bloqueia tudo); `/login` → redireciona se logado; `/criar-grupo` → master only; `/aguardando-convite` → só sem membresias; `/administrador` → master only; `/*` catch-all → sem sessão → login, sem membresias → `/aguardando-convite`, senão renderiza rotas internas (todas dentro de `<AppLayout>`).

## Hooks → backend (`src/lib/queries/*.ts`)

Todo hook lê `grupoAtual`/`membroAtual` de `useAuth()` e filtra por `grupo_id`. `rpc` = chama função Postgres; sem prefixo = select/insert/update/delete direto na tabela indicada. Total: **26 queries + 39 mutações = 65 hooks exportados** em 13 arquivos.

**useAdministrador.ts** (master):
- `useTodosGrupos()` → `SELECT * FROM grupos ORDER BY nome` · chave `["master-todos-grupos"]`
- `useMembrosDoGrupo(grupoId)` → `SELECT * FROM grupo_membros WHERE grupo_id = ...` · chave `["master-membros-grupo", grupoId]`
- `useEditarNomeGrupo()` → rpc `master_editar_nome_grupo` · invalida `["master-todos-grupos"]`
- `useExcluirGrupo()` → rpc `master_excluir_grupo` · invalida `["master-todos-grupos"]`
- `useTrocarAdmin()` → rpc `master_trocar_admin` · invalida `["master-membros-grupo", grupoId]`
- `useExcluirMembroMaster()` → rpc `master_excluir_membro` · invalida `["master-membros-grupo"]`
- `useEditarMembro()` → `UPDATE grupo_membros SET nome, email WHERE id = ...` (requer RLS policy `"master edita membros"`) · invalida `["master-membros-grupo"]`

**useAvisos.ts**:
- `useAvisosAtivos()` → `avisos_embarcacao WHERE grupo_id AND resolvido=false` · chave `["avisos-ativos", grupoId]`
- `useAvisos()` → `avisos_embarcacao WHERE grupo_id` · chave `["avisos", grupoId]`
- `useCriarAviso(mensagem)` → INSERT · invalida `["avisos-ativos"]` + `["avisos"]`
- `useResolverAviso(id)` → UPDATE `resolvido=true` · invalida `["avisos-ativos"]` + `["avisos"]`
- `useExcluirAviso(id)` → DELETE · invalida `["avisos-ativos"]` + `["avisos"]`

**useCombustivel.ts**:
- `useHistoricoCombustivel()` → `historico_custo_combustivel WHERE grupo_id` · chave `["historico-combustivel", grupoId]`
- `useDefinirCustoCombustivel()` → rpc `definir_custo_combustivel` · invalida `["historico-combustivel"]` + `["mensalidade-membro"]` + `["mensalidades-todos"]`
- `useEditarCustoCombustivelAtual()` → rpc `editar_custo_combustivel_atual` · invalida mesmas

**useDiario.ts**:
- `useDiario()` → `diario_bordo WHERE grupo_id` · chave `["diario", grupoId]`
- `useUltimoHorimetro()` → rpc `ultimo_horimetro` · chave `["ultimo-horimetro", grupoId]` (compartilhada com `useManutencoes.ts`)
- `useCriarRegistroDiario()` → rpc `criar_registro_diario` · invalida `["diario"]` + `["ultimo-horimetro"]` + `["relatorios-pendentes"]` + `["mensalidade-membro"]` + `["mensalidades-todos"]` + `["historico-combustivel"]` + `["resumo-oleo"]`
- `useResolverDiario()` → UPDATE `diario_bordo` · invalida `["diario"]`
- `useExcluirRegistroDiario()` → DELETE · invalida `["diario"]` + `["ultimo-horimetro"]`
- `useAjustesHorimetro()` → `ajustes_horimetro WHERE grupo_id` · chave `["ajustes-horimetro", grupoId]`
- `useRegistrarTrocaHorimetro()` → rpc `registrar_troca_horimetro` · invalida `["ajustes-horimetro"]` + `["ultimo-horimetro"]`
- `useRelatoriosPendentes(membroId)` → rpc `relatorios_pendentes_membro` · chave `["relatorios-pendentes", membroId]`
- `useRelatoriosPendentesTodos()` → rpc `relatorios_pendentes_todos` · chave `["relatorios-pendentes-todos", grupoId]`

**useFeriados.ts**:
- `useFeriados()` → `feriados WHERE grupo_id` · chave `["feriados", grupoId]`
- `useSalvarFeriado(data, descricao)` → INSERT · invalida `["feriados"]`
- `useExcluirFeriado(id)` → DELETE · invalida `["feriados"]`

**useInformacoes.ts**:
- `useInformacoes()` → `informacoes_uteis WHERE grupo_id` · chave `["informacoes", grupoId]`
- `useSalvarInformacao(categoria, rotulo, valor, observacao?)` → INSERT · invalida `["informacoes"]`
- `useExcluirInformacao(id)` → DELETE · invalida `["informacoes"]`

**useManutencoes.ts**:
- `useManutencoes()` → `manutencoes WHERE grupo_id` · chave `["manutencoes", grupoId]`
- `useUltimoHorimetroManutencao()` → rpc `ultimo_horimetro` · chave `["ultimo-horimetro", grupoId]` (mesma do Diário)
- `useSalvarManutencao()` → INSERT ou UPDATE `manutencoes` · invalida `["manutencoes"]` + `["projecao-manutencao-horas"]`
- `useExcluirManutencao()` → DELETE · invalida `["manutencoes"]` + `["projecao-manutencao-horas"]`
- `useConcluirManutencao()` → rpc `concluir_manutencao` · invalida `["manutencoes"]` + `["projecao-manutencao-horas"]` + `["rateio-manutencao"]` + `["saldo-atual"]` + `["lancamentos"]`
- `useProjecaoManutencaoHoras()` → rpc `projecao_manutencao_horas` · chave `["projecao-manutencao-horas", grupoId]`
- `useRateioManutencao()` → `rateio_manutencao` filtrado por IDs das manutenções · chave `["rateio-manutencao", grupoId]` (depende de `useManutencoes` carregado)
- `useConfirmarRateioManutencao()` → UPDATE `rateio_manutencao` · invalida `["rateio-manutencao"]` + `["mensalidade-membro"]`

**useMembros.ts**:
- `useMembros()` → `grupo_membros WHERE grupo_id AND excluido=false` · chave `["membros", grupoId]`
- `useSalvarMembro()` → INSERT ou UPDATE `grupo_membros` · invalida `["membros"]` + `["mensalidade-membro"]` + `["mensalidades-todos"]`
- `useExcluirMembro(membroId)` → rpc `excluir_membro` · invalida `["membros"]` + `["mensalidade-membro"]` + `["mensalidades-todos"]`

**useOleo.ts**:
- `useResumoOleo()` → rpc `resumo_custo_oleo` · chave `["resumo-oleo", grupoId]`
- `useDefinirCustoOleo()` → rpc `definir_custo_oleo` · invalida `["resumo-oleo"]` + `["mensalidade-membro"]` + `["mensalidades-todos"]` + `["saldo-atual"]` + `["lancamentos"]`
- `useEditarCustoOleoAtual()` → rpc `editar_custo_oleo_atual` · mesmas invalidações
- `useFecharCustoOleo()` → rpc `fechar_custo_oleo` · mesmas invalidações

**useOrcamento.ts** (maior arquivo, 13 hooks):
- `useLancamentos()` → `lancamentos WHERE grupo_id` · chave `["lancamentos", grupoId]`
- `useCriarLancamento()` → rpc `criar_lancamento` · invalida via `invalidarTudoOrcamento`
- `useEditarLancamento()` → rpc `editar_lancamento` · invalida via `invalidarTudoOrcamento`
- `useExcluirLancamento()` → DELETE `lancamentos` · invalida via `invalidarTudoOrcamento`
- `useRecorrentes()` → `recorrentes WHERE grupo_id` · chave `["recorrentes", grupoId]`
- `useCriarRecorrente()` → INSERT `recorrentes` (seta `subtipo=reserva_emergencia` se receita) · invalida via `invalidarTudoOrcamento`
- `useAlterarValorRecorrente()` → rpc `alterar_valor_recorrente` · invalida via `invalidarTudoOrcamento`
- `useAtivarRecorrente()` → UPDATE `recorrentes` · invalida via `invalidarTudoOrcamento`
- `useConfirmacoes()` → `confirmacoes_pagamento` filtrado por recorrentes · chave `["confirmacoes", grupoId]` (depende de `useRecorrentes` carregado)
- `useConfirmarPagamento()` → UPDATE `confirmacoes_pagamento` · invalida `["confirmacoes"]` + `["saldo-atual"]` + `["lancamentos"]` (NÃO usa `invalidarTudoOrcamento`)
- `useMensalidadeMembro(membroId)` → rpc `mensalidade_membro` · chave `["mensalidade-membro", membroId]`
- `useMensalidadesTodos()` → rpc `mensalidades_todos` · chave `["mensalidades-todos", grupoId]`
- `useSaldoAtual()` → rpc `saldo_atual` · chave `["saldo-atual", grupoId]`
- `useCustoFixoMes(mesRef)` → rpc `custo_fixo_mes` · chave `["custo-fixo-mes", grupoId, mesRef]`

**usePainelGestor.ts**: `usePainelGestor(mesRef, anoRef)` → rpc `painel_gestor` · chave `["painel-gestor", grupoId, mesRef, anoRef]`. Read-only, sem mutações.

**useReservas.ts**:
- `useReservas()` → `reservas WHERE grupo_id` · chave `["reservas", grupoId]`
- `useCriarReserva()` → INSERT `reservas` (trata erro `23505` como "turno já reservado") · invalida `["reservas"]`
- `useCancelarReserva()` → UPDATE `status='cancelado'` · invalida `["reservas"]`

**useSeguro.ts**:
- `useSeguros()` → `seguros WHERE grupo_id` · chave `["seguros", grupoId]`
- `useRenovarSeguro()` → rpc `renovar_seguro` · invalida `["seguros"]` + `["saldo-atual"]` + `["lancamentos"]`
- `useAtualizarSeguro()` → UPDATE `seguros` · invalida `["seguros"]` + `["lancamentos"]` + `["saldo-atual"]`
- `useExcluirSeguro()` → DELETE · invalida `["seguros"]` + `["lancamentos"]` + `["saldo-atual"]`

**Libs sem chamada ao Supabase**: `utils.ts` (`cn` = clsx+tailwind-merge) · `formato.ts` (`formatarMoeda`, `mesReferenciaAtual`) · `ranking.ts` (`contaParaEscala`, `construirSetFeriados`, `calcularRanking`, `calcularProximosDias`, `formatarDataISO`/`formatarDataBR` — toda a lógica de prioridade de reserva é client-side, puxando dados já buscados) · `supabase.ts` (client tipado, lê `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`) · `constants.ts` (`MASTER_EMAIL`) · `linkUtils.ts` (`extrairDriveFileId`, `extrairYoutubeId`, `ehUrl`)

**Cache keys compartilhadas** (mutações em domínios diferentes invalidam a mesma chave):

| Cache key | Escrita por (invalidadores) |
|---|---|
| `["mensalidade-membro"]` | useCombustivel, useDiario (criar), useManutencoes (confirmarRateio), useMembros, useOleo, useOrcamento |
| `["mensalidades-todos", grupoId]` | useCombustivel, useDiario (criar), useMembros, useOleo, useOrcamento |
| `["saldo-atual", grupoId]` | useManutencoes (concluir), useOleo, useOrcamento, useSeguro |
| `["lancamentos", grupoId]` | useManutencoes (concluir), useOleo, useOrcamento, useSeguro |
| `["ultimo-horimetro", grupoId]` | useDiario (criar, excluir, registrarTroca) |

## Schema do banco (resumo)

O schema completo e executável vive em **`supabase/schema.sql`** — um único arquivo (extensões, tabelas, funções, triggers, políticas RLS, job do pg_cron), gerado por introspecção direta do banco de produção em 2026-08-12. Cole esse arquivo inteiro no SQL Editor de um projeto Supabase novo para clonar a estrutura completa do sistema (ver instruções no cabeçalho do próprio arquivo).

**Fluxo de trabalho para mudanças de schema** (não existe mais pasta `supabase/migrations/`): aplique a mudança direto no banco via MCP do Supabase (`apply_migration` ou `execute_sql`), depois regenere `supabase/schema.sql` do zero por introspecção (não edite o arquivo à mão por cima — ele é um dump, não um histórico incremental) e regenere `src/types/database.types.ts` com `generate_typescript_types`. Documente a mudança no Changelog deste arquivo.

**17 tabelas** em `public`, todas com RLS habilitado. **63 políticas RLS**. Padrão de política: `SELECT` → `eh_membro_ativo(grupo_id)`; escrita sensível → `eh_gestor_ou_admin(grupo_id)` ou `eh_admin(grupo_id)`; essas três são funções `SECURITY DEFINER` que checam `grupo_membros` pelo `auth.uid()` atual.

### Tabelas

**Núcleo**: `grupos` (id, nome, nome_recurso, termo_cota, dia_virada, moeda, timezone, logo_url, criado_em) · `grupo_membros` (id, grupo_id, user_id nullable, nome, email, telefone, role admin/gestor/cotista, cotas numeric(6,2), ativo, excluido, criado_em; unique grupo_id+user_id)

**Agenda**: `reservas` (id, grupo_id, membro_id, data, periodo M/T, status confirmado/cancelado; unique parcial grupo_id+data+periodo WHERE status='confirmado') · `feriados` (id, grupo_id, data, descricao; unique grupo_id+data)

**Diário/horímetro**: `diario_bordo` (id, grupo_id, autor_id, titulo, relato, prioridade normal/atencao/urgente, resolvido, data_resolucao, resolvido_por, horimetro_inicio, horimetro_fim, tempo_uso GENERATED, diferenca_anterior, observacoes, data_uso_reportado, criado_em) · `ajustes_horimetro` (id, grupo_id, data, leitura_anterior, leitura_novo_aparelho, delta, motivo, criado_por, criado_em)

**Orçamento**: `lancamentos` (id, grupo_id, tipo receita/despesa, descricao, valor, valor_por_cota, data, lancado_por, origem manual/caixa_inicial/ajuste_caixa/recorrente/manutencao_horas/seguro, origem_ref_id, observacao, criado_em) · `recorrentes` (id, grupo_id, tipo, descricao, valor_atual, dia_cobranca, ativo, data_inicio, data_fim, subtipo, criado_em, atualizado_em) · `recorrentes_historico` (id, recorrente_id, valor_anterior, valor_novo, alterado_por, vigencia_inicio, vigencia_fim, criado_em) · `confirmacoes_pagamento` (id, recorrente_id, membro_id, mes_referencia char(7), confirmado, data_confirmacao, confirmado_por; unique recorrente_id+membro_id+mes_referencia)

**Custos variáveis**: `historico_custo_combustivel` (id, grupo_id, consumo_por_hora, custo_unidade, unidades, custo_por_hora GENERATED, vigencia_inicio, vigencia_fim, alterado_por, criado_em) · `historico_custo_oleo` (id, grupo_id, custo_galao, data_inicio, data_fim, alterado_por, criado_em)

**Manutenção**: `manutencoes` (id, grupo_id, descricao, periodicidade, tipo_gatilho data/horas, proxima_data, intervalo_horas, horimetro_base, custo_previsto, custo_real, feito, data_execucao, feito_por, observacao, criado_em, data_inicio_ciclo) · `rateio_manutencao` (id, manutencao_id, descricao, membro_id, horas, valor, data, confirmado, data_confirmacao)

**Outros**: `seguros` (id, grupo_id, apolice, seguradora, data_inicio, valor, data_vencimento, renovado_por, observacao, criado_em) · `informacoes_uteis` (id, grupo_id, categoria Contato/Documento/Senha_Acesso/Procedimento/Outro, rotulo, valor, observacao, autor_id, criado_em) · `avisos_embarcacao` (id, grupo_id, mensagem, criado_por, criado_em, resolvido, resolvido_por, resolvido_em)

### Políticas RLS por tabela

| Tabela | Políticas |
|---|---|
| `grupos` (6) | INSERT: authenticated; SELECT: master, membro_ativo; UPDATE: admin, master; DELETE: master |
| `grupo_membros` (6) | INSERT: admin, fundador-do-grupo-novo; SELECT: master, membro_ativo; UPDATE: admin; DELETE: admin |
| `feriados` (4) | INSERT/UPDATE/DELETE: admin; SELECT: membro_ativo |
| `reservas` (3) | INSERT: membro_ativo; SELECT: membro_ativo; UPDATE: dono-futuro ou gestor |
| `diario_bordo` (4) | INSERT: membro_ativo; SELECT: membro_ativo; UPDATE: autor ou gestor; DELETE: gestor |
| `ajustes_horimetro` (3) | INSERT: gestor; SELECT: membro_ativo; DELETE: gestor |
| `lancamentos` (4) | INSERT/UPDATE/DELETE: gestor; SELECT: membro_ativo |
| `recorrentes` (3) | INSERT/UPDATE: admin; SELECT: membro_ativo |
| `recorrentes_historico` (2) | INSERT: admin (via join); SELECT: membro_ativo (via join) |
| `confirmacoes_pagamento` (3) | INSERT: membro_ativo (via join); SELECT: membro_ativo (via join); UPDATE: dono ou gestor |
| `historico_custo_combustivel` (3) | INSERT/UPDATE: gestor; SELECT: membro_ativo |
| `historico_custo_oleo` (4) | INSERT/UPDATE/DELETE: gestor; SELECT: membro_ativo |
| `manutencoes` (4) | INSERT/UPDATE/DELETE: gestor; SELECT: membro_ativo |
| `rateio_manutencao` (3) | INSERT: gestor (via join); SELECT: membro_ativo (via join); UPDATE: dono ou gestor |
| `seguros` (4) | INSERT/UPDATE: gestor; SELECT: membro_ativo; DELETE: admin |
| `informacoes_uteis` (3) | INSERT: membro_ativo; SELECT: membro_ativo; DELETE: admin |
| `avisos_embarcacao` (4) | INSERT/UPDATE/DELETE: gestor; SELECT: membro_ativo |

### Funções RPC (56 funções)

- *Horímetro*: `ultimo_horimetro`, `ultima_leitura_horimetro`, `registrar_troca_horimetro`, `criar_registro_diario`, `data_efetiva_diario`, `relatorios_pendentes_membro`, `relatorios_pendentes_todos`
- *Financeiro*: `saldo_atual`, `custo_fixo_mes`, `mensalidade_membro`, `mensalidades_todos`, `criar_lancamento`, `editar_lancamento`, `alterar_valor_recorrente`, `despesa_mensal_total`, `calc_totais_mes_com_previstos`, `reserva_emergencia_mes`, `reserva_acumulada_ate`, `total_cotas_ativas`
- *Combustível/óleo*: `custo_combustivel_por_hora_vigente`, `custo_combustivel_membro_mes`, `custo_combustivel_total_mes`, `definir_custo_combustivel`, `editar_custo_combustivel_atual`, `custo_oleo_por_hora_vigente`, `custo_oleo_membro_mes`, `custo_oleo_total_mes`, `definir_custo_oleo`, `editar_custo_oleo_atual`, `fechar_custo_oleo`, `resumo_custo_oleo`, `horas_oleo_membro_mes`, `horas_combustivel_membro_mes`
- *Manutenção*: `concluir_manutencao`, `concluir_manutencao_horas`, `projecao_manutencao_horas`, `horas_por_membro_desde_horimetro`
- *Uso/horas*: `horas_grupo_periodo`, `horas_membro_periodo`, `horas_por_membro_periodo`, `conta_para_escala`
- *Seguro*: `renovar_seguro`
- *Painel do gestor*: `painel_gestor`
- *Grupo/admin*: `criar_grupo` (SECURITY DEFINER), `master_editar_nome_grupo`, `master_excluir_grupo` (SECURITY DEFINER), `master_trocar_admin` (SECURITY DEFINER), `master_excluir_membro` (SECURITY DEFINER), `excluir_membro` (SECURITY DEFINER), `eh_admin`/`eh_gestor_ou_admin`/`eh_membro_ativo`/`eh_master` (STABLE SECURITY DEFINER, usadas em política RLS)
- *Sistema*: `processar_recorrentes_do_dia` (SECURITY DEFINER, chamada diariamente às 06:00 UTC por um job do `pg_cron`, ver fim de `supabase/schema.sql`)

**Triggers**: `auth.users` AFTER INSERT → `vincular_convite_pendente()` · `grupo_membros` BEFORE INSERT → `vincular_membro_a_conta_existente()` (ambos SECURITY DEFINER, ver fluxo de convite acima)

### Horímetro — cuidado especial

Redesenhado em 2026-08-12 depois de um bug real (o valor exibido chegou a ficar 188.2h quando o aparelho físico marcava 6.6h). Design atual:

- `ultima_leitura_horimetro(grupo_id)` = a leitura mais recente conhecida, comparando por `criado_em`: o `horimetro_fim` do último `diario_bordo`, OU o `leitura_novo_aparelho` do último `ajustes_horimetro`, o que for mais recente. **Sem soma cumulativa** — nunca compõe deltas.
- `ultimo_horimetro(grupo_id)` = `coalesce(ultima_leitura_horimetro(...), 0)`, é o que a UI mostra (mostrador `HorimetroGauge` no Diário).
- `ajustes_horimetro` guarda `leitura_anterior` (valor real antes, só histórico) e `leitura_novo_aparelho` (valor que vira a nova referência) — usado quando o aparelho físico é trocado ou precisa ressincronizar.
- **Se for mexer nessa lógica de novo**: não volte a somar deltas. Qualquer "correção" ou "troca" deve ser só mais um registro em `ajustes_horimetro` com timestamp mais recente — o mecanismo de "pega o mais recente" já lida com correções sem precisar limpar histórico.

## Particularidades / armadilhas conhecidas

- **A raiz do repo já foi um lixão de arquivos com conteúdo trocado/corrompido** (sobra de uma exportação malfeita antiga — dezenas de `.tsx`/`.ts`/`.sql` soltos fora de `src/`/`supabase/` cujo conteúdo não batia com o nome do arquivo, mais dois `.zip`/`.rar` de backup). Tudo isso foi removido em 2026-08-12 (~87 arquivos, ver Changelog). **Se algo assim aparecer de novo na raiz** (arquivo cujo conteúdo não faz sentido pro nome, ou não é referenciado por nenhum `tsconfig`/`vite.config`), é o mesmo padrão — não confie no conteúdo, confirme com o usuário antes de tratar como real.
- **`src/pages/Reservar.tsx` e `src/pages/useOleo.ts` (código morto/duplicata órfã) foram removidos** em 2026-08-12. Se `Reservar` como tela separada precisar voltar, reconstrua a partir do zero — a funcionalidade equivalente vive hoje em `Calendario.tsx`.
- **`supabase/schema.sql` é um dump, não um histórico**: não existe mais pasta `supabase/migrations/`. Ver "Fluxo de trabalho para mudanças de schema" acima antes de mexer no banco.
- **`node_modules` nunca deve ser commitado**: já aconteceu (commit `0a9d8290`) e quebrou o build na Vercel (`Permission denied` no `tsc`, binário perdeu o bit de execução no round-trip Windows→git→Linux). Há `.gitignore` agora cobrindo `node_modules/`, `.env*`, `dist/`. Se `git status` mostrar node_modules como novo/modificado, pare e investigue antes de commitar.
- **`.env.local` não é commitado**: Vercel precisa de `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` configuradas direto nas Environment Variables do projeto, não vêm de arquivo versionado.
- **Estrutura de git worktree**: este projeto é frequentemente trabalhado a partir de `.claude/worktrees/<nome>/`, um worktree git separado do checkout principal (`sistema-cotistas/`), compartilhando o mesmo `.git`. `git push` numa branch `claude/*` não aparece automaticamente na pasta principal — é preciso push + PR/merge. Cuidado ao commitar: o usuário já commitou `node_modules` sem querer pelo GitHub Desktop apontando pro worktree errado.
- **MASTER_EMAIL** hardcoded em `src/lib/constants.ts` (`victornogueirapinto@gmail.com`) é o único e-mail que pode criar grupos novos — mudar isso exige trocar tanto a constante quanto a checagem correspondente no banco (`eh_master()`).
- **Impressão do Painel do Gestor**: usa `window.print()` nativo + classe `no-print`, não uma lib de PDF. Não trocar sem necessidade real.
- **`useExcluirMembro` (em `useMembros.ts`)** chama a RPC `excluir_membro` que faz soft-delete (anonymize + inativa) — diferente de `useExcluirMembroMaster` (em `useAdministrador.ts`) que chama `master_excluir_membro`.
- **`useConfirmarPagamento`** NÃO usa `invalidarTudoOrcamento` — tem seu próprio conjunto de invalidação. Cuidado se adicionar novas queries ao bloco.
- **`useConfirmacoes` e `useRateioManutencao`** dependem de outro hook ter carregado antes (`enabled: !!data`), senão ficam desabilitados para sempre.

## Changelog

- **2026-08-12**: Criado este arquivo (varredura completa do sistema: 16 páginas, 13 arquivos de hooks, 17 tabelas, ~51 funções RPC). Nenhuma mudança de código nesta entrada, só documentação.
- **2026-08-12**: Corrigido bug de sincronia do horímetro (migração `0022_sincronizacao_horimetro.sql`) — `ultimo_horimetro` deixou de somar ajustes cumulativamente, passou a usar a leitura mais recente conhecida. Ver seção "Horímetro — cuidado especial" acima.
- **2026-08-12**: Adicionado `HorimetroGauge` (`src/components/ui/horimetro-gauge.tsx`) e modernizada `src/pages/Diario.tsx`.
- **2026-08-12**: Corrigido build quebrado na Vercel — `node_modules`/`.env.local` removidos do git, `.gitignore` criado. Ver "Particularidades" acima.
- **2026-08-12**: Limpeza completa do repositório — removidos ~87 arquivos: todo o lixo de conteúdo trocado/corrompido na raiz (dezenas de `.tsx`/`.ts`/`.sql` soltos, mais `sistema-cotistas-completo.zip`/`.rar`), o código morto `src/pages/Reservar.tsx` e a duplicata órfã `src/pages/useOleo.ts`. Recriado `.env.example` de verdade (o antigo tinha conteúdo trocado). Substituída a pasta fragmentada `supabase/migrations/` (gap 0010–0020, alguns arquivos já corrompidos) por **`supabase/schema.sql`** único, gerado por introspecção completa do banco de produção — extensões, 17 tabelas, 52 funções, 2 triggers, 61 políticas RLS e o job do pg_cron. Esse arquivo agora é a fonte da verdade para clonar o sistema; ver "Schema do banco" acima para o novo fluxo de trabalho.
- **2026-08-12**: Adicionado `excluido` em `grupo_membros` + RPC `excluir_membro` (anonymize cross-grupo) + DELETE policy `"admin exclui membros"`. Frontend: hook `useExcluirMembro` em `useMembros.ts`, botão "Excluir" + modal em `Cotistas.tsx` (admin-only). Ver migração `0023`.
- **2026-08-18**: Administração cross-grupo para master — 3 novas RPCs (`master_excluir_grupo`, `master_trocar_admin`, `master_excluir_membro`), DELETE policy `"master exclui grupos"`, hooks em `useAdministrador.ts`, UI expandida em `Administrador.tsx` (excluir grupo, trocar admin, badges de role, excluir membro). Ver migração `0024`.
- **2026-08-18**: Edição de nome+e-mail de membros — hook `useEditarMembro` (update direto `grupo_membros`, requer RLS policy `"master edita membros"`), modal combinado para editar nome e e-mail de qualquer membro na tela `Administrador.tsx`. Requer policy SQL: `create policy "master edita membros" on public.grupo_membros for update using (eh_master());`
- **2026-08-18**: Reescrita completa do CLAUDE.md — auditoria 1:1 de todas as 16 páginas, 13 arquivos de hooks (65 hooks), 17 tabelas, 63 políticas RLS, 56 funções, 2 triggers, 1 cron job. Seções adicionadas: cache keys compartilhadas, políticas RLS por tabela, lista completa de funções RPC, particularidades conhecidas expandidas.
