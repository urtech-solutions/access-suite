# Backlog Do App Condominio

## Objetivo

Organizar o fechamento da visao de condominios do app mobile em um backlog incremental, sem reescrever o que ja existe e preservando o reaproveitamento do backend, do `management` e das regras de acesso ja consolidadas.

## Escopo Deste Backlog

- foco imediato em `Identidade e Sessao`;
- foco imediato em `Visitantes`;
- `Reservas de Areas Comuns` fica fora deste backlog e sera tratada em trilha propria;
- os demais modulos entram como `Next` e `Later`, sem detalhamento de implementacao nesta etapa.

## Estado Atual

- login do morador por `CPF + senha` ja existe;
- primeiro acesso ja diferencia `register` e `login`;
- ha suporte inicial a multi-contexto por `CPF` entre sites e tenants;
- o app ja consome backend real para `visitors`, `incidents`, `bulletin`, `common-areas` e `reservations`;
- a troca de residencia/contexto ja existe no app, mas ainda precisa endurecimento de UX, seguranca de sessao e regras operacionais.

## Meta De Saida Da Visao Condominio

Consideraremos a visao de condominios pronta quando:

- morador e sindico conseguirem entrar com identidade propria do app;
- o mesmo CPF conseguir operar multiplos sites e tenants com troca de contexto clara;
- primeiro acesso, troca de senha e recuperacao de acesso estiverem fechados;
- visitantes estiverem ponta a ponta, com regras, notificacoes e auditoria;
- mural, incidentes, entregas e chat estiverem operacionais em trilhas posteriores;
- o app estiver pronto para empacotamento com `Capacitor`.

## Prioridades

### Now

- `AUTH` Identidade e Sessao
- `VIS` Visitantes

### Next

- `BUL` Mural e notificacoes
- `INC` Incidentes e chamados
- `DEL` Encomendas

### Later

- `CHAT` Chat condominial
- `VOICE` chamadas de voz
- `PKG` empacotamento mobile, push e recursos nativos

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

## Backlog Resumido Das Demais Trilhas

### BUL - Mural E Notificacoes

- segmentacao por tenant/site/bloco/perfil;
- leitura e nao lidas;
- push em trilha posterior.

### INC - Incidentes E Chamados

- abertura em formato conversacional;
- anexos, audio, prioridade e status;
- roteamento por perfil operacional.

### DEL - Encomendas

- aviso de recebimento;
- confirmacao de retirada;
- historico auditavel por unidade.

### CHAT - Chat Condominial

- conversas 1:1, grupos e regras de visibilidade;
- anexos, unread, mute e moderacao.

### PKG - Empacotamento E Mobile Nativo

- `Capacitor`;
- storage seguro;
- biometria;
- camera;
- notificacoes push;
- distribuicao Android e iOS.

## Ordem Recomendada De Execucao

### Onda 1

- `AUTH-01`
- `AUTH-02`

### Onda 2

- `AUTH-03`
- `AUTH-04`
- `AUTH-05`

### Onda 3

- `VIS-01`
- `VIS-02`

### Onda 4

- `VIS-03`
- `VIS-04`
- `VIS-05`

## Definicao De Pronto Da Proxima Fase

A proxima fase estara fechada quando:

- multi-contexto por CPF estiver estavel;
- primeiro acesso e recuperacao de senha estiverem operacionais;
- sessao estiver segura e auditavel;
- o modulo de visitantes funcionar do app ate a operacao, com historico e status reais.

## Proxima Acao Sugerida

Iniciar por `AUTH-01` com este corte tecnico:

1. padronizar `context_label` e `unit_label` no backend;
2. ajustar o app para usar esses campos como fallback visual principal;
3. revisar `refresh/me` para sempre devolver todos os contextos ativos do CPF;
4. criar bateria de testes de regressao para CPF com multiplos tenants e contextos parciais.
