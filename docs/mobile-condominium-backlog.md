# Backlog Do App Condominio

## Objetivo

Organizar o fechamento da visao de condominios do app mobile em um backlog incremental, sem reescrever o que ja existe e preservando o reaproveitamento do backend, do `management` e das regras de acesso ja consolidadas.

## Escopo Deste Backlog

- registrar o que ja foi fechado no MVP;
- consolidar o que ainda falta para a visao de condominio chegar ao corte desejado;
- ordenar a execucao dos proximos modulos sem abrir reescrita desnecessaria;
- manter backend, `management` e app mobile evoluindo em ondas pequenas e integradas.

## Estado Atual

- login do morador por `CPF + senha` ja existe;
- primeiro acesso ja diferencia `register` e `login`;
- ha suporte inicial a multi-contexto por `CPF` entre sites e tenants;
- o app ja consome backend real para `visitors`, `incidents`, `bulletin`, `common-areas`, `reservations`, `deliveries` e `chat`;
- o `Management` ja governa configuracoes de condominio para `areas comuns`, `entregas`, `chat` e `incidentes`;
- o `PWA-reviewed` ja participa dos fluxos de `entregas`, `chat`, `incidentes` e operacao condominial;
- a troca de residencia/contexto ja existe no app e a base de sessao esta funcional;
- `realtime` ja esta ligado para `chat`, `entregas`, `visitantes`, `incidentes` e `mural`;
- a inbox unificada e os badges ja existem no app e no `PWA-reviewed`;
- a fundacao de `web push` ja foi implementada, restando ativacao sob `HTTPS` no ambiente publicado.

## Fechado Ate Aqui

- `AUTH`
  - login por `CPF + senha`;
  - primeiro acesso;
  - recuperacao e troca de senha em corte MVP;
  - sessao por dispositivo;
  - troca de contexto;
  - perfil `Morador` e `Sindico`.
- `VIS`
  - criacao de convite;
  - regras por site;
  - compartilhamento de link;
  - aprovacao pelo morador;
  - cancelamento e historico;
  - retorno operacional e inbox local.
- `AREAS`
  - cadastro de areas comuns no `Management`;
  - agenda visual no app;
  - criacao de reserva;
  - aprovacao no `Management`;
  - link unico para convidados;
  - endurecimento de conflito, lotacao e janela operacional.
- `DEL`
  - modulo de entregas habilitavel por site;
  - criacao por apartamento ou morador no `PWA-reviewed`;
  - confirmacao e contestacao no app;
  - trilha operacional base e sincronizacao com contexto do condominio.
- `BUL`
  - mural de comunicados por site;
  - criacao por sindico no app;
  - criacao por operacao no `PWA-reviewed`;
  - suporte a texto, imagem, tag e expiracao.
- `INC`
  - modulo de incidentes habilitavel por site;
  - topicos configuraveis no `Management`;
  - abertura pelo morador com timeline conversacional;
  - operacao no `PWA-reviewed` e acompanhamento pelo sindico.
- `CHAT`
  - chat textual base no app;
  - canal com portaria e regras por site;
  - primeira mensagem com aprovacao e bloqueio entre moradores;
  - widget operacional no `PWA-reviewed`.
- `RT`
  - realtime ja integrado em `chat`, `entregas`, `visitantes`, `incidentes` e `mural`;
  - inbox unificada e badges por modulo;
  - base de `web push` com persistencia de subscription e `service worker`.

## Meta De Saida Da Visao Condominio

Consideraremos a visao de condominios pronta quando:

- morador e sindico conseguirem entrar com identidade propria do app;
- o mesmo CPF conseguir operar multiplos sites e tenants com troca de contexto clara;
- primeiro acesso, troca de senha e recuperacao de acesso estiverem fechados;
- visitantes estiverem ponta a ponta, com regras, notificacoes e auditoria;
- areas comuns estiverem operacionais para o morador e com aprovacao madura;
- entregas estiverem ponta a ponta;
- chat textual com anexos e audio estiver operacional;
- voz interna estiver funcional;
- video estiver fechado como ultimo corte do MVP desejado;
- o app estiver pronto para empacotamento com `Capacitor`.

## Prioridades

### Done

