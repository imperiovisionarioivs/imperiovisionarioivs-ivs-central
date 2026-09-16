# Notas de migração de dados — IVS Central

## Estado atual (pendência real)

**Nenhum cliente real foi migrado para o novo sistema nesta sessão.** O backup completo e atual do app antigo (ChatGPT-hosted) não foi recebido — apenas o número de referência "128 clientes" foi mencionado em conversas anteriores, sem os dados em si. Importar a partir de uma lista desatualizada do Notion, ou de qualquer fonte que não seja o backup real e completo, foi explicitamente descartado por instrução direta: **não inventar clientes reais**.

O que foi feito em vez disso, para não bloquear o resto do trabalho:
- O importador (`app/api/admin/import/route.ts`, `lib/import-mapping.ts`) foi reconstruído do zero para ser transacional, idempotente (upsert por `legacyId`), com modo de simulação (`dryRun`) e relatório completo de inconsistências.
- Foi testado com **dados sintéticos** (registros inventados só para teste, nunca dados de clientes reais) — ver `REVIEW_REPORT.md`, seção Etapa 2, para os comandos e resultados exatos.
- O schema (`lib/db/schema.ts`) foi estendido para preservar todos os campos que a importação anterior descartava (ver lista abaixo).

## O que preservar quando o backup real chegar

Todos estes campos já existem no schema e no mapeador — a única pendência é ter os dados de origem reais para alimentá-los:

- Todas as 9 etapas do funil (não só um subconjunto): não contatado, diagnóstico feito, visitado, WhatsApp enviado, ligação feita, reunião marcada, proposta enviada, fechado, sem interesse.
- Todas as 4 prioridades: alta, média, baixa, confirmar.
- Histórico original com autor e data reais de cada evento (não a data de importação).
- Serviços recomendados e diagnóstico digital.
- Situação e data da pesquisa; confirmação presencial.
- Campanha, ordem de visita, dia sugerido.
- Último contato (data e resultado), próximo retorno, etapa do follow-up.
- Canal preferido, objeção, responsável.
- Qualificação comercial (campo livre, preservado como veio).
- Link do Notion e identificador original (`legacyId`) de cada cliente.
- Todos os checklists, incluindo chaves que o app atual não reconhece (preservadas verbatim, mesmo que não apareçam na UI de checklist).
- Nota de avaliação do Google como decimal (ex: 4,9), distinguindo "sem nota" de "nota zero".

## Passo a passo quando o backup real estiver disponível

Ver `DEPLOY.md`, seção 6, para o procedimento completo (simulação → revisão do relatório → reconciliação da contagem → importação real → desativar o endpoint).

## Provisionamento de acesso pendente (não executado)

A conta `jeisyellensilva@gmail.com` foi autorizada como **visitante** (somente leitura) no sistema anterior. Essa autorização não migra automaticamente — o papel "visitante" já existe no novo sistema (somente leitura em todas as telas, sem nenhuma permissão de escrita — ver `lib/permissions.ts`), mas **nenhum usuário foi criado e nenhum convite ou mensagem foi enviado** para esse e-mail, por instrução explícita de não fazer isso sem autorização direta. Quando autorizado, criar o usuário é uma inserção simples na tabela `users` com `role: "visitante"` (não há UI de "criar usuário" ainda — ver pendências em `REVIEW_REPORT.md`).

## Backup completo (JSON) e exportação CSV

- A exportação CSV (`/api/export/clients.csv`, restrita a admins) inclui um subconjunto de colunas e está protegida contra injeção de fórmulas em planilhas (um valor começando com `=`, `+`, `-`, `@`, tab ou CR é prefixado com `'` antes de ser escrito).
- Um backup **completo** em JSON (todas as colunas, incluindo relacionamentos com atividades) e uma restauração validada a partir dele **ainda não foram implementados** — é uma pendência real, listada em `REVIEW_REPORT.md`.
