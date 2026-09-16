# IVS Central — Deploy em produção

Este pacote passou por uma revisão de segurança e migração de dados (ver `REVIEW_REPORT.md` para o relatório completo, correção por correção, com evidências de teste).

**Antes de publicar, leia:**
- `REVIEW_REPORT.md` — o que foi corrigido, o que foi testado (com evidências reais, não apenas "o build passou"), e as pendências reais que ainda restam.
- `MIGRATION_NOTES.md` — estado da migração de dados: nenhum cliente real foi migrado ainda, porque o backup completo do app antigo não foi recebido nesta sessão.

**Importante sobre o time/projeto Vercel:** sua conta Vercel (time "Império Visionario IVS") já tem um projeto — mas é o **site institucional** (imperiovisionario.com.br / www, outro repositório, outro framework). O IVS Central é uma aplicação separada e precisa de um **projeto Vercel novo e próprio**, publicado num subdomínio (`app.imperiovisionario.com.br`) — os passos abaixo criam esse projeto novo, sem tocar no site institucional.

## 1. Criar o repositório no GitHub

1. Acesse https://github.com/new
2. Nome: `ivs-central` (ou outro de sua preferência — só não use o nome do repositório do site institucional)
3. Visibilidade: **Private**
4. Não marque nenhuma opção de inicialização (sem README, sem .gitignore)
5. Clique em **Create repository**

## 2. Subir o código

Na página do repositório recém-criado, clique em **uploading an existing file**, e arraste **todo o conteúdo deste zip já descompactado** (a pasta inteira, não o .zip) para a área de upload. O Chrome/Edge preservam a estrutura de pastas ao arrastar uma pasta.

Se preferir usar git na sua máquina:
```bash
unzip ivs-central.zip -d ivs-central
cd ivs-central
git init
git add .
git commit -m "Initial commit — IVS Central"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/ivs-central.git
git push -u origin main
```

O `.gitignore` já exclui `.env*` reais, backups (`*-backup.json`, `clientes*.json`), CSVs e chaves de assinatura — confira `git status` antes do commit se tiver dúvida sobre o que está sendo enviado.

Depois de subir o repositório, se quiser, me diga o nome dele (`seu-usuario/ivs-central`) que eu crio e conecto o projeto Vercel automaticamente (mesmo efeito do passo 3 abaixo, sem precisar clicar em nada no painel) — o deploy em si continua exigindo os passos 4-6 (domínio, banco, variáveis), que só você pode fazer.

## 3. Importar no Vercel

1. Acesse https://vercel.com/new
2. Selecione o time **Império Visionario IVS**
3. Escolha o repositório `ivs-central` e clique em **Import** — **não** escolha o projeto existente do site institucional, isso criaria um projeto novo do zero
4. Em **Environment Variables**, adicione (veja seção 5 abaixo)
5. Clique em **Deploy**

## 4. Domínio (app.imperiovisionario.com.br)

1. No projeto novo (o do IVS Central, não o do site institucional) → **Settings → Domains → Add**.
2. Digite `app.imperiovisionario.com.br` e confirme.
3. A Vercel mostra na hora qual registro de DNS falta:
   - Se `imperiovisionario.com.br` já usa os **nameservers da Vercel** (provável, já que o site institucional está na mesma conta) — a Vercel configura o subdomínio sozinha, sem você tocar em DNS externo.
   - Se o DNS é gerenciado em outro provedor (Registro.br, Cloudflare, etc.) — a Vercel mostra um registro **CNAME** (`app` → o alvo exato que ela indicar na tela, não necessariamente `cname.vercel-dns.com` — use o valor mostrado ali) para você cadastrar nesse provedor.
4. Aguarde a propagação (minutos a poucas horas) — a própria tela de Domains mostra quando o certificado SSL for emitido e o domínio ficar "Valid Configuration".

Isso não altera nada em `imperiovisionario.com.br`/`www` — eles continuam apontando para o site institucional, sem interrupção.

## 5. Banco de dados e variáveis de ambiente

O app precisa de um Postgres. Forma mais simples:

- No próprio projeto Vercel: **Storage → Create Database → Postgres** (Neon, incluso no plano Hobby)
- Copie a `DATABASE_URL` gerada

Variáveis de ambiente a configurar no projeto (Settings → Environment Variables). O arquivo `.env.local.example` traz os nomes; **gere os valores você mesmo** (nunca reaproveite segredos de exemplo ou de outro projeto, e nunca envie os valores reais por e-mail/chat/arquivo compartilhado):

| Variável | Valor | Como gerar |
|---|---|---|
| `DATABASE_URL` | connection string do Postgres | copiada do passo acima |
| `ADMIN_EMAIL` | seu e-mail de acesso | — |
| `ADMIN_PASSWORD` | senha do admin inicial | `openssl rand -base64 24` — troque pelo próprio app (Configurações → Segurança) depois do 1º login |
| `ADMIN_NAME` | seu nome | — |
| `IMPORT_SECRET` | secret do endpoint de importação | `openssl rand -hex 32` |
| `IMPORT_ENABLED` | `true` **apenas durante a migração**, depois `false`/remover | trava independente do secret — ver seção 7 |
| `NEXT_PUBLIC_APP_URL` | `https://app.imperiovisionario.com.br` | opcional — já é o padrão no código; só defina se usar outro domínio |