- `AUTH` Identidade e Sessao base
- `VIS` Visitantes base
- `AREAS` Areas Comuns base
- `DEL` Entregas base
- `BUL` Mural base
- `INC` Incidentes base
- `CHAT` Chat textual base

### Now

- `DEPLOY-01` endurecimento do primeiro deploy
- `HTTPS` para ativacao de push real
- QA de regressao dos modulos ja entregues
- endurecimento de `VIS`
- endurecimento de `AREAS`
- endurecimento de `DEL`
- endurecimento de `INC`
- endurecimento de `CHAT`

### Next

- `VOICE` chamadas de voz
- fechamento de midia rica no chat e nos incidentes

### Later

- `VIDEO` chamadas de video
- `PKG` empacotamento mobile, push e recursos nativos

## Corte De Deploy 1

### Deploy 1 - Escopo funcional publicado

**Objetivo**

Publicar em ambiente controlado tudo o que ja foi implementado e integrado, sem abrir novos modulos antes de estabilizar a base.

**Inclui**

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

**Nao inclui como bloqueador**

- grupos de chat;
- anexos ricos completos em `chat` e `incidentes`;
- audio gravado;
- `voz`;
- `video`;
- `Capacitor` e stores nativas.

### DEPLOY-01 - Itens obrigatorios antes de publicar

**Objetivo**

Fechar o que falta para a primeira publicacao operacional dos modulos ja construidos.

**Referencia operacional**

- `docs/deploy-1-qa-readiness.md`

**Tarefas**

- infraestrutura:
  - publicar `access-suite` e `PWA-reviewed` sob `HTTPS`;
  - validar `CORS`, `EVENT_PUBLIC_BASE_URL` e URL publica dos links;
  - garantir backup do banco e procedimento de rollback;
- backend:
  - validar migrations aplicadas no ambiente alvo;
  - revisar healthchecks, logs de erro e subscriptions de push;
- management:
  - revisar as configuracoes obrigatorias por site:
    - modulos habilitados;
    - perfis default;
    - topicos;
    - regras de chat;
    - regras de convites;
    - locations de areas comuns;
- QA:
  - executar matriz de testes por perfil e por modulo;
  - validar cenarios online, queda de conexao e recuperacao;
  - validar rotas principais e erros esperados;
- operacao:
  - definir condominio piloto;
  - definir usuarios piloto:
    - morador
    - sindico
    - porteiro
    - administrador

**Pronto quando**

- os modulos entregues estiverem operando em ambiente HTTPS;
- o push web conseguir registrar subscription real;
- o fluxo critico de cada perfil estiver validado ponta a ponta;
- houver checklist de configuracao e rollback do ambiente.

## Epic AUTH - Identidade E Sessao

### AUTH-01 - Endurecer a identidade do app por CPF

**Objetivo**

Garantir que a identidade do app pertença ao CPF e nao a um cadastro isolado de pessoa, permitindo agregar novos contextos quando o mesmo CPF for liberado depois em outros sites ou tenants.

**Tarefas**

- backend:
  - revisar o fluxo de `lookup`, `register`, `login`, `refresh` e `switch-context`;
  - garantir que novos contextos ativos do mesmo CPF sejam resgatados sem recriar conta;
  - padronizar `context_label` e `unit_label` para qualquer contexto incompleto;
  - revisar regras de `ACTIVE`, `DISABLED`, expiracao e `app_access_enabled`;
- management:
  - deixar o estado de `Uso do APP` claro e auditavel;
  - validar a regra de liberacao apenas para perfis de morador/sindico;
- app:
  - exibir contextos com fallback visual robusto;
  - impedir perda de contexto quando site/bloco/apto vier parcial;
  - padronizar selecao de residencia no card de contexto ativo.

**Dependencias**

- `resident_app_accounts`
- `persons.app_access_enabled`

**Pronto quando**

- um mesmo CPF com multiplos contextos em tenants distintos conseguir entrar e alternar entre eles sem perder sessao nem precisar recriar conta.

### AUTH-02 - Fechar onboarding de primeiro acesso

**Objetivo**

Deixar o fluxo de primeiro acesso previsivel e seguro: CPF valido, verificacao de liberacao, criacao de senha e entrada no contexto correto.

**Tarefas**

- backend:
  - manter `lookup` como passo obrigatorio;
  - validar politica minima de senha;
  - impedir cadastros duplicados de conta por CPF;
