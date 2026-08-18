# Plano: Administração cross-grupo (master)

## Contexto

O usuário master precisa gerenciar administradores de todos os grupos: trocar admin, excluir admin, excluir grupo, enviar convite para novo admin, resetar senha e enviar convite de redefinição. A tela atual (`Administrador.tsx`) já tem seleção de grupo, renomear e reset de senha — mas falta tudo o mais.

## Estado atual

| Capacidade | Status |
|------------|--------|
| Selecionar grupo | ✅ existe |
| Renomear grupo | ✅ existe (`master_editar_nome_grupo`) |
| Resetar senha de cotista | ✅ existe (Supabase `resetPasswordForEmail`) |
| Criar grupo novo | ✅ existe (`criar_grupo` RPC) |
| **Excluir grupo** | ❌ não existe — sem DELETE policy em `grupos`, sem RPC |
| **Trocar admin do grupo** | ❌ não existe — sem RPC |
| **Excluir/promover/rebaixar membros** | ❌ parcial — `excluir_membro` existe mas só para admin do grupo, não para master cross-grupo |
| **Convidar novo admin** | ❌ não existe — `criar_grupo` faz isso mas só para grupos novos |
| **Resetar senha (já existe)** | ✅ — mas o master não consegue ver membros de outros grupos com `user_id` para saber quem tem conta |

## Decisões de Arquitetura

| Decisão | Escolha | Motivação |
|---------|---------|-----------|
| RPCs com SECURITY DEFINER | Sim, todas | Master não é membro de todos os grupos — precisa de privilégio elevado para operar cross-grupo |
| Excluir grupo = CASCADE manual | Sim | 13 tabelas com FK para `grupos.id`; usar função que deleta membros + grupo (não CASCADE automático por segurança) |
| Trocar admin = demote + promote | Sim | Remove role 'admin' do atual, coloca no novo; se novo não tem conta, cria convite pendente |
| UI = expandir `Administrador.tsx` | Sim | Já é a tela do master; adicionar seções para cada operação |
| Convite para novo admin | Reutilizar mecanismo existente | `grupo_membros` com `user_id=null` = convite pendente; funciona igual cotista |

## Tarefas

### Fase 1: Banco (RPCs + RLS)

**Tarefa 1: Excluir grupo (master)**
- Adicionar DELETE policy `"master exclui grupos"` em `grupos`: `FOR DELETE USING (eh_master())`
- Criar RPC `master_excluir_grupo(p_grupo_id uuid)` SECURITY DEFINER:
  - Verifica `eh_master()`
  - Deleta todos os `grupo_membros` do grupo
  - Deleta dados relacionados (reservas, diario, lancamentos, etc.) — CASCADE ou delete manual
  - Deleta o grupo
  - Retorna void

**Tarefa 2: Trocar admin do grupo (master)**
- Criar RPC `master_trocar_admin(p_grupo_id uuid, p_novo_admin_email text, p_novo_admin_nome text)` SECURITY DEFINER:
  - Verifica `eh_master()`
  - Verifica que o grupo existe
  - Demote: seta `role='cotista'` no admin atual (se houver)
  - Procura membro existente com o email informado
  - Se existe: promove para `role='admin'`
  - Se não existe: cria convite pendente (`user_id=null`, `role='admin'`)
  - Retorna void

**Tarefa 3: Excluir membro de qualquer grupo (master)**
- Criar RPC `master_excluir_membro(p_membro_id uuid)` SECURITY DEFINER:
  - Verifica `eh_master()`
  - Anonimiza dados (igual `excluir_membro` existente, mas sem checar admin do grupo)
  - Retorna void

**Tarefa 4: Atualizar schema.sql**
- Dump completo via introspecção após todas as migrações

### Fase 2: Frontend (hooks + UI)

**Tarefa 5: Hooks em `useAdministrador.ts`**
- `useExcluirGrupo` — chama `master_excluir_grupo`, invalida `master-todos-grupos`
- `useTrocarAdmin` — chama `master_trocar_admin`, invalida `master-membros-grupo`
- `useExcluirMembroMaster` — chama `master_excluir_membro`, invalida `master-membros-grupo`

**Tarefa 6: UI — Excluir grupo**
- Botão "Excluir grupo" no card do grupo selecionado (ao lado de "Renomear")
- Modal de confirmação: "Tem certeza que quer excluir o grupo [nome]? Todos os dados serão perdidos."
- Após excluir, seleciona outro grupo automaticamente

**Tarefa 7: UI — Trocar admin**
- Seção "Trocar administrador" com:
  - Input para email do novo admin
  - Input para nome do novo admin (opcional)
  - Botão "Trocar admin"
  - Se o email pertence a membro existente, promove; se não, cria convite
- Modal de confirmação antes de executar

**Tarefa 8: UI — Gerenciar membros do grupo selecionado**
- Expandir a lista de membros para mostrar:
  - Role (admin/gestor/cotista) com badge
  - Botão "Excluir" para cada membro (com confirmação)
  - Botão "Enviar senha" já existe
- Para convites pendentes, mostrar indicador visual

### Fase 3: Verificação

**Tarefa 9: Build e lint**
- `npm run lint` limpo
- `npm run build` sem erros

## Fluxo de UX

```
Tela Administrador
├── [Novo grupo] → /criar-grupo
├── [Selecionar grupo] dropdown
│   ├── Grupo selecionado
│   │   ├── [Renomear] → modal
│   │   ├── [Excluir grupo] → modal confirmação → remove
│   │   └── [Trocar admin] → input email/nome → confirmação → executa
│   ├── Lista de membros do grupo
│   │   ├── Membro com role badge
│   │   ├── [Enviar senha] → envia link
│   │   └── [Excluir] → confirmação → anonimiza
│   └── [Convidar novo membro] → input email → cria convite
└── [Redefinir senha] → input email → envia link (já existe)
```

## Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Excluir grupo com dados importantes | Alto | Modal de confirmação com nome do grupo digitado |
| Trocar admin errado | Alto | Mostrar nome/email atual antes de confirmar |
| Convite pendente sem email válido | Médio | Validar email no frontend |
| Master sem permissão no banco | Baixo | Todas as RPCs são SECURITY DEFINER + checam `eh_master()` |

## Arquivos tocados

- `supabase/schema.sql` — novas policies + 3 RPCs
- `src/types/database.types.ts` — novas funções
- `src/lib/queries/useAdministrador.ts` — novos hooks
- `src/pages/Administrador.tsx` — UI expandida
