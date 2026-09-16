# Análise competitiva — IVS Central vs. CRMs de mercado

Comparação do IVS Central com quatro CRMs usados como referência (Pipedrive, HubSpot, RD Station CRM, Agendor), focada em recursos que fazem sentido para uma agência de marketing digital — não uma lista genérica de "tudo que um CRM pode ter". Cada oportunidade abaixo é cruzada com o estado real do IVS Central (`PARITY_MATRIX.md`), para não sugerir algo que já existe.

**Como ler este documento:** cada item tem impacto (o quanto muda o dia a dia) e esforço (o quanto exige de código/infraestrutura nova). Nada aqui foi implementado ainda — são recomendações para você decidir o que entra no escopo, na ordem que preferir. Itens marcados como "exige decisão de negócio" não são só uma questão técnica (têm custo recorrente, aprovação externa, ou mudam como a equipe trabalha).

## O que o IVS Central já faz bem (e vale reconhecer)

Antes das lacunas: o IVS Central não é um CRM genérico com um funil configurável do zero — ele já nasce com as etapas exatas da Império Visionário (diagnóstico → visita → WhatsApp → ligação → reunião → proposta → fechado), o checklist de produção de 15 passos, e agora contratos/financeiro/equipe integrados no mesmo lugar. Isso é algo que, num Pipedrive ou HubSpot, exigiria configuração manual extensa ou um plano pago mais caro para customizar — e mesmo assim não teria o checklist de produção específico da agência. Essa integração ponta a ponta (lead → proposta → contrato → cobrança recorrente) num único sistema, sem módulos pagos separados, é um diferencial real que os concorrentes pesquisados não entregam prontos.

## Oportunidades identificadas

### Prioridade alta, esforço baixo — dá para fazer sem decisão de negócio pendente

**1. Motivo de perda estruturado.** Hoje, mover um cliente para "sem interesse" não registra por quê (preço, timing, concorrente, sumiu). O Agendor trata isso como recurso central ("motivos de perda personalizáveis") porque é o dado que mais ajuda a entender por que a agência perde negócios — hoje esse aprendizado fica só na cabeça de quem atendeu. Implementação: um campo obrigatório curto (select + observação livre) exigido só na transição para "sem_interesse", com relatório simples de motivos mais frequentes no Dashboard.

**2. Previsão de receita ponderada no Dashboard.** Pipedrive e HubSpot destacam "revenue forecasting" como recurso central. O IVS já tem os dados para isso (proposta com valor + etapa do cliente) — só falta o cálculo: valor esperado = soma do valor das propostas em aberto, ponderado por uma probabilidade por etapa (ex: proposta enviada = 40%, reunião marcada = 20%). Não exige tabela nova, é uma consulta adicional no Dashboard.

### Prioridade alta, esforço médio

**3. Lembretes automáticos por regra ("automação leve").** É o recurso mais citado pelos quatro concorrentes (RD Station em particular vende isso como diferencial: 13 modelos prontos de automação). Não precisa ser o motor completo deles — a versão que já resolve 80% do problema é: criar uma tarefa/lembrete automaticamente quando (a) um cliente muda de etapa, ou (b) fica parado X dias sem atividade registrada. Isso ataca diretamente uma lacuna que o `PARITY_MATRIX.md` já registra na agenda ("sem lembrete/notificação quando um item fica atrasado"). Esforço médio: precisa de um job periódico (cron) e uma tabela de regras simples — não precisa de disparo de e-mail/WhatsApp externo nesta primeira versão.

**4. Notificações push quando algo fica atrasado.** Complementa o item 3. Como o app já é PWA instalável, dá para usar a Web Push API do navegador (sem depender de serviço pago de terceiros) para avisar a pessoa responsável quando um lead atrasa ou uma cobrança vence. Esforço médio: exige gerar chaves VAPID, guardar a inscrição de push por usuário, e o job do item 3 já cobre o gatilho.

