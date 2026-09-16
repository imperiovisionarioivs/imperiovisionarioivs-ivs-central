# Relatório de revisão — IVS Central

Este relatório documenta as correções feitas em resposta à revisão de código, na ordem pedida (segurança e perda de dados primeiro). Cada etapa lista: correções e arquivos afetados, testes executados com resultado real, e pendências reais que continuam em aberto. Nenhuma correção abaixo foi validada só por "o build passou" — cada uma tem uma evidência de teste associada, descrita na seção correspondente.

Ambiente de teste: Postgres 16 local, aplicação rodando de verdade (`next build && next start` para as rotas de API; `next dev` para os testes de navegador, pelo motivo explicado na seção da Etapa 1) e um navegador Chromium real via Playwright — não apenas testes unitários isolados.

## Segunda rodada de revisão

Depois da entrega inicial, uma nova análise de código pediu reconfirmação dos 18 pontos originais. Em vez de reafirmar o relatório anterior de memória, cada item foi reauditado lendo o código do zip entregue e reexecutando evidência real contra um banco Postgres limpo (não incremental sobre o estado de teste anterior). Resultado da reauditoria:

- **Etapas 1, 2 e 4**: todas as correções da rodada anterior permanecem corretas — reverificadas linha a linha e com uma nova bateria de testes reais (detalhada em cada seção abaixo), incluindo casos não cobertos da primeira vez (ex.: `IMPORT_ENABLED=false` bloqueando mesmo com secret correto, limite de tamanho do payload de importação, RBAC do CSV testado nos 4 papéis, não apenas admin).
- **Um problema concreto novo, de baixo risco**: `middleware.ts` e `public/sw.js` referenciavam `/ivs-logo.png`, um arquivo que não existe em `public/` (a logo oficial ainda não foi recebida — ver Etapa 5). Não é uma falha de segurança nem funcional (nada tenta servir esse arquivo hoje), mas é configuração morta apontando para um recurso inexistente — comentado no código explicando por que está ali, para quando a logo chegar.
- **Etapa 3 avançou de verdade nesta rodada**, em vez de continuar apenas como matriz de pendências: implementados Prospecção por nicho/fila semanal, Propostas com revisões, e Backup completo em JSON + restauração validada — os três com evidência de teste real (não apenas revisão de código). Ver detalhes na seção da Etapa 3.

## Terceira rodada — Contratos e Financeiro (assinaturas e cobranças)

Com a confirmação de seguir para os módulos restantes, e o pedido específico de uma parte de Financeiro para assinaturas de manutenção (mensal, anual à vista com desconto, e ajustes avulsos de valor maior), foram implementados Contratos e Financeiro completos — modelo de dados, permissões, ações do servidor e telas — com evidência de teste real via navegador (Playwright) e verificação direta no Postgres. Dois problemas reais foram encontrados durante esse teste (não pelo `tsc`/build) e corrigidos na mesma rodada: um campo do formulário de contrato que não existia no HTML mas era lido pela Server Action (gerava erro 400 em toda criação de contrato), e uma cobrança marcada "atrasada" que ficava sem caminho de volta para "paga" na interface. Ver a seção "Feito na terceira rodada" dentro da Etapa 3, abaixo, para o detalhe completo e a evidência.

---

## Etapa 1 — Segurança e autenticação

### Correções e arquivos afetados

**Segredos removidos dos arquivos de exemplo**
- `.env.local.example` — todos os valores reais substituídos por placeholders vazios, com instruções (`openssl rand -base64 24` / `openssl rand -hex 32`) e aviso para nunca reaproveitar segredos.
- `DEPLOY.md` — reescrito: a tabela de variáveis não traz mais valores reais, o exemplo de `curl` usa `$IMPORT_SECRET` em vez de um valor literal, e há aviso explícito contra circular segredos por e-mail/chat/arquivo.
- `.gitignore` (novo) — exclui `.env*` reais, `clientes*.json`, `*-backup.json`, `backup-*.json`, `*.csv` (exceto `*.example.csv`), chaves de assinatura (`*.jks`, `*.keystore`, `*.p12`, `*.pem`, `*.key`).
- Os segredos gerados na sessão anterior (compartilhados apenas nesta conversa, nunca publicados em nenhum repositório) não chegaram a ser usados em nenhum ambiente real — não há, portanto, rotação a fazer. Se algum desses valores tiver sido usado em algum ambiente fora desta conversa, troque-o pelo painel do provedor (Vercel/Neon) antes de prosseguir.

**Service worker (`public/sw.js`)** — reescrito por completo:
- Removido `/` do precache.
- Navegações (`request.mode === "navigate"`) nunca são gravadas em cache — antes, toda resposta de navegação bem-sucedida era cacheada, o que podia servir HTML autenticado offline mesmo após logout. Agora o único uso do cache para navegação é o fallback (`/offline`) quando a rede falha.
- `/api/*`, `/login` e `/sw.js` passam direto (sem interceptação).
- Cache-first restrito a uma lista explícita (`/_next/static/*`, `/icons/*`, `/manifest.webmanifest`, `/ivs-logo.png`).
- Nome do cache versionado (`ivs-central-v2`); `activate` apaga qualquer cache antigo.
- Restrito à mesma origem (`url.origin !== self.location.origin` → não intercepta).
- `middleware.ts` — `/offline` adicionada a `PUBLIC_PATHS` (sem exigir sessão, sem consulta ao banco — a página em si já não tinha nenhuma).
- `components/service-worker-register.tsx` — falha de registro agora loga no console (`console.error`) em vez de ser engolida silenciosamente.

**Autorização real no servidor (`lib/permissions.ts`, novo)**
- Matriz de permissões explícita por papel (admin/comercial/producao/visitante), documentada no próprio arquivo e aplicada via `requirePermission(permission)` — "autenticado" deixou de ser sinônimo de "autorizado".
- `visitante` é somente leitura por construção: está ausente de toda permissão de escrita.
- `lib/auth.ts` — `requirePermission`, `ForbiddenError`/`UnauthenticatedError`.
- `app/actions/clients.ts` — todas as ações (`toggleChecklistAction`, `updateClientAction`, `updateStageAction`, `addActivityAction`, `createClientAction`, `archiveClientAction`, `logAgendaResultAction`) trocaram o antigo `requireUser()` local (só checava sessão) por `requirePermission(...)` com a permissão específica da matriz.
- `app/api/export/clients.csv/route.ts` — trocado para `requirePermission("client.export")` (só admin).

**Provisionamento de `jeisyellensilva@gmail.com` como visitante**
- O papel `visitante` existe e é somente leitura (ver matriz acima), pronto para receber esse usuário.
- **Nenhum usuário foi criado e nenhum convite/mensagem foi enviado** — por instrução explícita de não fazer isso sem autorização direta. Ver pendência abaixo.

**Troca de senha e revogação de sessões**
- `lib/auth.ts` — `changePassword()` (verifica senha atual, grava o novo hash, revoga todas as outras sessões do usuário), `revokeOtherSessions()`, `revokeAllSessionsForUser()` (uso administrativo).
- `app/actions/auth.ts` — `changePasswordAction`, `revokeOtherSessionsAction`.
- `components/change-password-form.tsx` (novo) + `app/(app)/configuracoes/page.tsx` — UI real: trocar senha e "encerrar outras sessões".

**Rate limiting persistente**
- `lib/db/schema.ts` — tabela `login_attempts` (substitui o `Map` em memória, que não funciona entre invocações serverless/cold starts).
- `lib/auth.ts` — `checkRateLimit()` consulta o Postgres (8 tentativas por 10 minutos, por `ip:email`), com limpeza oportunista de linhas antigas.
- **Bug real encontrado e corrigido durante o teste**: `app/actions/auth.ts` chamava `checkRateLimit(...)` sem `await`. Como a função passou a ser assíncrona (antes era síncrona, em memória), `!checkRateLimit(...)` era sempre `false` (um `Promise` é um objeto, portanto truthy) — o rate limiter estava **completamente desativado**, silenciosamente, mesmo com a lógica de bloqueio correta implementada. Só foi encontrado rodando o login de verdade contra o banco, não pelo build nem por um teste unitário isolado da função.

### Testes executados e resultados

