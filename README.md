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