- app:
  - separar com clareza os estados `CPF nao liberado`, `primeiro acesso`, `senha existente` e `multiplos contextos`;
  - melhorar mensagens e validacoes locais;
  - persistir a URL da API apenas em `Opcoes avancadas`;
- QA:
  - cenarios com CPF nao liberado;
  - CPF com um contexto;
  - CPF com multiplos contextos;
  - CPF liberado depois de ja possuir conta.

**Pronto quando**

- o usuario conseguir concluir o primeiro acesso sem suporte manual da equipe.

### AUTH-03 - Recuperacao e troca de senha

**Objetivo**

Fechar o ciclo minimo de credencial para uso real do app.

**Tarefas**

- backend:
  - definir fluxo de recuperacao por OTP, token temporario ou mediacao operacional;
  - registrar auditoria de troca e reset de senha;
- management:
  - opcionalmente permitir reset assistido por operacao/gestao;
- app:
  - criar telas `Esqueci minha senha` e `Alterar senha`;
  - tratar expiracao e invalidacao de sessoes antigas;
- QA:
  - testar reset bem sucedido, token expirado e tentativa invalida.

**Pronto quando**

- o morador conseguir recuperar acesso sem precisarmos apagar conta manualmente no banco.

### AUTH-04 - Sessao por dispositivo e storage seguro

**Objetivo**

Separar sessao por dispositivo e preparar o app para empacotamento real.

**Tarefas**

- backend:
  - enriquecer `refresh_tokens` com metadados de dispositivo;
  - permitir revogacao por dispositivo;
- app:
  - trocar `localStorage` por camada preparada para `Capacitor Preferences` e storage seguro;
  - exibir dispositivos conectados e logout remoto, se aprovado;
  - preparar biometria como etapa posterior;
- QA:
  - testar renovacao de token, logout e revogacao.

**Pronto quando**

- o app conseguir manter sessao de forma segura e previsivel em uso continuo.

### AUTH-05 - Observabilidade e auditoria da identidade

**Objetivo**

Ter rastreabilidade suficiente para suporte, seguranca e operacao.

**Tarefas**

- backend:
  - auditar `lookup`, `register`, `login`, `refresh`, `switch-context`, `logout`, `reset`;
  - expor logs e metricas basicas por tenant e por erro;
- app:
  - registrar eventos tecnicos essenciais de falha de auth e troca de contexto;
- QA:
  - validar se eventos criticos ficam rastreaveis.

**Pronto quando**

- conseguirmos diagnosticar falhas de acesso sem depender de inspecao manual no banco.

### AUTH-06 - Perfil de sindico no app

**Objetivo**

Permitir que usuarios do `Management` entrem no app como `Sindico`, usando `CPF + senha` do proprio portal, sem impedir que o mesmo CPF tambem exista como `Morador`.

**Tarefas**

- backend:
  - criar uma tag/permissao propria de `Uso do APP - Sindico` no cadastro de `usuarios`;
  - agregar contextos por `CPF` considerando `persons` e `users`;
  - apos o `lookup`, devolver quais perfis de entrada estao disponiveis para aquele CPF;
  - quando o CPF existir como morador e sindico, exigir a escolha do perfil antes da autenticacao final;
- management:
  - configurar a permissao do sindico no modulo de `Usuarios`;
  - reaproveitar tenants e sites ja alocados ao usuario;
- app:
  - manter a tela limpa, mostrando a escolha `Morador` ou `Sindico` somente depois do CPF;
  - diferenciar a sessao e o contexto ativo conforme o perfil escolhido.

**Pronto quando**

- um usuario com CPF compartilhado entre `Morador` e `Sindico` conseguir escolher o perfil de entrada e operar no contexto correto.

## Epic VIS - Visitantes

### VIS-01 - Consolidar modelo de convite e visita

**Objetivo**

Definir um contrato unico para convite e visita do morador no app.

**Tarefas**

- backend:
  - revisar os modelos existentes de visitantes e host;
  - definir status canonicos: `PENDING`, `CONFIRMED`, `ACTIVE`, `USED`, `CANCELLED`, `EXPIRED`;
  - mapear se o visitante pertence ao contexto ativo do morador;
- management:
  - parametrizar regras por tenant/site;
- app:
  - adequar listas, cards e filtros aos status reais.