## 6. Rodar migração e criar o admin

Com `DATABASE_URL` configurada localmente (copie `.env.local.example` para `.env.local` e preencha, ou use `vercel env pull`):

```bash
npm install
npm run db:migrate
npm run db:seed
```

`db:migrate` aplica as duas migrações incluídas (`0000_special_bastion` e `0001_young_hardball` — esta última adiciona os papéis/estágios/prioridades completos, os campos legados preservados e a tabela de rate limiting) e verifica a conexão com uma consulta real antes e depois, incluindo uma transação de teste.

`db:seed` cria o usuário admin **apenas se `ADMIN_EMAIL` ainda não existir**. Rodar de novo contra um admin já existente não altera nada (nem senha, nem status ativo) — isso é proposital, para o comando poder fazer parte de um pipeline de deploy sem resetar a senha do admin a cada execução. Para forçar uma redefinição, defina `SEED_FORCE_RESET=true` só naquela execução.

## 7. Migrar os clientes do app antigo

**Pendência real, não resolvida nesta sessão:** o backup completo e atual do app antigo (ChatGPT) não foi recebido — só o número de referência "128 clientes" foi mencionado, sem os dados em si. O importador foi reconstruído (transacional, idempotente por `legacyId`, com modo de simulação e relatório de inconsistências) e testado com dados sintéticos (ver `REVIEW_REPORT.md`), mas **nenhum cliente real foi migrado**. Não invente ou aproxime esses dados — seguem as instruções para quando o backup real estiver disponível.

1. Exporte o backup completo e atual do app antigo (não uma lista do Notion desatualizada) como um array JSON de clientes.
2. No Vercel, defina `IMPORT_ENABLED=true` (além do `IMPORT_SECRET` já configurado).
3. **Rode primeiro em modo simulação** (não grava nada, só relata):
   ```bash
   curl -X POST https://SEU-APP.vercel.app/api/admin/import \
     -H "Authorization: Bearer $IMPORT_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"dryRun": true, "clients": [...]}'
   ```
   Revise o `summary` (quantos seriam inseridos/atualizados/bloqueados) e cada item em `reports` com `action: "blocked"` — cada um traz o motivo exato (etapa/prioridade não reconhecida, nome ausente, etc.). Corrija a origem dos dados ou estenda os mapas de alias em `lib/import-mapping.ts` até o relatório ficar limpo.
4. Reconcilie a contagem: o total de registros no backup real deve bater com a referência de 128 (ou você precisa entender a diferença) antes de prosseguir.
5. Rode de verdade (`"dryRun": false`). É seguro rodar mais de uma vez: registros não tocados no app desde a última importação são atualizados; registros editados manualmente no app são pulados (não sobrescritos) a menos que você passe `"overwrite": true` explicitamente.
6. **Depois de confirmar a migração**, defina `IMPORT_ENABLED=false` (ou remova a variável) no Vercel. O endpoint recusa qualquer requisição sem essa variável, mesmo com o secret correto.

## 8. Adicionar a equipe

Não é mais preciso rodar nenhum script para criar usuários além do primeiro admin (passo 6). Como admin, acesse **Configurações → Equipe** dentro do próprio app:

1. "Adicionar integrante" → nome, e-mail e papel (Comercial, Produção, ou Visitante — somente leitura).
2. Uma senha temporária forte é gerada na hora e aparece **uma única vez** na tela — copie e repasse à pessoa por um canal seguro (o app não envia e-mail nem mensagem automaticamente para ninguém).
3. A pessoa troca essa senha no primeiro acesso, em Configurações → Segurança.
4. Dá para trocar o papel, desativar (revoga as sessões na hora) ou redefinir a senha de qualquer integrante a qualquer momento pela mesma tela — menos a sua própria conta, que se gerencia em Segurança.

Isso vale também para o acesso somente-leitura da Jeisyelle (`jeisyellensilva@gmail.com`) como visitante, quando você decidir criá-lo — a tela está pronta, mas **nenhuma conta foi criada nem convite enviado** até você mandar.

## 9. Instalar no celular

Depois do deploy, abra a URL no Chrome (Android) ou Safari (iPhone):
- **Android**: menu → "Instalar app" / "Adicionar à tela inicial"
- **iPhone**: Compartilhar → "Adicionar à Tela de Início"

A instalação, o login/logout e o comportamento offline foram validados nesta sessão via navegador automatizado (ver `REVIEW_REPORT.md`) — **ainda não foram testados em um aparelho físico real**, o que é recomendado antes de divulgar o app para a equipe.

## 10. Manter o app antigo disponível

Até que os dados reais sejam migrados e reconciliados (passo 7) e a nova versão esteja validada em uso real, mantenha o app antigo (ChatGPT-hosted) acessível como referência — ele continua sendo a fonte de verdade dos dados até a migração ser concluída.
