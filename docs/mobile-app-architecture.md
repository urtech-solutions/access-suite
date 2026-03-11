# Security Vision Mobile App MVP

## Objetivo deste corte

Evoluir o `access-suite` para o MVP do app mobile da plataforma SaaS sem reescrever backend nem quebrar os apps ja existentes. O foco deste corte e consolidar a experiencia de morador/sindico sobre backend real, fechar os modulos-base da visao condominio e preparar o primeiro deploy controlado da solucao ja implementada.

## Decisão de stack

- Frontend do app: `React 18 + TypeScript + Vite`
- UI: `Tailwind CSS + shadcn/ui + Framer Motion`
- Estado assíncrono: `@tanstack/react-query`
- Persistência local do MVP: `localStorage` com cache por módulo e fila simples de sincronização
- Navegação: `react-router-dom`
- Empacotamento mobile recomendado para a próxima etapa: `Capacitor`

## Por que esse stack é o melhor encaixe agora

- Reaproveita o `access-suite` existente quase integralmente.
- Mantém a mesma base técnica dos frontends web atuais em React/TypeScript.
- Permite validar rapidamente UX, contratos e regras de domínio sem abrir uma terceira stack móvel paralela.
- Deixa o app `Capacitor-ready`, viabilizando Android/iOS nativos sem reimplementar as telas.
- Mantém a porta aberta para compartilhar contratos, SDK e componentes com `management` e `pwa`.

## Escopo implementado neste MVP

- visao mobile para `Morador` e `Sindico` em `preview` e `backend`;
- dashboard residencial com contexto ativo de condominio;
- identidade por `CPF` com multi-contexto entre sites e tenants;
- modulo de visitantes com convite, aprovacao, historico e retorno operacional;
- modulo de areas comuns com agenda visual, reserva, aprovacao e link de convidados;
- modulo de entregas com criacao pela operacao e confirmacao/contestacao pelo morador;
- mural de comunicados com publicacao por sindico e operacao, incluindo imagem e tags;
- modulo de incidentes em formato conversacional com topicos e status;
- chat textual base entre moradores, sindico e portaria, com regras por site;
- banner de conectividade e fila simples de pendencias como base para evolucao offline-first.

## Estrategia de integracao

O app opera em dois modos:

1. `preview`
- sessao local com personas seeded;
- ideal para validacao de UX e fluxo de produto;
- persistencia local e fila pendente no proprio navegador.

2. `backend`
- usa autenticacao propria de morador por `CPF + senha` via `resident-app-auth`;
- o token pertence a identidade do CPF e o contexto ativo (`site/apartamento/tenant`) e separado;
- quando o mesmo CPF for liberado em novos sites ou tenants, os novos contextos aparecem na sessao do app sem recriar conta;
- integra, neste corte, com endpoints proprios do app do morador:
  - `resident-app/visitors`
  - `resident-app/incidents`
  - `resident-app/bulletin`
  - `resident-app/common-areas`
  - `resident-app/reservations`
  - `resident-app/deliveries`
  - `resident-app/chat`

## Evolucao estrutural aplicada

O backend agora possui uma autenticacao propria para o morador, desacoplada do `users` operacional:

- `persons.app_access_enabled` para liberar o uso do app;
- `resident_app_accounts` com identidade por CPF;
- selecao de contexto por unidade quando o mesmo CPF existir em multiplos sites/tenants;
- suporte ao perfil `Sindico` usando `CPF + senha` do portal, sem impedir coexistencia com `Morador`;
- endpoints proprios do app para nao misturar permissao operacional com permissao do morador;
- modulos condominiais configuraveis por site via `Management`.

## Estado atual do MVP

Hoje o produto ja tem uma base funcional integrada para:

- `AUTH`: login, primeiro acesso, troca de senha, sessao por dispositivo e troca de contexto;
- `VIS`: convites com regras por site, aprovacao, cancelamento, historico e retorno operacional;
- `AREAS`: reservas com agenda visual, aprovacao no `Management` e convidados por link;
- `DEL`: entregas com criacao operacional e confirmacao/contestacao no app;
- `BUL`: mural de comunicados com texto, imagem e tags;
- `INC`: incidentes com topicos, status, participantes e timeline;
- `CHAT`: chat textual base com regras por site e presenca operacional no `PWA-reviewed`.
- `RT`: atualizacao em tempo real para `chat`, `entregas`, `visitantes`, `incidentes` e `mural`;
- `INBOX`: central unificada de notificacoes e badges no app e no `PWA-reviewed`;
- `PUSH`: base de `web push` com subscriptions persistidas no backend e `service worker` publicado nos dois frontends.