**Pronto quando**

- o modulo operar com status coerentes entre backend, app e portaria.

### VIS-02 - Criacao de convite pelo morador

**Objetivo**

Permitir que o morador crie convites reais pelo app.

**Tarefas**

- backend:
  - suportar convite com e sem confirmacao do convidado;
  - gerar identificador compartilhavel;
  - definir janelas de validade e limite de uso;
  - reaproveitar ao maximo a estrutura de `external events` para publicar a URL central de cadastro e coleta de face;
- app:
  - formulario final de convite;
  - compartilhamento por link e QR em etapa posterior ou simultanea, conforme contrato;
  - feedback claro de criacao e validade;
- QA:
  - testar convite simples, recorrente e com dados incompletos.

**Pronto quando**

- o convite criado no app puder ser usado pela operacao sem recadastro manual.

### VIS-02A - Regras de convite por site de condominio

**Objetivo**

Garantir que o modulo de convites seja configurado por `site`, apareca apenas em ambientes com tag `CONDOMINIO` e respeite regras definidas pela administracao.

**Tarefas**

- backend/management:
  - criar o modulo `Convites` no Management;
  - exibir o modulo apenas para sites com tag `CONDOMINIO`;
  - definir regras por site:
    - duracao maxima do convite em dias;
    - se o convite exige confirmacao do morador apos cadastro do visitante;
    - perfil default aplicado ao visitante;
- app:
  - adaptar a criacao do convite as regras do site atual.

**Pronto quando**

- o administrador conseguir governar o comportamento do convite por site sem ajuste manual no app.

### VIS-02B - Janela de acesso por dia

**Objetivo**

Padronizar o comportamento dos convites criados no app do morador.

**Tarefas**

- backend:
  - permitir selecionar apenas o dia ou os dias da visita;
  - quando houver 1 dia, liberar o visitante por 24h daquele dia;
  - quando houver varios dias, liberar ate `23:59` do ultimo dia;
- app:
  - remover a exigencia de horario na criacao de convite do app;
  - exibir de forma clara o periodo consolidado do convite.

**Pronto quando**

- o fluxo do morador nao exigir horario manual e a validade final ficar coerente com a regra do produto.

### VIS-03 - Confirmacao, cancelamento e historico

**Objetivo**

Dar autonomia ao morador sobre os convites que ja criou.

**Tarefas**

- backend:
  - confirmar visitante quando a modalidade exigir;
  - cancelar convite;
  - expor historico paginado por contexto;
- app:
  - listar ativos, futuros, usados, cancelados e expirados;
  - permitir cancelamento e reenvio;
- QA:
  - validar transicoes de status e restricoes de horario.

**Pronto quando**

- o morador conseguir acompanhar e administrar o ciclo de vida do visitante pelo app.

### VIS-04 - Integracao com operacao e auditoria

**Objetivo**

Fechar o uso operacional do modulo.

**Tarefas**

- backend:
  - integrar liberacao e consumo do convite com os eventos operacionais;
  - auditar criacao, alteracao, cancelamento e uso;
- operation/pwa:
  - garantir leitura do convite pela portaria;
  - harmonizar o comportamento com o fluxo ja existente do PWA;
- app:
  - mostrar retorno de entrada liberada, entrada negada ou expiracao.

**Pronto quando**

- houver rastreabilidade ponta a ponta do convite ate o evento de acesso.

### VIS-04A - Fluxo de confirmacao do morador

**Objetivo**

Fechar o fluxo em que o convidado se cadastra primeiro e o morador aprova depois.

**Tarefas**

- backend:
  - publicar a URL central para o convidado preencher dados e foto;
  - criar o visitante com perfil default e status de pendencia;
  - notificar o app do morador para aprovacao;
  - somente apos aprovacao enviar a liberacao definitiva para controller e leitores;
- app:
  - mostrar notificacao de aprovacao pendente;
  - permitir ao morador analisar dados e foto e aprovar;
- operacao:
  - manter rastreio do visitante ate a liberacao final.

**Pronto quando**

- a liberacao definitiva do visitante depender da aprovacao do morador apenas quando a regra do site exigir isso.

### VIS-05 - Notificacoes do modulo

**Objetivo**

Fechar a comunicacao do morador sobre o estado do visitante.