**Testes diretos contra Postgres real** (`checkRateLimit`, `changePassword`, `revokeOtherSessions`, matriz de permissões) — 33 verificações, todas passando:
```
== permissions.can() ==
  OK   admin pode arquivar
  OK   comercial NAO pode arquivar
  OK   visitante NAO pode criar cliente
  OK   visitante pode trocar a propria senha
  ...
== checkRateLimit (persistente, Postgres) ==
  OK   8 tentativas permitidas de 10 (limite MAX_ATTEMPTS=8), obtido: 8
  OK   login_attempts registrou 8 linhas para o identificador (persistencia real), obtido: 8
== changePassword + revokeOtherSessions ==
  OK   duas sessoes criadas para o mesmo usuario
  OK   changePassword rejeita senha atual incorreta
  OK   changePassword aceita senha atual correta
  OK   troca de senha revoga TODAS as outras sessoes, mantem apenas a atual
  OK   nova senha efetivamente gravada (hash bate)
  OK   revokeOtherSessions(userId, null) remove TODAS as sessoes (uso admin)
...
TODOS OS TESTES PASSARAM
```

**Testes end-to-end com navegador real (Playwright/Chromium)**, contra a aplicação de verdade rodando em Postgres real — 23 verificações, todas passando, incluindo:
```
== middleware ==
  OK   acesso a /dashboard sem sessao redireciona para /login
  OK   /offline acessivel sem sessao (status 200)
== login: credenciais erradas ==
  OK   senha errada rejeitada com mensagem generica: "E-mail ou senha incorretos."
== login correto + sessao ==
  OK   login correto redireciona para /dashboard
  OK   sessao real foi criada no banco (tabela sessions)
== troca de senha + revogacao de sessoes ==
  OK   existem >=2 sessoes ativas antes da troca de senha
  OK   UI confirma troca de senha bem-sucedida
  OK   troca de senha revogou a outra sessao no banco
  OK   hash da nova senha efetivamente gravado no banco
== logout ==
  OK   logout redireciona para /login
  OK   sessao removida do banco apos logout
  OK   apos logout, /dashboard volta a exigir login
== rate limiting real (ultimo teste — esgota o limite de proposito) ==
  OK   apos repetidas tentativas do mesmo IP+e-mail, o rate limiter (Postgres) bloqueia com mensagem clara
  OK   login_attempts tem linhas reais persistidas (n=10)
TODOS OS TESTES E2E PASSARAM
```

Esses testes de navegador rodaram contra `next dev` (não `next start`/produção), por um motivo técnico específico: o cookie de sessão usa `secure: true` quando `NODE_ENV=production` (correto — cookie de sessão só deve trafegar por HTTPS em produção), e este sandbox não tem um endpoint HTTPS local para testar contra ele. Isso foi confirmado tanto por inspeção do código (`lib/auth.ts`, linha do `secure: process.env.NODE_ENV === "production"`) quanto observando o cookie real no navegador. Em produção real (Vercel, com HTTPS automático), esse comportamento é o correto e esperado — é uma pendência de teste (validar em HTTPS real), não um bug.

**Reverificação na segunda rodada** — banco truncado e recriado do zero (não reaproveitando estado de teste anterior), rate limiter e troca de senha testados de novo diretamente contra as funções reais:
```
[1] Rate limiter persistente (Postgres, não em memória)
  OK  - primeiras 8 tentativas permitidas
  OK  - 9ª e 10ª tentativas bloqueadas (MAX_ATTEMPTS=8)
  OK  - apenas as 8 tentativas permitidas foram gravadas na tabela (encontrado: 8)
[13] Troca de senha + revogação de outras sessões
  OK  - senha atual incorreta é rejeitada, sem alterar nada
  OK  - troca de senha com senha atual correta é aceita
  OK  - hash no banco corresponde à nova senha
  OK  - hash antigo não funciona mais
  OK  - apenas a sessão atual (A) sobrevive à troca de senha (restantes: 1)
  OK  - sessões B e C (outros dispositivos) foram revogadas
```

**RBAC testado nos 4 papéis via HTTP real** (não apenas admin, como na primeira rodada), contra `/api/export/clients.csv`:
```
-- sem cookie (não autenticado) --      status=307 (middleware redireciona para /login)
-- comercial (deve ser 403) --          status=403
-- producao (deve ser 403) --           status=403
-- visitante (deve ser 403) --          status=403
-- admin (deve ser 200) --              status=200
```
E a proteção contra injeção de fórmulas foi confirmada olhando o CSV gerado de verdade: um cliente com nome `=cmd|'/c calc'!A1` saiu como `'=cmd|'/c calc'!A1` (prefixado), e um telefone `+1234` saiu como `'+1234` — ambos os gatilhos (`=` e `+`) neutralizados.

### Pendências reais

- **UI de gestão de usuários** (criar usuário, alterar papel de outro usuário) não existe — a permissão (`user.manage`, só admin) já está definida na matriz, mas não há tela.
- **Provisionamento de `jeisyellensilva@gmail.com`**: papel `visitante` pronto, usuário não criado, nenhum convite enviado — aguardando sua autorização explícita para criar a conta (e decidir como a senha inicial chega até ela, sem circular em texto plano).
- Sessão testada em HTTPS real (produção) ainda não foi feita — só localmente em HTTP (`next dev`), pelo motivo técnico acima.

---

## Etapa 2 — Migração sem perda de dados

### Correções e arquivos afetados

**`lib/import-mapping.ts` — reescrito por completo**
- Todas as 9 etapas e as 4 prioridades legadas preservadas (mapas de alias em `STAGE_ALIASES`/`PRIORITY_ALIASES`).
- Valores desconhecidos **não** viram `nao_contatado`/`media` silenciosamente: `mapStage`/`mapPriority` retornam `{ value: null, matched: false }`, e o registro correspondente é bloqueado (`data: null`) com o motivo exato no relatório de inconsistências — nunca gravado com um valor inventado.
- `num()` corrigido: `null`/`undefined`/string vazia retornam `null` (não `0` — `Number("")` é `0` em JS, o que fabricava uma nota real para quem nunca tinha sido avaliado).
- `parseBoolean()` novo, substitui `Boolean(v)`: reconhece `"false"`, `"não"`, `"0"`, `0`, `false` como falso de verdade (`Boolean("false")` é `true` em JS — esse era o bug apontado).
- Todos os campos legados antes descartados agora são extraídos e preservados (histórico com autor/data reais, serviços recomendados, situação/data de pesquisa, confirmação presencial, campanha/ordem/dia sugerido, último contato/próximo retorno/etapa de follow-up, canal preferido/objeção/responsável, qualificação comercial, link do Notion, `legacyId`).

**`lib/db/schema.ts`**
- `googleRating` mudou de `integer` para `doublePrecision` (preserva decimais como 4,9; `null` continua distinto de `0`).
- Nova migração `drizzle/0001_young_hardball.sql` gerada com `drizzle-kit generate` — a migração `0000_special_bastion.sql`, já aplicada, não foi tocada.
- **Bug de geração corrigido manualmente**: o SQL que o `drizzle-kit` gerou para recriar o enum `stage` (`DROP TYPE` + `CREATE TYPE`) falhava porque a coluna `clients.stage` tem um valor `DEFAULT` que depende do tipo — corrigido adicionando `ALTER COLUMN stage DROP DEFAULT` antes de recriar o tipo e `SET DEFAULT` depois. Isso só foi descoberto rodando a migração de verdade contra um banco, não pela geração do SQL em si.
- `legacyId` com índice único (`clients_legacy_id_idx`) — é o que torna a importação idempotente.

**`app/api/admin/import/route.ts` — reconstruído por completo**
- Transacional: todos os inserts/updates de uma execução real (não-simulação) acontecem em uma única transação (`db.transaction`) — tudo ou nada.
- Idempotente via `legacyId`: reexecutar com os mesmos dados não duplica.
- Detecção de conflito: um registro editado no app desde a última importação (comparando `updated_at` com `imported_at`, gravados com o mesmo timestamp exato no momento da importação) é **pulado**, não sobrescrito, a menos que o payload traga `"overwrite": true` explicitamente.
- Modo `dryRun`: valida e relata (inserções, atualizações, conflitos, bloqueios) sem gravar nada.
- `legacyId` duplicado dentro do mesmo payload é rejeitado (400) antes de qualquer gravação.
- Limite de tamanho (5 MB) verificado tanto pelo header `Content-Length` quanto pelo tamanho real do corpo.
- `as never` removido — o mapeador agora produz um objeto já tipado compatível com o schema de inserção.
- Restrito e desativável: além do `IMPORT_SECRET` (quem pode chamar), agora existe `IMPORT_ENABLED` (se o endpoint faz alguma coisa) — depois da migração real, basta remover/zerar essa variável para desativar o endpoint permanentemente, mesmo que o secret vaze.