## Escopo recomendado do primeiro deploy

O primeiro deploy recomendado nao depende de `voz`, `video` nem de empacotamento nativo com `Capacitor`. O corte mais seguro para publicar agora e:

- app web mobile de `Morador` e `Sindico`;
- `Management` governando `Convites`, `Areas Comuns`, `Entregas`, `Chat` e `Incidentes`;
- `PWA-reviewed` operando `chat`, `entregas`, `incidentes`, `mural` e fluxo condominial;
- backend central com auth por `CPF`, multi-contexto, modulos condominiais, realtime e base de push;
- deploy web com foco em Android/iOS via navegador, adicionando empacotamento nativo em fase posterior.

Em termos funcionais, o `Deploy 1` cobre:

- identidade e sessao;
- visitantes;
- areas comuns;
- entregas;
- mural;
- incidentes;
- chat textual;
- realtime;
- inbox e badges;
- fundacao de push web.

## O que falta para o Deploy 1

Os itens abaixo sao os faltantes reais para publicar com seguranca o que ja foi construido:

1. `HTTPS` para `access-suite` e `PWA-reviewed`
- necessario para ativar `PushManager` e notificacoes web reais fora de `localhost`;
- precisa existir tanto na validacao LAN quanto no ambiente publicado.

2. endurecimento final dos modulos ja entregues
- validar ponta a ponta os fluxos por perfil e por site;
- revisar mensagens de erro, estados vazios, reenvio e conflitos de operacao;
- fechar comportamento de permissao/modulo desabilitado em todos os frontends.

3. checklist de configuracao operacional por site
- `Uso do APP` em pessoas e sindicos;
- perfis default de visitante;
- modulos habilitados por site;
- topicos de incidente;
- regras de chat;
- locations das areas comuns;
- regras de entregas e convites.

4. validacao de deploy e observabilidade minima
- smoke test do backend, `Management`, `PWA-reviewed` e app;
- log de health, erros de auth, eventos realtime e subscriptions de push;
- procedimento de rollback e backup basico do banco.

5. QA de regressao funcional
- roteiro de teste por perfil:
  - morador
  - sindico
  - operacao
  - administracao
- roteiro por modulo:
  - auth
  - visitantes
  - areas
  - entregas
  - mural
  - incidentes
  - chat

## O que ja pode ficar para depois do Deploy 1

Os itens abaixo ja estao mapeados, mas nao precisam bloquear a primeira publicacao:

- grupos de chat;
- anexos ricos em `chat` e `incidentes`;
- audio gravado;
- chamadas de `voz`;
- chamadas de `video`;
- `Capacitor`, stores e distribuicao nativa;
- biometria e storage seguro nativo;
- analytics avancado e dashboards gerenciais mais profundos.

## Proxima etapa recomendada

Com a base funcional entregue, a trilha seguinte deixa de ser criacao de modulo e passa a ser endurecimento de deploy:

1. fechar `HTTPS` para os dois frontends web;
2. executar QA estruturado do `Deploy 1`;
3. publicar o primeiro ambiente controlado com os modulos atuais;
4. depois evoluir `Chat` e `Incidentes` com imagens, anexos e audios;
5. implementar `Voz`;
6. fechar `Video`;
7. empacotar com `Capacitor` para Android/iOS.

## Backlog operacional

O backlog priorizado para fechamento da visão de condomínios está em:

- `docs/mobile-condominium-backlog.md`

O foco imediato passa a ser:

1. endurecimento final de `Visitantes`
2. endurecimento final de `Areas Comuns`
3. endurecimento final de `Entregas`
4. endurecimento final de `Incidentes`
5. endurecimento final de `Chat`
6. infraestrutura de `Realtime`

## Readiness do Deploy 1

O checklist consolidado de QA, smoke, rollback e pendencias operacionais desta fase esta em:

- `docs/deploy-1-qa-readiness.md`

## Roadmap incremental

### Fase A
- MVP mobile de morador/sindico
- backend real integrado aos modulos-base
- validacao de UX, dominio e operacao condominial
- consolidacao de `AUTH`, `VIS`, `AREAS`, `DEL`, `BUL`, `INC` e `CHAT`
- fundacao de `RT`, inbox e `web push`

### Fase B
- endurecimento para `Deploy 1`
- `HTTPS` e push web operacional
- QA e rollout do primeiro ambiente
- chat textual com midia

### Fase C
- voz e video
- `Capacitor` + stores
- recursos nativos de camera, biometria e notificacoes
- observabilidade mobile e analytics operacional