**Tarefas**

- backend:
  - publicar eventos de confirmacao, uso, expiracao e cancelamento;
- app:
  - inbox local agora;
  - push depois, na trilha de empacotamento e notificacoes nativas;
- QA:
  - validar disparo por cenario e por tenant/contexto.

**Pronto quando**

- o morador souber o que aconteceu com o visitante sem precisar consultar a portaria.

## Estado Atual Das Trilhas Complementares

### BUL - Mural E Notificacoes

- base funcional entregue no app e no `PWA-reviewed`;
- criacao por sindico e operacao ja disponivel;
- eventos realtime e inbox ja estao ligados;
- ainda falta endurecer segmentacao fina e leitura/nao lidas canonicamente.

### INC - Incidentes E Chamados

- base funcional entregue com topicos, status, participantes e timeline;
- inbox e realtime ja estao ligados;
- ainda falta endurecer anexos ricos, SLA e indicadores operacionais;
- precisa consolidar auditoria analitica de tempo de resolucao, tipo e responsavel.

### DEL - Encomendas

- base funcional entregue para criacao, confirmacao e contestacao;
- inbox e realtime ja estao ligados;
- ainda falta endurecer auditoria visivel e UX operacional;
- a evolucao posterior deve preparar o gancho para incidentes quando houver contestacao nao resolvida.

### CHAT - Chat Condominial

- base textual entregue com regras por site e operacao no `PWA-reviewed`;
- realtime, inbox e badge ja estao ligados;
- ainda falta abrir grupos, unread canonicamente, moderacao operacional e politicas de bloqueio mais maduras;
- anexos, imagens, audio gravado e tempo real entram como trilha imediata de endurecimento.

### RT - Realtime E Notificacoes

- `WebSocket` ja ligado para `chat`, `entregas`, `visitantes`, `incidentes` e `mural`;
- inbox, badges e links internos ja entregues;
- `web push` ja tem backend, subscriptions persistidas e `service worker`;
- falta ativar `HTTPS` no ambiente publicado e validar subscription real no dispositivo;
- depois disso, a trilha segue para notificacao mais madura e nativa.

### VOICE - Chamadas De Voz

- chamada `1:1` no contexto do chat;
- regra de permissao por perfil;
- sinalizacao da chamada;
- historico basico;
- experiencia mobile-first.

### VIDEO - Chamadas De Video

- chamada `1:1` como extensao da trilha de voz;
- reaproveitamento da mesma infraestrutura de sinalizacao;
- permissoes, historico e notificacao;
- entra apenas depois de chat textual, midia e voz estabilizados.

### PKG - Empacotamento E Mobile Nativo

- `Capacitor`;
- storage seguro;
- biometria;
- camera;
- notificacoes push;
- distribuicao Android e iOS.

## Ordem Recomendada De Execucao

### Onda 1

- `DEPLOY-01`
- endurecimento final de `VIS`
- endurecimento final de `AREAS`
- endurecimento final de `DEL`
- endurecimento final de `INC`
- endurecimento final de `CHAT`

### Onda 2

- consolidacao de `RT` sob `HTTPS`
- push notifications em ambiente publicado
- unread e eventos ao vivo entre app e operacao

### Onda 3

- imagens e anexos
- audio gravado
- politicas de midia, retencao e upload seguro

### Onda 4

- `VOICE`

### Onda 5

- `VIDEO`

### Onda 6

- `PKG`

## Definicao De Pronto Da Proxima Fase

A proxima fase estara fechada quando:

- `chat`, `entregas`, `mural` e `incidentes` reagirem a eventos reais sem refresh manual;
- o app tiver notificacoes internas consistentes por contexto ativo;
- o ambiente HTTPS estiver habilitado para registrar `web push` real;
- a camada de sincronizacao estiver pronta para receber push nativo depois;
- os modulos base de condominio estiverem rastreaveis em auditoria e UX operacional madura.

## Proxima Acao Sugerida

Iniciar por `DEPLOY-01` com este corte tecnico:

1. publicar `access-suite` e `PWA-reviewed` em `HTTPS`;
2. validar `web push` real no dispositivo;
3. executar QA de regressao do escopo do `Deploy 1`;
4. corrigir endurecimentos finais dos modulos ja entregues;
5. publicar o primeiro ambiente controlado.