### Testes executados e resultados

**Migração real aplicada** contra Postgres local, com verificação da estrutura resultante:
```
$ npm run db:migrate
Verificando conexão com o banco...
Aplicando migrações...
Migrações aplicadas com sucesso.
Transação de verificação concluída com sucesso.

$ psql -c "select enum_range(null::stage);"
{nao_contatado,diagnostico_feito,visitado,whatsapp_enviado,ligacao_feita,reuniao_marcada,proposta_enviada,fechado,sem_interesse}
$ psql -c "select enum_range(null::priority);"
{alta,media,baixa,confirmar}
```

**Testes unitários do mapeamento** (dados sintéticos, nunca dados reais de clientes):
```
== import-mapping: enums nunca default silenciosamente ==
  OK   etapa conhecida mapeada corretamente
  OK   etapa desconhecida NAO vira nao_contatado silenciosamente
  OK   prioridade 'confirmar' preservada
  OK   prioridade desconhecida NAO vira media silenciosamente
== import-mapping: num() nao transforma null/'' em 0 ==
  OK   num(null) === null
  OK   num('') === null (bug original: Number('') === 0)
  OK   num('4.9') === 4.9 (preserva decimal)
== import-mapping: parseBoolean nao usa Boolean(v) ingenuo ==
  OK   parseBoolean('false') === false (bug original: Boolean('false') === true)
  OK   parseBoolean('sim') === true
== registro sem legacyId/stage/priority reconhecidos e' bloqueado ==
  OK   registro com etapa desconhecida NAO e' escrito (data === null)
  OK   historico legado preservado com autor real
```

**Testes HTTP reais do endpoint de importação** (`curl` contra o servidor rodando, Postgres real):
- Dry-run com 3 registros sintéticos (1 válido, 1 com etapa inventada, 1 sem nome) → `{"insert":1,"blocked":2}`, com o motivo exato de cada bloqueio — nada foi gravado (confirmado por `select count(*) from clients` = 0 depois).
- Import real do registro válido → `written:1`, `google_rating` chegou como `4.9` (decimal preservado).
- **Bug de idempotência encontrado e corrigido durante o teste**: reimportar o mesmo registro sem nenhuma edição no app relatava `skip_conflict` (falso positivo) — porque `updated_at` (gerado pelo `now()` do Postgres) e `imported_at` (gerado por `new Date()` no Node) nunca são exatamente iguais, mesmo que nada tenha mudado. Corrigido fazendo o `INSERT`/`UPDATE` gravar `updated_at` com o mesmo valor exato de `imported_at`, em vez de deixar o banco gerar o seu próprio. Depois da correção: reimportar um registro não tocado → `update` (não duplica, não gera falso conflito); editar o registro manualmente e reimportar → `skip_conflict` de verdade, nota preservada; reimportar com `overwrite:true` → sobrescreve, como esperado.
- `legacyId` duplicado no mesmo payload → 400, nada gravado.
- `IMPORT_ENABLED` não definido, mesmo com `IMPORT_SECRET` correto → 403 "import disabled".

**Reverificação na segunda rodada**, casos adicionais não cobertos na primeira vez, todos contra o endpoint real:
```
[5] Importação — sem secret / secret errado
  OK  - sem Authorization retorna 401
  OK  - secret errado retorna 401
[6] Importação — dry-run com dados sintéticos (nunca clientes reais)
  OK  - dry-run retorna 200; reporta 1 inserção válida; bloqueia os 3 registros inválidos; não grava nada
[7] Importação — execução real (dryRun:false)
  OK  - grava exatamente 1 registro (o único válido)
[8] Importação — reexecução idempotente
  OK  - reexecução sem alterações atualiza (update=1), não duplica (insert=0)
[9] Importação — edição manual no app não é sobrescrita sem overwrite:true
  OK  - cliente editado manualmente (campo "notes") após a importação: reimportar reporta skip_conflict,
       e o valor editado continua intacto no banco depois da tentativa
[10] Importação — legacyId duplicado no mesmo payload é rejeitado (400)
== payload > 5MB ==  status=413
== IMPORT_ENABLED=false, secret correto ==  {"error":"import disabled: defina IMPORT_ENABLED=true..."}
```

### Pendências reais

- **Nenhum dado real foi migrado.** O backup completo e atual do app antigo não foi recebido nesta sessão — só a referência de "128 clientes" foi mencionada, sem os dados. Ver `MIGRATION_NOTES.md` para o procedimento assim que o backup chegar, incluindo a reconciliação da contagem.
- Os mapas de alias (`STAGE_ALIASES`, `PRIORITY_ALIASES`, strings de booleano) foram escritos sem um export real para conferir contra — é bem provável que o primeiro dry-run real revele valores não cobertos ainda. Isso é esperado e é exatamente para isso que o relatório de inconsistências existe.

---

## Etapa 3 — Recuperar as funcionalidades

Ver `PARITY_MATRIX.md` para a matriz completa (recurso original / implementação atual / lacuna / teste de aceitação).

### Feito na primeira rodada
- CRM → Agenda (atrasados/hoje/próximos/sem-ação, priorização, registro de resultado + próxima ação, fuso America/Fortaleza).
- Proteção da exportação CSV contra injeção de fórmulas em planilhas.

### Feito nesta rodada

**Prospecção por nicho e fila semanal** (`app/(app)/prospeccao/page.tsx`, `lib/repo/clients.ts` → `getProspectionQueue()`) — nova tela que agrupa os leads ativos (não fechados/perdidos, não arquivados) por nicho, ordenados dentro de cada grupo pela fila de visita da semana (`visitOrder`, depois prioridade) — usando campos que já tinham sido preservados na migração (Etapa 2) mas que nenhuma tela expunha até agora. Testado contra dados reais no Postgres via requisição HTTP à página:
```
GET /prospeccao (sessão admin) → status=200
Ordem obtida dentro do nicho "alimentacao": Padaria Lua (visit_order=1), Padaria Sol (visit_order=2) — correto
```

**Propostas com revisões** (`lib/db/schema.ts` → tabela `proposals` nova, migração `drizzle/0002_loving_falcon.sql`; `app/actions/proposals.ts`; `components/proposal-panel.tsx`; `app/(app)/propostas/page.tsx`) — cada edição de uma proposta grava uma **nova linha** (nunca sobrescreve a anterior), encadeada por `rootId` e numerada por `revisionNumber`; um índice único parcial no banco (`proposals_latest_per_root_idx`, `WHERE is_latest = true`) garante, no nível do schema, que nunca existam duas revisões "atuais" simultâneas para a mesma proposta — não depende só da aplicação lembrar de desmarcar a anterior. Transições de status são restritas (`rascunho → enviada → aceita/recusada`; uma revisão fechada não volta atrás, uma nova oferta vira uma nova revisão). Permissão `proposal.manage` (admin/comercial) controla tanto o servidor quanto a exibição dos controles na UI. Testado de ponta a ponta com um navegador real (Playwright):
```
[15] Propostas — fluxo real via navegador (criar, enviar, aceitar, revisar)
  OK  - carregou a página do cliente
  OK  - proposta criada e exibida na página do cliente
  OK  - status inicial é 'Rascunho'
  OK  - status avançou para 'Enviada'
  OK  - status avançou para 'Aceita' (transição válida enviada->aceita)
  OK  - nova revisão criada e exibida como proposta atual
  OK  - nova revisão nasce como 'Rascunho' (não herda 'Aceita')
  OK  - histórico mostra a revisão anterior (Rev. 1, com status final 'Aceita')
[19] Propostas — RBAC na UI (papel 'producao' não deve ver controles de criação)
  OK  - botão 'Criar proposta' não é renderizado para o papel 'producao'
```
E a permissão em si (`can(role, "proposal.manage")`) testada unitariamente para os 4 papéis (admin/comercial: sim; producao/visitante: não).

