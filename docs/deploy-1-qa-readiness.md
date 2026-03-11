# Deploy 1 QA Readiness

## Objetivo

Consolidar a situacao real do `Deploy 1` da visao condominio, registrando:

- o que foi validado;
- quais evidencias automatizadas ja passaram;
- o resultado do smoke e da robustez leve;
- o que ainda precisa ser feito antes do deploy oficial com `HTTPS` e dominio real.

Data desta rodada de QA: `2026-03-11`.

## Escopo validado

Foi considerada a stack atualmente publicada em ambiente local de validacao:

- backend central em `:3000`
- `Management` em `:3003`
- `PWA-reviewed` em `:4040`
- app mobile web (`access-suite`) em `:8088`

O escopo funcional coberto por esta rodada foi:

- `AUTH`
- `VIS`
- `AREAS`
- `DEL`
- `BUL`
- `INC`
- `CHAT`
- `RT`
- inbox e badges
- fundacao de `web push`

## Evidencias automatizadas

### Backend

Comando executado:

```bash
npm test -- --runInBand
```

Resultado:

- `10` suites passaram
- `43` testes passaram
- `0` falhas

Suites confirmadas nesta rodada:

- `resident-app-portal.service.spec.ts`
- `user.service.spec.ts`
- `external-events.registration.service.spec.ts`
- `external-events.service.spec.ts`
- `resident-app-auth.service.spec.ts`
- `persons.service.spec.ts`
- `external-events-access-timing.service.spec.ts`
- `common-areas.service.spec.ts`
- `external-events-lifecycle.service.spec.ts`
- `access-control.service.spec.ts`

Observacao:

- dois specs estavam defasados em relacao aos contratos atuais do backend e foram ajustados antes da regressao final:
  - `src/module/users/test/user.service.spec.ts`
  - `src/module/resident-app-portal/resident-app-portal.service.spec.ts`

### App mobile

Comandos executados:

```bash
npm test
npm run build
```

Resultado:

- testes do `access-suite` passando
- build de producao passando

Suites confirmadas:

- `example.test.ts`
- `resident-notifications.test.ts`
- `mobile-app.service.test.ts`

### Management

Comando executado:

```bash
npm run build
```

Resultado:

- build de producao passando

### PWA-reviewed

Comando executado:

```bash
npm run build
```

Resultado:

- build de producao passando
- `generateSW` concluido

## Smoke da stack ativa

### Containers

Todos os containers centrais estavam `healthy` durante a rodada:

- `security_vision_backend`
- `security_vision_management`
- `security-vision-pwa-reviewed`
- `security_vision_access_app`
- `security_vision_postgres`
- `security_vision_redis`
- `security_vision_controller`

### Endpoints basicos

Verificacoes realizadas:

- `GET http://127.0.0.1:3000/push/config` -> `200`
- `GET http://127.0.0.1:3003` -> `200`
- `GET http://127.0.0.1:4040` -> `200`
- `GET http://127.0.0.1:8088` -> `200`

### Realtime

Verificacao realizada:

- `GET http://127.0.0.1:4040/socket.io/?EIO=4&transport=polling` -> `200`

Conclusao:

- o proxy realtime do `PWA-reviewed` respondeu corretamente ao handshake `socket.io`

Observacao:

- foram encontrados `502` antigos nos logs do `PWA-reviewed` ao conectar em `/socket.io`, mas os registros apontam situacao transitoria de indisponibilidade do backend naquele momento, nao falha persistente do proxy

## Robustez leve

### Sequencial

Foram executadas `20` requisicoes sequenciais por endpoint:

- backend `push/config`: `20/20` OK, media `19.0 ms`, max `39.3 ms`
- `Management`: `20/20` OK, media `7.5 ms`, max `30.7 ms`
- `PWA-reviewed`: `20/20` OK, media `8.5 ms`, max `28.7 ms`
- app mobile: `20/20` OK, media `7.3 ms`, max `28.9 ms`

### Concorrencia leve

Foram executadas `30` requisicoes concorrentes com `10` workers:

- backend `push/config`: `30/30` OK
- `Management`: `30/30` OK
- app mobile: `30/30` OK
- `PWA-reviewed` -> `/api/health`: houve resposta `429`

Interpretacao:

- a stack base esta estavel sob concorrencia leve;
- o unico ponto identificado foi o `health` proxied do `PWA-reviewed`, que acabou herdando throttling do backend durante o teste concorrente.

Acao tomada no codigo-fonte:

- o endpoint `GET /health` foi marcado com `@SkipThrottle()` em `src/module/health/health.controller.ts`

Pendencia:

- publicar essa alteracao no container do backend antes do deploy oficial

## Observabilidade revisada

### Sinais positivos

- healthchecks de containers ativos e consistentes
- backend respondendo `/health` e `/push/config`
- logs do backend com operacao de `sync/heartbeat` continua e sem erro funcional recorrente
- logs do `Management` e do app mobile sem erros de runtime relevantes nesta rodada
- `service worker` de push publicado em `4040` e `8088`

### Pontos de atencao

- o smoke concorrente encontrou `429` em `/api/health`
- o `web push` real continua dependente de `HTTPS`; em ambiente sem `HTTPS`, so a fundacao da feature pode ser validada
- o deploy oficial ainda precisa de verificacao final de links publicos, `CORS` e `EVENT_PUBLIC_BASE_URL`

## Checklist funcional do Deploy 1

### Preparacao do ambiente

- banco com migrations aplicadas
- backup recente do banco validado
- `EVENT_PUBLIC_BASE_URL` apontando para URL publica correta
- `CORS_ORIGIN` cobrindo `Management`, `PWA-reviewed` e app mobile
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` definidos
- `HTTPS` ativo para `4040` e `8088` no ambiente oficial

### Configuracao por site

- modulo de convites habilitado quando aplicavel
- perfil default de visitante configurado
- areas comuns com `location` e horario de funcionamento configurados
- entregas habilitadas quando aplicavel
- chat habilitado com regras corretas de conversa direta e grupos
- incidentes habilitados com topicos cadastrados
- mural habilitado para operacao e sindico conforme politica

### Validacao por perfil

- `Morador`
  - login
  - troca de contexto
  - visitantes
  - areas comuns
  - entregas
  - mural
  - incidentes
  - chat
- `Sindico`
  - login
  - troca de contexto
  - mural
  - incidentes
  - chat
- `Operacao`
  - `PWA-reviewed`
  - entregas
  - mural
  - incidentes
  - widget de chat
- `Administrador`
  - configuracao por site no `Management`
  - habilitacao de modulos
  - topicos
  - regras de chat
  - regras de convites

## Checklist de smoke antes do deploy oficial

- `GET /health` do backend
- `GET /push/config`
- abertura do `Management`
- abertura do `PWA-reviewed`
- abertura do app mobile
- handshake `socket.io` pelo `PWA-reviewed`
- login de um morador piloto
- login de um sindico piloto
- criacao de um convite
- criacao de uma entrega
- publicacao de um comunicado
- abertura de um incidente
- envio de uma mensagem de chat

## Plano de rollback

### Banco

- manter backup imediatamente anterior ao deploy
- se houver migration nova no deploy oficial, registrar ordem de aplicacao e procedimento de reversao ou restauracao

### Aplicacao

- manter imagem/tag anterior do backend
- manter imagem/tag anterior do `Management`
- manter imagem/tag anterior do `PWA-reviewed`
- manter imagem/tag anterior do `access-suite`

### Procedimento

1. interromper novas publicacoes
2. retornar imagens/tag anteriores da stack
3. validar `docker ps` e healthchecks
4. validar `GET /health`, `Management`, `PWA-reviewed` e app
5. se a falha envolver dados, restaurar backup do banco e reexecutar smoke minimo

## Pendencias reais antes do deploy oficial

- publicar os frontends sob `HTTPS`
- validar `web push` real em dispositivo com dominio oficial
- republicar o backend com a exclusao de throttling do `health`
- executar matriz manual final por perfil em dominio oficial
- confirmar checklist de configuracao do condominio piloto

## Parecer desta rodada

O `Deploy 1` esta tecnicamente perto de pronto. A base funcional, a automacao principal e o smoke da stack passaram. O maior bloqueador restante nao e modulo de negocio: e a etapa operacional de publicacao com `HTTPS`, push real e a republicacao final do backend com o endurecimento do `health`.
