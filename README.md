# Sistema de Gestão de Cotistas — Versão Web

## Status atual: Fase 4 concluída (Seguro, Informações Úteis, Painel do Gestor)

✅ Login, criação de grupo, convite de cotistas
✅ Calendário, reservas, ranking de prioridade
✅ Orçamento completo (lançamentos, recorrentes, mensalidade automática,
   proteção contra caixa negativo)
✅ Diário de Bordo, custo de combustível, manutenções (data e horímetro)
✅ Seguro obrigatório: apólice atual, renovação (com lançamento automático
   de despesa opcional), histórico
✅ Informações Úteis: contatos, documentos, senhas/acesso, procedimentos
✅ Painel do Gestor: relatórios mensais/anuais de uso e financeiro,
   discriminado de receitas/despesas (com itens "previstos"), status do
   seguro e da próxima manutenção, relatórios de uso pendentes, com botão
   de impressão em A4
⬜ Polimento final (ver seção "Próximos passos" abaixo)

## Antes de usar: rode mais um arquivo SQL

Cole `supabase/migrations/0006_seguro_painel_gestor.sql` no SQL Editor do
Supabase (depois dos 5 anteriores) e clique em Run.

## Como funciona a impressão do Painel do Gestor

Clique em "🖨️ Imprimir relatório (A4)" na tela do Painel do Gestor — o
navegador abre a caixa de impressão nativa (a mesma usada para "Salvar como
PDF"), já sem o cabeçalho/menu do app, formatado para papel A4. É a mesma
abordagem do sistema antigo: zero configuração extra, funciona em
qualquer navegador.

## O sistema agora está funcionalmente completo

Todas as telas e regras de negócio do sistema original em Google Apps
Script foram reconstruídas:

| Módulo | Status |
|---|---|
| Cotistas e cotas | ✅ |
| Reservas e ranking de prioridade | ✅ |
| Feriados | ✅ |
| Orçamento (lançamentos, recorrentes, mensalidade, caixa) | ✅ |
| Diário de Bordo (horímetro) | ✅ |
| Custo variável de combustível | ✅ |
| Manutenções (data e horímetro) | ✅ |
| Seguro obrigatório | ✅ |
| Informações úteis | ✅ |
| Painel do Gestor + impressão A4 | ✅ |

## Próximos passos (polimento, não obrigatório para usar o sistema)

- Publicar o app na internet com um link público (GitHub + Vercel — te
  aviso quando chegarmos nessa etapa)
- Ícones/logo próprios do PWA (hoje usa um ícone genérico)
- Ajustes finos de UX conforme o uso real do grupo

## Passos de configuração (iguais às fases anteriores)

1. Rode os 6 arquivos de `supabase/migrations/` no SQL Editor do Supabase, em ordem.
2. Copie `.env.example` para `.env` e preencha com a Project URL e a anon
   public key.
3. `npm install` e `npm run dev`.

## Reformulação visual (design system premium)

O layout inteiro foi reconstruído seguindo um briefing de design específico
(estilo Stripe/Linear/Notion/Revolut), **sem alterar nenhuma regra de
negócio, hook ou chamada ao banco** — só a camada visual.

O que mudou:
- Paleta: branco, cinza claro, azul petróleo, azul oceano, azul royal
  (destaque), verde (sucesso) e vermelho (alerta) apenas em estados
- Tipografia Inter, cantos arredondados (16–24px), sombras muito suaves
- Navegação mudou de abas no topo para **Bottom Navigation** (padrão de
  apps modernos): Início, Agenda, Reservar, Orçamento e "Mais" (que abre
  um menu com as demais telas — Manutenção, Diário, Seguro, Informações,
  Painel do Gestor, Cotistas, Feriados — e o botão Sair)
- Modais viraram **Bottom Sheets** (deslizam de baixo, com fundo
  desfocado), com animações suaves via Framer Motion
- Novos componentes reutilizáveis: StatCard, ListItem, Badge, Avatar,
  EmptyState, SegmentedControl, LoadingSkeleton

Nada de funcionalidade mudou: os mesmos dados, os mesmos cálculos, as
mesmas permissões — só a aparência.

## Mudanças de fluxo e funcionalidade (nova rodada)

### Reservar foi incorporado à Agenda
A tela "Reservar" separada foi removida. Agora dá pra reservar direto na
tela **Agenda/Calendário**: clique em um dia para ver/reservar aquele dia
específico, ou toque no botão flutuante **"+"** no canto inferior direito
para reservar rapidamente sem precisar navegar até o mês certo. A lista
"Minhas reservas futuras" também está lá.

O menu inferior agora mostra **Diário de Bordo** no lugar de "Reservar" —
já que toda vez que alguém usa a embarcação precisa preencher um relatório
de uso lá.

### Informações Úteis mais espertas
- Documentos do Google Drive e vídeos do YouTube abrem em uma **visualização
  rápida** (sem sair do app)
- Links comuns abrem direto em nova aba com um toque
- Contatos, PIX e senhas são **copiados automaticamente** ao tocar
- Excluir agora pede **confirmação dupla** (evita exclusão acidental)

### Controle de quem pode criar novos grupos (IMPORTANTE)
Agora **só o e-mail `victornogueirapinto@gmail.com`** pode criar um novo
grupo no sistema — essa regra está no banco de dados (não só escondida na
tela), então ninguém consegue burlar isso mesmo mexendo no código do
navegador.

Fluxo de venda para um novo cliente/gestor:
1. Você (master) faz login e cria um novo grupo, informando **nome e
   e-mail do administrador** (o gestor responsável por aquele grupo).
2. Esse gestor recebe, na prática, um convite (mesmo mecanismo de
   convidar cotistas): ele cria a própria conta com aquele e-mail e já
   entra como Admin do grupo dele.
3. A partir daí, ele mesmo cadastra os cotistas do grupo dele — sem
   precisar de você.

Qualquer outra pessoa que criar conta sem ter sido convidada por ninguém
cai numa tela de **"Aguardando convite"**, sem conseguir criar grupo
nenhum.

⚠️ **Você precisa rodar mais um arquivo SQL** para ativar essa proteção:
`supabase/migrations/0008_grupo_apenas_master.sql`

## Ajustes de responsividade

- Todos os campos de formulário (texto, seleção, área de texto) agora
  têm no mínimo 16px de fonte — abaixo disso, o Safari do iPhone dá zoom
  automático ao tocar no campo, o que quebrava a experiência em celular.
- O botão flutuante "+" da Agenda agora acompanha a largura do conteúdo em
  qualquer tela — antes ficava colado na borda real da janela em telas
  largas, desalinhado do restante do app.
- Conferidas todas as tabelas (Orçamento, Painel do Gestor, Seguro): todas
  já tinham rolagem horizontal própria em telas estreitas, sem "vazar"
  da tela.
- Grades de cartões (Cotistas, Manutenção, Informações, indicadores do
  Dashboard) já se ajustam de 1 para 2, 3 ou mais colunas conforme o
  espaço disponível, do celular ao desktop.

Não foi preciso rodar nenhum SQL novo para esta parte — é só o código do
app mesmo, então basta subir os arquivos atualizados no GitHub.