**Backup completo em JSON + restauração validada** (`lib/backup.ts`, `app/api/backup/export/route.ts`, `app/api/backup/restore/route.ts`, `components/backup-restore-form.tsx`) — diferente do CSV (um subconjunto de colunas, sem relacionamentos) e diferente do importador legado (que remapeia um formato externo), este exporta **todas** as colunas de `clients`, `activities` e `proposals` preservando os IDs reais e as referências entre eles, e restaura por upsert-por-id dentro de uma transação, com:
- Modo `dryRun` (padrão) que só relata o que seria inserido/atualizado, sem gravar nada.
- Uma restauração real exige, além de `dryRun:false`, um campo `confirm` com um valor exato não adivinhável — defesa contra a restauração ser disparada por acidente (um `curl` reexecutado, por exemplo), já que ela pode sobrescrever registros atuais com a versão do backup.
- Depois de restaurar linhas com IDs explícitos, as sequences (`clients_id_seq` etc.) são reajustadas na mesma transação — sem isso, o próximo cliente criado manualmente colidiria com um ID restaurado.
- Restrito a admin (`backup.export`/`backup.restore`), com limite de tamanho de 20 MB.

Testado de ponta a ponta contra Postgres real, incluindo uma simulação de perda de dados completa:
```
[16] Backup completo — export: status=200, {clients:4, activities:4, proposals:2}
== apagando TUDO (simulando perda de dados) ==  TRUNCATE — 0 clientes restantes
[17] Restauração — dry-run contra banco vazio: {clients:{insert:4}, activities:{insert:4}, proposals:{insert:2}}
== restauração real SEM confirm ==  rejeitada: "restauração real requer o campo confirm..."
== restauração real, confirmada ==  {ok:true, summary:{...}}
== fidelidade total pós-restore ==
  clientes: mesmos 4 registros, mesmos IDs (1-4), mesmo niche/visit_order
  activities: mesmas 4 linhas, mesmo client_id (relacionamento preservado)
  proposals: cadeia de revisão intacta (rev.1 "aceita" + rev.2 "rascunho", is_latest correto em cada uma)
  sequence corrigida: um INSERT manual pós-restore recebeu o id 5 (sem colisão)
[18] RBAC no backup — papel 'comercial': export=403, restore=403
```

### Feito na terceira rodada — Contratos e Financeiro (assinaturas e cobranças)

Você aprovou seguir com os módulos restantes ("pode começar a fazer o que falta") e pediu especificamente uma parte de Financeiro para cobrar assinaturas de manutenção: um valor mensal, um valor anual à vista com desconto (equivalente a 2 mensalidades, por padrão), e cobranças avulsas de valor maior para ajustes fora do escopo do plano.

**Contratos** (`lib/db/schema.ts` → tabela `contracts`, migração `drizzle/0003_colossal_iron_man.sql`; `app/actions/contracts.ts`; `components/contract-panel.tsx`; `app/(app)/contratos/page.tsx`) — ciclo de vida `rascunho → enviado → assinado → encerrado`, com transições validadas no servidor (`VALID_TRANSITIONS`, a mesma técnica já usada e testada em Propostas). Este app **não assina nada eletronicamente** — não há integração com Clicksign/DocuSign nem armazenamento de arquivo assinado; "Registrar assinatura" grava a **evidência** de uma assinatura feita fora do app (nome de quem assinou, provedor, link/protocolo do documento) e move o contrato para "assinado". Um contrato pode nascer vinculado a uma proposta aceita (`proposalId`) — a tela do cliente já passa esse vínculo automaticamente quando existe uma proposta com status "aceita". Permissão `contract.manage` (admin/comercial).

**Financeiro — assinaturas** (`subscriptions`, `lib/repo/finance.ts`, `app/actions/finance.ts`, `components/finance-panel.tsx`) — cada assinatura guarda um valor mensal em centavos (nunca `float`, para não ter erro de arredondamento) e um número de meses de desconto no plano anual (`annualDiscountMonths`, padrão 2 — exatamente o "2 parcelas de desconto" pedido). O valor anual à vista é sempre **derivado** do mensal por `computeAnnualValueCents(monthlyValueCents, annualDiscountMonths) = monthlyValueCents * (12 - annualDiscountMonths)`, nunca digitado à parte — isso evita o valor anual e o mensal ficarem dessincronizados se um for editado sem o outro. O formulário mostra essa conta em tempo real antes de salvar. Pausar/reativar é operação comercial de rotina (`finance.manage`, admin+comercial); **cancelar é definitivo** e exige `finance.reconcile` (só admin) — a mesma separação "vender" vs. "conciliar dinheiro" usada nas cobranças abaixo.

**Financeiro — cobranças** (`financial_charges`) — cobre tanto a mensalidade/anual recorrente quanto o "ajuste eventual de valor maior" pedido: um tipo `ajuste` com valor livre, decidido por quem lança (o sistema não tenta adivinhar um multiplicador — cada ajuste é diferente). Ciclo de status `pendente → pago/atrasado/cancelado`, com duas proteções no servidor (não só escondidas na UI — ver "gap real encontrado" abaixo): uma cobrança **paga não pode ser revertida** ("lance um ajuste separado se necessário") e uma cobrança **cancelada não pode ser reaberta**. Lançar uma cobrança é `finance.manage`; marcar como paga/atrasada/cancelada (conciliação) é `finance.reconcile`, só admin. `/financeiro` (nova página) mostra MRR estimado (assinaturas mensais somadas integralmente + anuais divididas por 12), total de assinaturas ativas, e o que está pendente/atrasado a receber, com link para o cliente de cada item.

**Dois problemas reais encontrados durante o teste com navegador real** (não pelo `tsc`/build, que passavam sem acusar nada):
1. **`endDate` do contrato**: o formulário de criar contrato lia `formData.get("endDate")` mas não tinha nenhum campo `<input name="endDate">` — todo `POST` de criação de contrato falhava com `400` (`Expected string, received null`). Corrigido de duas formas: adicionado o campo "Término (opcional)" ao formulário (útil por si só — um contrato de manutenção costuma ter prazo), e endurecido `lib/validation.ts` com um helper (`optionalText`) que normaliza `null`/`undefined` para `""` antes de validar, para que um campo de formulário ausente vire "sem valor" em vez de derrubar a Server Action inteira — aplicado a todos os campos de texto opcionais novos (contrato, assinatura, cobrança).
2. **Cobrança "atrasada" ficava presa**: os botões de conciliação só apareciam para cobranças `pendente` — depois de marcar uma cobrança como "Atrasado", não havia como depois marcá-la como "Pago" pela UI (o servidor permitia a transição, a UI é que nunca oferecia o botão). Corrigido em `components/finance-panel.tsx` (mostrar "Marcar pago" também para `atrasado`, e adicionado "Cancelar" como ação de conciliação) e endurecido `app/actions/finance.ts` para tratar `cancelado` como estado terminal também no servidor (mesma proteção que já existia para `pago`).

