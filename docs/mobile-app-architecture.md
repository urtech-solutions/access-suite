# Security Vision Mobile App MVP

## Objetivo deste corte

Evoluir o `access-suite` para o MVP do app mobile da plataforma SaaS sem reescrever backend nem quebrar os apps já existentes. O foco deste corte é validar a experiência do morador/síndico e estabelecer uma fundação técnica que possa virar app Android/iOS e PWA com o menor retrabalho possível.

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

- Visão mobile para `Morador` e `Síndico` em modo de preview.
- Dashboard residencial com contexto do condomínio.
- Módulo de visitantes com criação local e integração backend quando disponível.
- Módulo de incidentes com abertura e acompanhamento.
- Mural de avisos com leitura de backend e fallback local.
- Áreas comuns com reservas.
- Entregas e chat em modo demonstrativo/local, preservando o fluxo visual do produto.
- Banner de conectividade e contador de ações pendentes para ilustrar a base offline-first.

## Estratégia de integração

O app opera em dois modos:

1. `preview`
- Sessão local com personas seeded.
- Ideal para validação de UX e fluxo de produto.
- Persistência local e fila pendente no próprio navegador.

2. `backend`
- Usa autenticação própria de morador por `CPF + senha` via `resident-app-auth`.
- O token pertence à identidade do CPF e o contexto ativo (`site/apartamento/tenant`) é separado.
- Quando o mesmo CPF for liberado em novos sites ou tenants, os novos contextos aparecem na sessão do app sem recriar conta.
- Integra, neste corte, com endpoints próprios do app do morador:
  - `resident-app/visitors`
  - `resident-app/incidents`
  - `resident-app/bulletin`
  - `resident-app/common-areas`
  - `resident-app/reservations`

## Evolução estrutural aplicada

O backend agora possui uma autenticação própria para o morador, desacoplada do `users` operacional:

- `persons.app_access_enabled` para liberar o uso do app;
- `resident_app_accounts` com identidade por CPF;
- seleção de contexto por unidade quando o mesmo CPF existir em múltiplos sites/tenants;
- endpoints próprios do app para não misturar permissão operacional com permissão do morador.

## Próxima etapa recomendada

Após validação deste MVP:

1. fechar `Entregas` ponta a ponta;
2. evoluir `Chat` textual com imagens, anexos e audios;
3. subir `realtime` e notificacoes push;
4. implementar `Voz`;
5. fechar `Video` como ultimo corte do MVP desejado;
6. empacotar com `Capacitor` para Android/iOS.

## Backlog operacional

O backlog priorizado para fechamento da visão de condomínios está em:

- `docs/mobile-condominium-backlog.md`

O foco imediato passa a ser:

1. endurecimento final de `Visitantes`
2. endurecimento final de `Áreas Comuns`
3. `Entregas`
4. `Chat` com mídia

## Roadmap incremental

### Fase A
- MVP mobile de morador/síndico
- Backend parcial com fallback local
- validação de UX e domínio

### Fase B
- entregas persistidas no backend
- chat textual com midia
- push notifications
- realtime operacional

### Fase C
- voz e video
- Capacitor + stores
- recursos nativos de câmera, biometria e notificações
- observabilidade mobile e analytics operacional
