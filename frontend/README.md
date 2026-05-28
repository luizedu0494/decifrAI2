# DecifrAI — Guia de Migração

## O que mudou

### Backend (`/backend/index.js`)
O backend agora processa os **3 agentes de IA** (Estratégia, Curadoria, Personalização) e monta o prompt completo antes de chamar o Groq/Gemini. Também faz retry automático quando o Groq atinge rate limit.

**Nova rota:** `POST /api/next-question`
- Recebe: `{ history, userId, sessionId, invalidQuestions }`
- Processa os 3 agentes + busca Supabase
- Chama Gemini → Groq com fallback automático
- Retorna: `{ question, reaction, isGuess, character }`

**Nova rota:** `POST /api/save-game`
- Recebe: `{ characterName, wasGuessed, history, userId, sessionId }`
- Salva em `characters`, `question_stats`, `ranking`, `feed`

### Frontend (`/frontend/src/services/`)
- `groq.ts` — simplificado, só chama o backend
- `gemini.ts` — pode ser **deletado** (o backend faz o fallback)
- `ai.ts` — simplificado, passa userId e sessionId para o backend
- `history.ts` — migrado para Supabase (tabela `feed`)
- `aiKnowledge.ts` — pode ser **deletado** (o backend gerencia)
- `playerPersonalization.ts` — pode ser **deletado** (o backend gerencia)

## Passos para aplicar

### 1. Supabase — rodar a migration
Abra o SQL Editor no dashboard do Supabase e execute o arquivo `supabase_migration.sql`.

### 2. Backend — adicionar variáveis de ambiente no Render
Nas configurações do seu serviço no Render, adicionar:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  (service_role, não anon!)
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
```

### 3. Backend — substituir `index.js`
Substitua `/backend/index.js` pelo novo arquivo.
Substitua `/backend/package.json` pelo novo arquivo.

Rode no Render (ou local para testar):
```bash
npm install
npm start
```

### 4. Frontend — substituir serviços
Substitua os arquivos em `frontend/src/services/`:
- `groq.ts` → novo (simplificado)
- `ai.ts` → novo (simplificado)
- `history.ts` → novo (usa Supabase)

Substitua `frontend/src/app/game/result.tsx` → novo (usa `saveGame` do groq.ts).

### 5. Frontend — deletar arquivos não usados
```
src/services/gemini.ts          ← deletar
src/services/aiKnowledge.ts     ← deletar
src/services/playerPersonalization.ts ← deletar
src/services/ai_render.ts       ← deletar (substituído pelo novo ai.ts)
```

### 6. Verificar `.env` do frontend
O frontend precisa apenas de:
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...  (anon key — segura no app)
EXPO_PUBLIC_RENDER_API_URL=https://seu-servico.onrender.com
```

## Estrutura final
```
App → /api/next-question (Render)
         ├── Agente 1: Estratégia (síncrono)
         ├── Agente 2: Curadoria (Supabase)
         ├── Agente 3: Personalização (Supabase)
         └── Gemini / Groq (com retry automático)

App → /api/save-game (Render)
         ├── characters (Supabase)
         ├── question_stats (Supabase)
         ├── ranking (Supabase)
         └── feed (Supabase)
```