Testado de ponta a ponta com um navegador real (Playwright), sessões reais no Postgres (uma por papel — admin/comercial/producao, sem passar pelo formulário de login em cada uma, usando o mesmo mecanismo de sessão real do app), contra o cliente de teste "Cliente Teste Financeiro":
```
== Contratos — ciclo de vida completo (admin) ==
  OK  contrato criado com status Rascunho
  OK  contrato -> Enviado
  OK  contrato -> Assinado (com signerName/provider/reference)
  OK  contrato -> Encerrado (estado terminal)
  OK  nenhum botão de transição após Encerrado — count=0
  OK  contrato com início/término: "Contrato com datas de início e término R$ 1.200,00 · início 2026-10-01 · término 2027-10-01" (bug do endDate, corrigido, reverificado)

== Financeiro — assinaturas ==
  OK  preview de valor anual aparece ao digitar o mensal — "Anual à vista: R$ 3.000,00 (equivalente a 10 mensalidades, 2 de desconto)"
  OK  preview de valor anual está correto (R$300 x 10 = R$3.000,00)
  OK  assinatura mensal criada (R$300,00/mês)
  OK  card da assinatura com ciclo anual mostra o valor anual calculado (R$ 3.000,00)
  OK  assinatura pausada / reativada — confirmado no banco (status ativa -> pausada -> ativa)

== Financeiro — cobranças ==
  OK  cobrança de mensalidade lançada (R$ 300,00)
  OK  cobrança de ajuste avulso lançada (R$ 850,00 — maior que a mensalidade, como pedido)
  OK  cobrança de mensalidade marcada como Pago
  OK  cobrança de ajuste marcada como Atrasado
  OK  botão 'Marcar pago' disponível para cobrança Atrasada (gap corrigido, reverificado)
  OK  cobrança antes Atrasada marcada como Pago com sucesso

== Verificação direta no Postgres (independente da UI) ==
  contracts: value_cents=300000 (R$3.000,00), status=encerrado, signer_name/signature_provider/signature_reference gravados, signed_at preenchido
  subscriptions: monthly_value_cents=30000 (R$300,00) nos dois planos, billing_cycle mensal/anual corretos, annual_discount_months=2
  financial_charges: mensalidade 30000 centavos / ajuste 85000 centavos, ambas status=pago, paid_at preenchido

== Guardas do servidor (defesa em profundidade — a UI nunca oferece o botão, testado chamando a Server Action diretamente com uma sessão real) ==
  OK  cobrança paga (#3) não pode reverter para pendente — "Uma cobrança já paga não pode ser revertida..."
  OK  cobrança cancelada (#4) não pode reabrir — "Uma cobrança cancelada não pode ser reaberta..."
  OK  assinatura cancelada (#2) não pode reativar — "Assinatura já cancelada — cancelamento é definitivo"
  OK  contrato encerrado (#1) não pode voltar para "assinado" — "Transição inválida: encerrado -> assinado"
  OK  papel 'producao' chamando createChargeAction é rejeitado no servidor — Error [ForbiddenError]: Sem permissão para: finance.manage (log real do servidor, não simulado)

== RBAC na UI (3 papéis) ==
  OK  comercial VÊ 'Nova assinatura' e 'Lançar cobrança / ajuste' (finance.manage inclui comercial)
  OK  comercial NÃO vê 'Cancelar' assinatura nem 'Marcar pago' (finance.reconcile é só admin)
  OK  comercial pode iniciar criação de contrato (contract.manage inclui comercial)
  OK  producao NÃO vê nenhum botão de criação/gestão em Contratos, Financeiro ou Propostas — só leitura
  OK  producao continua vendo os dados (não é bloqueio de página — é ocultação de controles de escrita)

== computeAnnualValueCents — casos de cálculo ==
  OK  R$300/mês, 2 meses de desconto -> 10 mensalidades = R$3.000,00
  OK  R$500/mês, 2 meses de desconto -> R$5.000,00
  OK  sem desconto -> 12 mensalidades = R$3.600,00
  OK  desconto máximo (11) -> 1 mensalidade = R$300,00
  OK  desconto >= 12 não fica negativo (clampado a 0 meses cobrados)
  OK  valor ímpar em centavos permanece exato (R$9,99/mês -> R$99,90, sem erro de ponto flutuante)
```

Navegação (`components/nav-shell.tsx`) reorganizada para caber os dois novos itens sem sobrecarregar a barra inferior do celular: a barra mobile agora mostra 4 itens fixos (Dashboard, CRM, Clientes, Financeiro) + um botão "Mais" que abre uma folha com o resto (Prospecção, Propostas, Contratos, Config.); a barra lateral do desktop passou a agrupar os itens por seção (Visão geral / Comercial / Financeiro / Sistema) em vez de uma lista única — solução que também acomoda os próximos módulos (Projetos, Ativos, Estratégia) sem precisar redesenhar de novo.

### Não feito — decisão de escopo pendente de confirmação

Estratégia comercial/demonstração, projetos e etapas de entrega, e ativos/links/domínios/renovações/acessos **ainda não foram implementados**. Contratos e Financeiro (que também estavam nesta lista) foram construídos nesta rodada — ver acima. Os três que restam ainda são, cada um, um módulo novo de verdade (modelo de dados, permissões e telas próprias). Sugestão de ordem, pela proximidade com o que já existe (contrato assinado → projeto de entrega → ativos do projeto): **Projetos → Ativos → Estratégia/demonstração** — mas a confirmação de prosseguir (e nessa ordem) continua em aberto.

---

## Etapa 4 — Correções funcionais

### Correções e arquivos afetados

**`lib/repo/clients.ts` — ordenação de prioridade**
- `listClients`/`getPriorityLeads` ordenavam por `desc(clients.priority)`, ordenando o **valor do enum como texto** — em ordem alfabética descendente isso produz `media, confirmar, baixa, alta`, ou seja, exatamente ao contrário do que faz sentido para o negócio (e ainda pior, dependendo da comparação, "baixa" podia aparecer antes de "alta"). Corrigido com uma expressão SQL `CASE` explícita derivada de `PRIORITIES` (a mesma fonte de verdade usada na UI), garantindo `alta → média → confirmar → baixa` sempre, sem depender da ordem alfabética do valor.

**`app/actions/clients.ts` — reescrito por completo**
- Validação de entrada em runtime em todas as ações, inclusive `updateStageAction` e `archiveClientAction` (antes recebiam `clientId`/`stage`/`archived` como argumentos posicionais sem nenhuma validação — agora usam `stageUpdateSchema`/`archiveClientSchema`).
- `toggleChecklistAction` usa merge atômico em JSONB (`checklist || jsonb_build_object(...)`) direto no `UPDATE`, em vez de ler-modificar-escrever em memória — duas alterações concorrentes em chaves diferentes do mesmo cliente não se perdem mais.
- Toda mutação grava a alteração e a entrada de histórico correspondente na mesma transação (`db.transaction`) — nunca uma sem a outra.
- Toda mutação verifica existência do registro (via `UPDATE ... RETURNING`, sem uma consulta separada antes) e a permissão correta da matriz antes de agir.
- `revalidatePath` cobrindo todas as telas afetadas por cada ação (incluindo `/crm/agenda`, novo).

**`scripts/migrate.ts` e `scripts/seed.ts`**
- `scripts/load-env.ts` (novo): carrega `.env`/`.env.local` manualmente antes de qualquer outra coisa — os scripts, rodados via `tsx` fora do Next.js, não tinham esse carregamento automático (só `next dev/build/start` fazem isso sozinhos), então `npm run db:migrate`/`db:seed` liam `DATABASE_URL` vazia num shell limpo.
- `scripts/seed.ts` não redefine mais senha/reativa o usuário a cada execução — só cria se não existir; redefinir exige `SEED_FORCE_RESET=true` explícito.
- `scripts/migrate.ts` verifica a conexão com uma consulta real antes de migrar, e roda uma transação de teste depois.
- `app/api/health/route.ts` — reescrito: agora distingue "processo está de pé" (`process.ok`, sempre `true` se o handler rodou) de "banco está acessível" (`database.ok`, com uma consulta real `select 1` sob timeout de 3s) — antes retornava sempre `{ok:true}` mesmo com o banco fora do ar.
- `DEPLOY.md` não recomenda mais enviar segredos junto com o zip — instrui a gerar valores novos e cadastrá-los direto no painel do Vercel.

### Testes executados e resultados

```
== ordenacao de prioridade (bug original: ordem alfabetica) ==
  OK   ordem correta alta,media,confirmar,baixa (nao alfabetica) — obtido: alta,media,confirmar,baixa
  OK   getPriorityLeads tambem respeita ordem correta (alta primeiro)
== atualizacao atomica de checklist (sem lost update) ==
  OK   ambas as chaves do checklist sobrevivem a escrita concorrente (sem read-modify-write em memoria)
  OK   UPDATE...RETURNING em cliente inexistente retorna 0 linhas (base da checagem de existencia nas actions)
```

`scripts/seed.ts` rodado de verdade contra um shell limpo (sem `DATABASE_URL` no ambiente, só em `.env.local`):
```
$ npx tsx scripts/seed.ts
Usuário admin criado: admin@ivs.test
$ npx tsx scripts/seed.ts   # segunda execução
Usuário já existe: admin@ivs.test (role: admin, active: true). Nada foi alterado.
```

`api/health` com banco de verdade no ar:
```
{"process":{"ok":true},"database":{"ok":true,"latencyMs":25},"time":"..."}
```

Criação de cliente e mudança de etapa via UI real (Playwright), com verificação direta no banco — ver trecho na Etapa 1.