**5. Geração de PDF da proposta.** Já é uma lacuna conhecida (`PARITY_MATRIX.md` #10). Todos os concorrentes pesquisados tratam "gerar documento para enviar ao cliente" como básico. Esforço médio: uma lib de PDF (ex: `@react-pdf/renderer` ou geração server-side) + um template com a identidade visual da agência.

### Exige decisão de negócio antes de implementar

Estes não são só questões técnicas — mudam custo recorrente ou como a equipe trabalha, por isso não devem ser implementados automaticamente sem sua confirmação:

**6. Envio de e-mail integrado com rastreamento de abertura.** Pipedrive e HubSpot tratam isso como recurso central (sync de e-mail, "abriu sua mensagem"). Implementar exige escolher e pagar um provedor de e-mail transacional (Resend, Postmark, SendGrid) e decidir se a equipe realmente usa e-mail como canal principal de follow-up com os leads, ou se é majoritariamente WhatsApp — o que mudaria a prioridade deste item para baixo.

**7. WhatsApp além do "abrir conversa".** O sistema já tem um botão que abre o WhatsApp Web com o número do cliente — isso cobre o uso manual. O que os concorrentes brasileiros (RD Station, Agendor) oferecem a mais é automação: disparo automático de mensagem ao mudar de etapa, e o histórico da conversa aparecendo direto no CRM. Isso exige a WhatsApp Business API (processo de aprovação pela Meta e custo mensal por conversa) — não é algo que eu deva simplesmente construir sem essa decisão de custo/processo ser sua.

**8. Modo offline com sincronização, rotas de visita geográficas.** O Agendor investe pesado nisso porque atende muitos vendedores em campo sem internet. O IVS já tem o conceito de fila de visita por nicho (`visitOrder`/`suggestedDay`) — o que sugere que parte da prospecção é presencial. Vale a pena só se uma fração relevante do trabalho comercial for mesmo visita física com conectividade ruim; se a prospecção é majoritariamente remota (ligação/WhatsApp/reunião online), este item tem esforço alto para impacto baixo. Preciso saber isso antes de priorizar.

**9. API pública / webhooks para integrações futuras.** Agendor e RD Station destacam API aberta para conectar com WhatsApp, ERP, VoIP. Para uma agência de tráfego pago, o caso de uso mais natural seria puxar métricas de campanhas (Meta Ads, Google Ads) direto para o cliente no CRM, ou receber leads de formulários automaticamente. Não recomendo construir uma "API genérica" sem um primeiro caso de uso concreto guiando o design — é fácil construir a API errada. Se houver uma integração específica em mente, ela deveria vir primeiro.

### Prioridade mais baixa por ora

**10. Assistente de IA (priorização de leads, resumo de conversas, sugestão de próxima ação).** Pipedrive AI, RD Station IA e HubSpot Breeze investem nisso. No caso do IVS, a priorização já é determinística e transparente (regras claras: atrasado > hoje > próximo, prioridade alta/média/baixa) — o que é mais previsível para a equipe do que uma sugestão de IA. Um assistente de IA teria custo recorrente de API por chamada e complexidade de guardrails para um ganho incremental sobre o que já existe. Vale reconsiderar depois que os itens acima estiverem prontos, não antes.

## Resumo — ordem sugerida

1. Motivo de perda estruturado + previsão de receita no Dashboard (baixo esforço, sem decisão pendente)
2. Lembretes automáticos por regra + notificações push de atraso (fecha a lacuna mais citada pelos concorrentes)
3. Geração de PDF de proposta (lacuna já conhecida, demanda recorrente de cliente final)
4. E-mail/WhatsApp automatizados, modo offline, API pública — cada um depende de uma decisão sua (canal principal de follow-up, volume de prospecção presencial, caso de uso de integração) antes de eu desenhar a solução técnica

Nenhum destes foi implementado — este documento é só o mapeamento. Me diga quais entram no escopo (e em que ordem) que eu sigo o mesmo processo das rodadas anteriores: implementar com evidência real de teste, não só "o build passou".

---

Fontes consultadas nesta análise: [Pipedrive — CRM Features](https://www.pipedrive.com/en/crm/features), [HubSpot — CRM Product](https://www.hubspot.com/products/crm), [RD Station — Automação de Vendas](https://www.rdstation.com/produtos/crm/vendas/automacao/), [Agendor — O que faz o Agendor ser diferente de outros CRMs](https://ajuda.agendor.com.br/pt-BR/articles/2660170-o-que-faz-o-agendor-ser-diferente-de-outros-crms), [Agendor — 12 funcionalidades](https://www.agendor.com.br/blog/crm-simples/).
