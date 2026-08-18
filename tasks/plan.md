# Plano: Excluir cotistas + Remover usuários teste

## Contexto

O usuário quer:
1. **Remover os usuários "Teste" e "Teste 2"** do banco ( ambos sem FK em qualquer tabela, sem auth.users — exclusão segura)
2. **Criar opção de excluir cotistas** no frontend que:
   - Remove o membro da visualização completamente
   - Mantém o `id` na tabela `grupo_membros` para não quebrar FKs
   - Anonimiza dados pessoais (nome, email, telefone)

## Descobertas

- **Teste** (id `506afa7b...`) e **Teste 2** (id `f2278276...`) já estão com `ativo=false`, `user_id=null`, zero referências em todas as tabelas — exclusão direta é segura
- Não existe policy DELETE em `grupo_membros` (só INSERT/UPDATE/SELECT)
- `email` é `NOT NULL` no schema — não dá para setar null, usar placeholder
- Coluna `ativo` já existe e controla se o membro conta nos cálculos — mas membros inativos ainda aparecem na UI com badge "Inativo"
- Precisamos distinguir "inativo" (temporário, visível) de "excluído" (permanente, invisível)

## Decisões de Arquitetura

| Decisão | Escolha | Motivação |
|---------|---------|-----------|
| Nova coluna `excluido` | Sim | Distingue inativo de excluído; permite filtrar no frontend sem quebrar a UI de inativos |
| RPC `excluir_membro` | SECURITY DEFINER | Garante que só admin pode excluir, checagem server-side |
| Anonimização | Placeholder para email (NOT NULL constraint) | Não viola constraint, dados pessoais são apagados |
| Exclusão dos testes | Hard delete | Zero FKs, seguro deletar a linha inteira |

## Tarefas

### Tarefa 1: Excluir usuários teste do banco
- Executar `DELETE FROM grupo_membros WHERE id IN ('506afa7b...', 'f2278276...')`
- Verificar que nenhuma referência quebrou

### Tarefa 2: Adicionar coluna `excluido` ao schema
- `ALTER TABLE grupo_membros ADD COLUMN excluido boolean NOT NULL DEFAULT false`
- Atualizar `supabase/schema.sql` (dump completo via introspecção)
- Regenerar `src/types/database.types.ts`

### Tarefa 3: Criar RPC `excluir_membro`
- Função `excluir_membro(p_membro_id uuid)` com `SECURITY DEFINER`
- Verifica `eh_admin(grupo_id)` do membro alvo
- Anonimiza: nome → 'Excluído', email → 'excluido-' || left(id, 8), telefone → null, user_id → null, ativo → false, excluido → true
- Atualizar `supabase/schema.sql`

### Tarefa 4: Criar hook `useExcluirMembro`
- Em `src/lib/queries/useMembros.ts`
- Chama `.rpc("excluir_membro", { p_membro_id })`
- Invalida queries: membros, mensalidade-membro, mensalidades-todos

### Tarefa 5: Atualizar query `useMembros`
- Adicionar filtro `.eq("excluido", false)` para ocultar excluídos

### Tarefa 6: Adicionar UI de exclusão em Cotistas.tsx
- Botão "Excluir" ao lado de "Editar" (só para admin)
- Modal de confirmação (padrão do projeto)
- Toast de sucesso/erro

### Tarefa 7: Atualizar schema.sql e types
- Rodar introspecção completa para atualizar `supabase/schema.sql`
- Rodar `generate_typescript_types` para atualizar `src/types/database.types.ts`

## Verificação
- `npm run lint` limpo
- `npm run build` sem erros
- Usuários teste removidos do banco
- Cotista excluído não aparece mais na UI
- Dados pessoais anonimizados no banco
- ID mantido para referências FK