**Reverificação na segunda rodada** (banco recriado do zero):
```
[2] Concorrência no checklist (merge JSONB atômico)
  OK  - chave 'diagnosisDone' preservada após 3 updates concorrentes
  OK  - chave 'proposalSent' preservada após 3 updates concorrentes
  OK  - chave 'contractClosed' preservada após 3 updates concorrentes
[3] Ordenação de prioridade (não alfabética)
  OK  - ordem retornada é [alta, media, confirmar, baixa]
[4] Agenda — bucketing por fuso America/Fortaleza
  OK  - data de ontem cai em 'atrasado'; hoje em 'hoje'; futura em 'proximo'; sem data em 'sem_acao'
  OK  - string vazia normaliza para null (não 'Invalid Date')
```

### Pendências reais

Nenhuma pendência real conhecida nesta etapa — todos os itens pedidos foram implementados e testados com evidência real, nas duas rodadas.

---

## Etapa 5 — Logo, PWA e APK

### Logo

**Não aplicada.** A logo oficial da IVS não foi obtida nesta sessão — a extração dependia de acesso a um navegador conectado que não pôde ser selecionado automaticamente, e a tarefa foi explicitamente adiada por você anteriormente. O app continua com o monograma provisório ("IVS" em texto), que **não é apresentado como logo oficial** em nenhum lugar do código ou da documentação.

### PWA

Validado nesta sessão, com as ressalvas abaixo:
- Manifesto, ícones, escopo e service worker revisados no código (ver Etapa 1 para a reescrita do `sw.js`).
- Login, logout, reconexão (nova navegação após login) e o fato de que `/dashboard` volta a exigir login depois do logout — testados via navegador real (Playwright), com evidência no relatório da Etapa 1.
- Dados privados não reaparecem offline após logout: garantido pela reescrita do `sw.js` (navegações nunca são cacheadas — ver Etapa 1) — **não foi testado literalmente "desconectar da rede depois de logout e verificar que a tela anterior não aparece"**, porque isso exige simular perda de rede num navegador com sessão ativa e depois logout, o que não foi executado nesta rodada.
- **Instalação (`beforeinstallprompt`/`appinstalled`), teste em aparelho físico real (Android/iPhone) e o comportamento de recusa/falha do prompt de instalação não foram testados** — o ambiente desta sessão é um navegador headless em sandbox, sem um celular real disponível. Esta é uma distinção que a própria revisão pediu para não confundir: **teste automatizado (feito) ≠ teste em aparelho físico real (não feito)**.

### APK

**Não iniciado**, por dois motivos que se reforçam:
1. A pré-condição da própria revisão ("só depois prepare o APK") — validação completa da PWA em aparelho físico real — ainda não aconteceu.
2. Construir um APK contradiz a decisão técnica tomada no início deste projeto (PWA em vez de wrapper nativo/Capacitor, justamente para evitar a complexidade de assinatura, pipeline de build e distribuição de um APK) sem que uma necessidade concreta e nova tenha sido demonstrada. A própria instrução de entrega deste pacote pede para não trocar de abordagem de novo sem justificar. Por isso, antes de gerar qualquer artefato de APK, a pergunta fica em aberto: **surgiu uma necessidade concreta (ex: uma limitação real da PWA que apareceu no uso) que justifique isso agora?**

### Pendências reais

- Logo oficial (bloqueada em acesso a navegador/arquivo).
- Teste de PWA em aparelho físico real.
- Toda a etapa de APK (assinatura persistente, GitHub Actions, artefato assinado com checksum) — não iniciada, aguardando a confirmação acima.

---

## Etapa 6 — Domínio, gestão de equipe e vínculo assinatura↔contrato

Pedido: "coloque o nome do domínio de app.imperiovisionario.com.br e coloque também uma forma de adicionar integrantes para ter acesso, e veja a questão que te passei sobre assinatura de clientes".

### Domínio (`app.imperiovisionario.com.br`)

O que dava para fazer em código foi feito:
- `app/layout.tsx`: `metadataBase` agora aponta para `https://app.imperiovisionario.com.br` (usado como base para gerar URLs absolutas de metadados/PWA), com override opcional via `NEXT_PUBLIC_APP_URL` para quem quiser testar em outro domínio sem editar código.
- Como o app é uma ferramenta interna de CRM (não uma página pública), adicionei `robots: { index: false, follow: false, nocache: true }` nos metadados e um `public/robots.txt` bloqueando indexação — proteção proativa para que o painel nunca apareça em buscadores, mesmo que o domínio vaze publicamente. Isso não estava pedido, mas segue a diretriz de segurança do projeto.

O que **não dá para fazer por código**: anexar de fato o domínio a um projeto Vercel é uma ação de conta (Settings → Domains, ou DNS externo) — não existe uma chamada de API/MCP disponível nesta sessão para isso. `DEPLOY.md` (seção 4) tem o passo a passo exato, incluindo como descobrir se a Vercel já controla o DNS de `imperiovisionario.com.br` (caso em que ela mesma resolve o subdomínio) ou se é preciso cadastrar um CNAME manualmente em outro provedor. Também confirmei, via consulta somente-leitura à API da Vercel, que a única conta/projeto existente é o site institucional (outro repositório) — o IVS Central precisa de um projeto novo, e o `DEPLOY.md` já reflete isso. Se você subir o código para um repositório no GitHub e me passar o nome, posso conectar esse projeto novo à Vercel automaticamente (`create_git_project`); o domínio em si, porém, exige uma ação sua no painel.

### Gestão de equipe (novo)

Antes desta etapa, a única forma de criar um usuário era rodar `scripts/seed.ts` manualmente (linha de comando, servidor) — não havia nenhuma tela para isso, confirmado por busca no código antes de implementar.

Implementado:
- `lib/repo/users.ts` — leitura de usuários sempre excluindo `passwordHash` das colunas retornadas (nunca trafega hash de senha para o cliente).
- `app/actions/users.ts` — `createUserAction`, `updateUserRoleAction`, `updateUserActiveAction`, `resetUserPasswordAction`. Todas exigem a permissão `user.manage` (só `admin`) e bloqueiam uma conta agir sobre si mesma (o próprio admin não muda seu papel/senha por esta tela — isso continua em Configurações → Segurança). Desativar um usuário revoga todas as sessões dele na hora.
- Senha temporária gerada com `crypto.randomBytes(18)` (~144 bits de entropia, 24 caracteres), exibida **uma única vez** na tela para o admin copiar e repassar manualmente — o app não envia e-mail nem qualquer mensagem automática para ninguém, mantendo a regra de nunca convidar sem autorização explícita seguida durante todo o projeto (isso vale também para o acesso da Jeisyelle: a tela está pronta, mas nenhuma conta foi criada).
- `components/team-panel.tsx` + card "Equipe" em `app/(app)/configuracoes/page.tsx`, visível só para quem tem `user.manage`.

**Evidência real (Playwright, navegador real, sessões reais via cookie de sessão do próprio app — não mock), rodada nesta verificação final:**
```
[OK] admin VÊ o card 'Equipe'
[OK] senha temporária exibida após criar integrante — len=24
[OK] novo integrante aparece na lista
[OK] integrante desativado com sucesso
[OK] integrante reativado com sucesso
[OK] redefinição de senha exibe nova senha temporária
[OK] admin NÃO consegue alterar o próprio papel/senha por esta tela (self-guard) — count=0
[OK] comercial NÃO vê o card 'Equipe' (user.manage é só admin) — count=0
```
Confirmado também diretamente no banco (`psql`, fora da aplicação) que o papel do novo usuário mudou de `producao` para `comercial` e que ele ficou `active = true` após o ciclo desativar/reativar — ou seja, o estado final bate com o que a tela mostrou, não é só aparência de UI.

**Limitação honesta, não escondida:** existe também uma proteção de "não desativar o último admin ativo" (`countActiveAdmins`), pensada como defesa em profundidade. Na prática, pelo único caminho de entrada desta tela (um admin agindo sobre outra conta), essa proteção nunca chega a ser acionada de verdade — porque o bloqueio "não pode agir sobre si mesmo" já impede o único cenário em que ela seria testável (um admin tentando se autodesativar sendo o último admin). Ela fica pronta para um caminho futuro (ex.: uma ação em lote) mas não foi exercitada por um teste real nesta rodada, e não estou afirmando que foi.

### Assinatura vinculada a contrato (retomando o Financeiro já entregue)

O módulo Financeiro (assinaturas mensais/anuais com desconto, cobranças avulsas) já tinha sido implementado e testado na rodada anterior. Ao revisar de novo o pedido, o ponto que faltava era: uma assinatura de manutenção normalmente nasce de um contrato já assinado ("fechou o site, e a manutenção dele"), mas não havia como registrar essa relação — cada assinatura ficava solta, sem apontar para o contrato de origem.

Implementado:
- `subscriptions.contractId` (coluna já existia no schema, mas não era exposta em lugar nenhum da interface — agora é).
- `NewSubscriptionForm` mostra um seletor "Vincular a um contrato (opcional)" — só aparece quando o cliente já tem contrato assinado/encerrado, e é sempre opcional (uma assinatura sem contrato prévio continua válida).
- O card da assinatura mostra o contrato vinculado quando houver.

**Evidência real** (mesmo teste acima, mesma sessão de navegador):
```
[OK] formulário de assinatura mostra seletor de contrato (contrato assinado existe)
[OK] card da assinatura mostra o contrato vinculado
```
E verificado diretamente no banco: `SELECT id, name, contract_id FROM subscriptions` retornou `contract_id = 1`, batendo com o contrato assinado criado no cenário de teste — confirma que o vínculo é persistido de verdade, não é só texto exibido na tela.

### Pendências reais desta etapa

- Anexar o domínio ao projeto Vercel — ação de painel/DNS, não automatizável daqui (passo a passo em `DEPLOY.md`, seção 4).
- Guarda de "último admin ativo" implementada mas não exercitável pelo único caminho de entrada atual — ver nota acima.

---

## Etapa 7 — Ativos e progresso de entrega

Pedido do cliente: acompanhar, por cliente, o que já foi entregue e o que falta (site, landing page, Instagram etc.), além dos acessos e links de cada coisa. Antes de desenhar do zero, fui ver o Notion da agência — havia lá uma base chamada "Ativos, links e acessos" já em uso, com categorias, status e campos pensados e testados na prática (inclusive a regra de nunca guardar a senha em texto, só um link para o cofre). O modelo de dados novo (`assets`) foi construído em cima dessa base, não inventado — mesmas 18 categorias, mesmos 6 status de progresso, mesmos campos.

Implementado:
- Tabela `assets`: categoria, status (a configurar → em configuração → ativo/em manutenção, ou pendente do cliente/cancelado), link principal, link administrativo, link do cofre de senha, login/e-mail, domínio/identificador, plataforma, valor recorrente, data de renovação, confirmação de backup, aprovação do cliente, responsável, observações.
- Card "Ativos e progresso de entrega" na página do cliente: barra de progresso ("X de Y prontos"), lista de ativos com badge de status, link clicável, renovação e valor recorrente; formulário de criação; troca de status e os dois checkboxes (backup/aprovação) inline, restrito a quem tem a permissão `asset.manage` (admin, comercial, produção — mesmo conjunto de papéis que já mexe no checklist de produção).
- Página `/ativos` (nova, no menu): visão geral com KPIs (total, pendentes, renovações em 30 dias, ativos), lista de pendências por cliente e lista de renovações próximas.
- Sem exclusão — como em todo o resto do app, um ativo que não faz mais sentido vira `cancelado`, nunca é apagado.

**Dois problemas reais encontrados durante o teste com navegador real, corrigidos antes da entrega** (não só descobertos e anotados — corrigidos e testados de novo):

1. **Sem feedback visual imediato.** Ao trocar o status ou marcar um checkbox, o controle ficava "preso" no valor antigo até a Server Action terminar e a rota revalidar — numa conexão mais lenta, parece que o clique não fez nada. Corrigido adotando `useOptimistic` (mesmo padrão já usado no `ChecklistWidget`), para o controle responder na hora enquanto a gravação acontece em segundo plano.
2. **Revalidação incompleta.** `updateAssetAction`, `updateAssetStatusAction` e `updateAssetFlagAction` revalidavam `/ativos` (e, no caso do status, `/clientes`), mas não a página específica do cliente (`/clientes/[id]`) de onde a maioria das ações realmente acontece. Um `reload()` completo mascarava isso, porque essa página usa `force-dynamic` e busca tudo de novo do zero — mas uma navegação interna (sair e voltar sem recarregar) podia mostrar dado desatualizado. Corrigido para revalidar também a página do cliente, no mesmo padrão já usado em `createAssetAction`.

**Evidência real** (banco Postgres real recriado do zero, migração `0004_fair_iron_monger.sql` aplicada, `npm run build` limpo, `next start` real, Playwright contra o navegador real — não simulação):

```
OK   — Login admin
OK   — Estado vazio do card Ativos
OK   — Criação de ativo 1/3 (Site institucional)
OK   — Criação de ativo 2/3 (Landing page)
OK   — Criação de ativo 3/3 (Instagram)
OK   — Barra de progresso inicial em 0%
OK   — Transição de status 1/2 (a_configurar -> em_configuracao)
OK   — Transição de status 2/2 (em_configuracao -> ativo)
OK   — Checkbox 'Backup confirmado' marcado (UI)
OK   — Checkbox 'Aprovado pelo cliente' marcado (UI)
OK   — Status persistiu após reload
OK   — Backup confirmado persistiu após reload
OK   — Aprovação do cliente persistiu após reload
OK   — Barra de progresso em 33% após 1 de 3 'ativo'
OK   — /ativos lista pendências (Landing page ainda pendente)
OK   — /ativos lista renovações próximas
OK   — /ativos KPI 'Total de ativos' = 3
OK   — /ativos KPI 'Pendentes' = 2
OK   — /ativos KPI 'Ativos' = 1
```

Confirmado também de forma independente da UI, direto no banco:
```
 id |          name           |   category   | status | backup_confirmed | client_approval
----+--------------------------+--------------+--------+-------------------+------------------
 10 | Site institucional       | site         | ativo  | t                 | t
 11 | Landing page - campanha  | landing_page | a_configurar | f          | f
 12 | Instagram                | instagram    | a_configurar | f          | f
```
E o log de atividades do cliente registrou cada criação e mudança de status, com autor e data — mesma convenção já usada no resto do app.

**RBAC testado** com um usuário do papel `visitante` (sem a permissão `asset.manage`):
```
OK   — Login visitante
OK   — Visitante ENXERGA os ativos existentes (leitura permitida)
OK   — Visitante NÃO vê botão 'Adicionar ativo'
OK   — Visitante NÃO vê <select> de status do ativo
OK   — Visitante NÃO vê checkboxes de gestão do ativo
```
A checagem que realmente importa não é a UI escondida (isso é só a experiência) — é que as quatro Server Actions em `app/actions/assets.ts` chamam `requirePermission("asset.manage")` como a primeira linha, incondicionalmente, antes de validar ou tocar no banco. Mesmo que alguém forjasse uma chamada direta ignorando a UI, o servidor rejeita.

### Pendências reais desta etapa

- Sem lembrete automático (e-mail/push) quando uma renovação se aproxima — hoje precisa abrir `/ativos` para ver. Fica como ideia para uma próxima rodada, não implementado.
- Módulos #9 (Estratégia/demonstração comercial) e #12 (Projetos e etapas de entrega) continuam fora do escopo desta rodada — ver `PARITY_MATRIX.md`.

---

## Etapa 8 — Pagamento parcial/total/cartão, gastos e lucro

Pedido do cliente: no Financeiro, poder registrar pagamento total, parcial ou no cartão de crédito, e acrescentar gastos, ganhos, lucro, faturamento total e líquido. Antes de sair implementando, revi o schema existente (`financial_charges`) e uma decisão ficou clara: hoje uma cobrança só tem dois estados de dinheiro — "pendente" ou "pago" — sem nenhum registro de quanto, quando ou como o dinheiro entrou. Não dava pra simplesmente somar cobranças "pagas" para calcular faturamento, porque nada garantia que uma cobrança marcada "paga" correspondesse a um recebimento real.

**Decisão de arquitetura** (a mais importante desta etapa): criei um ledger de recebimentos (`charge_payments`) em vez de um único campo "valor recebido" na cobrança. Motivo — o próprio pedido já mostra por quê: um cliente pode pagar a entrada via Pix e o saldo no cartão depois, ou pagar em três parcelas soltas ao longo do mês. Um campo único não guarda isso; um ledger guarda cada recebimento com sua própria forma de pagamento, parcelas (cartão) e taxa descontada, e o status da cobrança ("parcial"/"pago") passa a ser **sempre calculado a partir da soma desses recebimentos, nunca digitado à mão**. Isso substituiu o antigo botão "marcar pago" manual — que agora só aceita "atrasado"/"cancelado", porque virar "pago" sem um recebimento registrado por trás deixaria o faturamento do painel mentindo.

Implementado:
- `charge_payments`: valor recebido, forma de pagamento (Pix, cartão de crédito com parcelas, cartão de débito, boleto, dinheiro, transferência, outro), taxa da maquininha descontada (valor em reais, não percentual — quem lança já sabe o que a operadora cobrou), data e observação.
- No card de cada cobrança: botão "Registrar pagamento" (só quem concilia o financeiro) que abre um formulário com o valor já pré-preenchido com o saldo restante — um clique fecha o pagamento total, editar o valor faz um parcial. Histórico dos recebimentos listado logo abaixo, com status "Parcial" mostrando "Recebido RX de RY".
- `expenses` (Gastos): categoria (equipe/folha, ferramentas/software, mídia paga, impostos, escritório, comissões, outro), valor, data, sinalizador de recorrente, sem exclusão (vira "cancelado", mesma convenção do resto do app). Deliberadamente sem `clientId` — gasto é da agência, não de um cliente.
- Painel `/financeiro`: nova seção "Faturamento e lucro" do mês atual — faturamento bruto (soma dos recebimentos reais, não das cobranças lançadas), taxas descontadas, faturamento líquido (bruto − taxas), gastos, lucro líquido (líquido − gastos) — **visível só para quem concilia o financeiro** (hoje só admin), porque é dado de margem, sensível, não faz sentido todo vendedor ver.
- Permissão: reaproveitei `finance.reconcile` (já existia, admin-only) para registrar pagamento e gerir gastos, em vez de criar uma permissão nova — é a mesma natureza de decisão ("dinheiro de verdade entrando/saindo", separado de "vender/lançar") que já regia marcar pago/atrasado/cancelado.

**Evidência real** (banco Postgres real recriado do zero, migração `0005_luxuriant_the_captain.sql` aplicada — inclui `ALTER TYPE charge_status ADD VALUE 'parcial'`, testado dentro de transação real, não só gerado —, `npm run build` limpo, `next start` real, Playwright contra navegador real):

Cenário 1 — espelhando o processo real da agência que encontrei no Notion ("Investimento: R$1.490, 50% na contratação, 50% na entrega"): cobrança de R$1.490,00 recebida em duas partes.
```
OK   — Cobrança de R$ 1.490,00 visível, status Pendente
OK   — Após entrada de 50% via Pix, status vira Parcial
OK   — Mostra 'Recebido R$ 745,00 de R$ 1.490,00'
OK   — Formulário pré-preenche o saldo restante (745,00)
OK   — Após saldo via cartão, status vira Pago
OK   — Histórico mostra pagamento via Pix
OK   — Histórico mostra pagamento via cartão de crédito (3x)
OK   — Histórico mostra a taxa descontada
OK   — Status 'Pago' persistiu após reload
OK   — Botão 'Registrar pagamento' some após quitação total
OK   — Gasto lançado aparece na lista
OK   — KPI Faturamento bruto = R$ 1.490,00
OK   — KPI Taxas descontadas = R$ 22,35
OK   — KPI Faturamento líquido = R$ 1.467,65
OK   — KPI Gastos = R$ 199,90
OK   — KPI Lucro líquido = R$ 1.267,75
```
Confirmado também de forma independente da UI, direto no banco: `financial_charges` com `status='pago'`, e `charge_payments` com as duas linhas (74500 via pix, 74500 via cartao_credito com `installments=3` e `fee_cents=2235`) somando exatamente os 149000 centavos da cobrança.

Cenário 2 — três recebimentos parciais sucessivos numa segunda cobrança (R$900,00, R$300 de cada vez, formas de pagamento diferentes), para provar que o ledger realmente acumula ao longo do tempo e não só no caso de "duas partes":
```
OK   — Segunda cobrança (R$ 900,00) criada
OK   — Após 1º pagamento (R$300), status Parcial
OK   — Recebido R$ 300,00 de R$ 900,00
OK   — Saldo restante pré-preenchido (600,00) após 1ª parcela
OK   — Após 2º pagamento (R$300), ainda Parcial (600 de 900)
OK   — Saldo restante pré-preenchido (300,00) após 2ª parcela
OK   — Após 3º pagamento, status vira Pago
OK   — Histórico lista as 3 entradas (dinheiro, transferência, boleto)
```
Confirmado no banco: três linhas em `charge_payments` (30000 cada, via dinheiro/transferência/boleto) somando os 90000 centavos exatos da cobrança.

**RBAC testado** com um usuário do papel `comercial` (tem `finance.manage`, não tem `finance.reconcile`):
```
OK   — Comercial ENXERGA a cobrança (leitura permitida)
OK   — Comercial NÃO vê 'Registrar pagamento' (é finance.reconcile, não finance.manage)
OK   — Comercial AINDA vê 'Lançar cobrança / ajuste' (finance.manage continua liberado)
OK   — Comercial NÃO vê a seção 'Faturamento e lucro' (dado sensível, admin-only)
OK   — Comercial NÃO vê 'Gastos da agência'
```
A guarda que importa de verdade está no servidor: `recordChargePaymentAction` e as ações de gasto chamam `requirePermission("finance.reconcile")` como primeira linha, antes de qualquer validação ou acesso ao banco — a UI escondida é só a experiência, não a segurança. A mesma função também rejeita (com erro claro) registrar um novo pagamento contra uma cobrança já "paga" ou "cancelada" — mesmo padrão de guarda de estado terminal já usado e testado no restante do financeiro.

### Pendências reais desta etapa

- Sem emissão de boleto/link de pagamento — continua sendo registro manual do recebimento, não uma integração com meio de pagamento (nenhuma mudança em relação ao que já era assim para cobrança/pago antes).
- Um gasto marcado "recorrente" é só um sinalizador informativo hoje — não gera automaticamente o lançamento do mês seguinte. Fica como ideia para uma próxima rodada.
- A correção de um recebimento lançado por engano (valor errado, forma errada) não tem uma tela própria ainda — hoje seria um ajuste manual direto no banco. Como o pedido não mencionou isso e é um caso raro, não implementei, mas é a lacuna mais provável de aparecer no uso real.

---

## Pacote atualizado

O zip anexado a esta entrega:
- Não contém nenhum segredo real (verificado por busca em todos os arquivos de texto do projeto — nenhuma chave AWS/PEM/API key, e nenhuma credencial de teste desta rodada chegou a entrar em nenhum arquivo do pacote; todo script temporário de teste e o `.env.local` usado para rodar contra o Postgres local foram removidos antes de empacotar).
- Inclui as seis migrações (`0000_special_bastion.sql` a `0004_fair_iron_monger.sql`, já aplicadas; `0005_luxuriant_the_captain.sql`, nova nesta rodada — adiciona `charge_payments`, `expenses`, e o valor `'parcial'` ao enum de status de cobrança).
- Build de produção limpo (`npm run build`) confirmado sem erros nem avisos de tipo, 21 rotas de aplicação, e um boot real com `next start` contra Postgres.
- `npx tsc --noEmit` confirmado limpo (sem erros de tipo) após todas as mudanças desta rodada (pagamento parcial/total/cartão, gastos e lucro).
- Nesta rodada: banco recriado do zero, migrações reaplicadas (incluindo o `ALTER TYPE ... ADD VALUE` dentro de transação real, não só gerado), e a suíte de evidência do módulo financeiro ampliado (dois cenários de recebimento + RBAC) rodada contra esse banco limpo (resultado na Etapa 8) — não é só reaproveitamento de teste antigo.
- Inclui este relatório, `MIGRATION_NOTES.md`, `PARITY_MATRIX.md`, `DEPLOY.md` e `ANALISE_COMPETITIVA.md`, atualizados/incluídos.
