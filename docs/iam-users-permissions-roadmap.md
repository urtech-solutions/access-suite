# Roadmap IAM de Usuarios e Permissoes

Data: 2026-03-13
Status: Proposta tecnica e backlog incremental

## 1. Objetivo

Evoluir o modulo de `Usuarios e Permissoes` para um IAM de produto que funcione de forma unificada no:

- `Management`
- `PWA-reviewed`
- `edge controller` em modo local
- backend central

Sem reescrever o sistema do zero.

O foco desta trilha e:

1. reaproveitar `users`, `tenants`, `sites`, regras de acesso e estruturas ja consolidadas;
2. permitir visao por `tenant` ou por `site`;
3. controlar visibilidade por `modulo`, `feature`, `acao` e `escopo`;
4. permitir `grupos de permissao` reutilizaveis;
5. esconder menus, paginas, cards, selects e acoes quando o usuario nao tiver acesso;
6. garantir enforcement real no backend e no modo offline, nao apenas no frontend.

## 2. O que o codigo ja tem hoje

Base reaproveitavel observada no workspace:

1. `users` ja possui:
   - `role`
   - `management_access`
   - `pwa_access`
   - `resident_app_syndic_access`
   - `pwa_scope`
   - `guarita_remote_commands`
2. Ja existe tabela de alocacao por site:
   - `user_site_allocations`
3. O JWT ja carrega:
   - `activeTenant`
   - `role`
   - `management_access`
   - `pwa_access`
   - `pwa_scope`
   - `allocated_sites`
4. O `PWA-reviewed` ja filtra sites acessiveis com base em `pwa_scope + allocated_sites`.
5. O `PWA-reviewed` ja esconde o seletor de site quando so existe um site acessivel ou quando a controladora local fixa o contexto.
6. Alguns modulos operacionais ja usam escopo de site no backend, como `incidents`, `bulletin` e `local-auth` da controller.

Arquivos mais relevantes do estado atual:

- `security-vision-backend-main/prisma/schema.prisma`
- `security-vision-backend-main/src/module/auth/auth.service.ts`
- `security-vision-backend-main/src/module/users/user.service.ts`
- `security-vision-backend-main/apps/management/src/layouts/ManagementLayout.tsx`
- `security-vision-backend-main/apps/management/src/router.tsx`
- `security-vision-backend-main/apps/management/src/pages/users/UsersPage.tsx`
- `security-vision-backend-main/apps/pwa-reviewed/src/contexts/AuthContext.tsx`
- `security-vision-backend-main/apps/pwa-reviewed/src/contexts/OperationalSiteContext.tsx`
- `security-vision-backend-main/apps/pwa-reviewed/src/components/ops/OpsSidebar.tsx`

## 3. Gaps atuais que precisamos fechar

Hoje o produto ainda nao tem um IAM completo. Os principais gaps sao:

1. `role` ainda e fixa e global no usuario:
   - `PLATFORM_ADMIN`
   - `TENANT_ADMIN`
   - `OPERATOR`
2. O `Management` esconde navegacao principalmente por `role` hardcoded, nao por uma matriz unica de capacidades.
3. O `PWA-reviewed` ja respeita melhor o escopo de `site`, mas nao tem um catalogo unico de permissoes por modulo/acao.
4. O backend ainda autoriza a maior parte das rotas apenas com:
   - autenticacao
   - `@Roles(...)`
   - filtros manuais por `tenant`
5. Ainda nao existe um modelo unico para responder:
   - quais modulos este usuario pode ver
   - quais acoes este usuario pode executar
   - em quais sites este usuario pode operar
6. Ainda nao existe um `catalogo de permissoes` de produto para `Management`, `PWA-reviewed` e `edge`.
7. Ainda nao existe tela completa para:
   - criar grupos de permissao
   - atribuir grupos a usuarios
   - visualizar o resultado final das permissoes efetivas
8. O `PWA-reviewed` hoje nao bloqueia explicitamente login sem `pwa_access`.
9. A auditoria de IAM ainda esta incompleta:
   - existe `audit_logs`
   - mas o interceptor padrao ainda so escreve em console
10. O modelo atual de usuario e permissao e global demais para SaaS:
   - um mesmo usuario multi-tenant deveria poder ter papeis e escopos diferentes por tenant.

## 4. Decisao de arquitetura recomendada

### 4.1 Separar identidade de autorizacao

Para o IAM ficar correto sem reescrita total, a recomendacao e separar:

1. `Identidade`
   - quem e o usuario
   - fica em `users`
2. `Membership por tenant`
   - qual o papel-base do usuario naquele tenant
   - se ele entra no `Management`, `PWA-reviewed` ou `App Sindico`
   - se ele tem visao de `TENANT` ou de `SITE`
3. `Grupos de permissao`
   - bundles reutilizaveis de modulos e acoes
4. `Escopo de sites`
   - quais sites aquele membership pode operar

### 4.2 Manter `role` atual como papel de sistema na transicao

Nao vale a pena quebrar tudo agora.

Recomendacao:

1. manter `users.role` durante a transicao como `system_role` legado;
2. introduzir membership por tenant para o estado alvo;
3. migrar os frontends e o backend para consumir o novo grafo de permissao;
4. so depois reduzir a dependencia do `role` legado nas rotas.

### 4.3 Usar dois niveis de RBAC

O modelo recomendado e:

1. `System Role`
   - governanca da plataforma
   - ex.: `PLATFORM_ADMIN`
2. `Permission Groups`
   - visao funcional do negocio
   - ex.: `Porteiro`, `Cadastro`, `Gestao de Usuarios`, `Sindico`

Isto resolve o problema de querer:

- manter papeis de plataforma ja existentes;
- criar papeis mais ricos de negocio sem explodir o numero de `roles` fixas.

### 4.4 Escopo deve ser regra estrutural, nao detalhe de tela

O escopo precisa ser uma propriedade de autorizacao.

Modelo alvo:

- `TENANT`
  - ve todos os sites do tenant ativo
- `SITE`
  - ve apenas os sites alocados ao membership

Quando o usuario for `SITE`:

1. o backend deve sempre restringir as consultas;
2. o frontend deve esconder seletor de site quando houver apenas um site valido;
3. os formularios devem fixar automaticamente o site quando ele for unico;
4. o edge/local mode deve respeitar a mesma regra.

### 4.5 Visibilidade de modulo = interseccao de quatro fatores

Um modulo so fica visivel quando existir ao mesmo tempo:

1. acesso ao canal:
   - `Management`
   - `PWA`
   - `App Sindico`
2. permissao do usuario ou do grupo
3. escopo valido:
   - `tenant`
   - `site`
4. modulo habilitado no tenant/site
   - ex.: `deliveries`, `incidents`, `chat`, `bulletin`, `condominium`

Ou seja:

`modulo visivel = canal liberado AND capability liberada AND escopo valido AND modulo habilitado no contexto`

## 5. Modelo alvo de dados

## 5.1 Tabelas novas recomendadas

### `user_tenant_memberships`

Responsabilidade:

- transformar a relacao `usuario x tenant` em objeto de dominio governavel.

Campos minimos:

1. `id`
2. `user_uuid`
3. `tenant_uuid`
4. `system_role`
   - `PLATFORM_ADMIN`
   - `TENANT_ADMIN`
   - `OPERATOR`
5. `status`
   - `ACTIVE`
   - `INACTIVE`
6. `management_access`
7. `pwa_access`
8. `resident_app_syndic_access`
9. `guarita_remote_commands`
10. `visibility_scope`
    - `TENANT`
    - `SITE`
11. `created_at`
12. `updated_at`

### `iam_permission_groups`

Responsabilidade:

- grupos reutilizaveis de permissao por tenant.

Campos minimos:

1. `id`
2. `tenant_uuid`
3. `key`
4. `name`
5. `description`
6. `channel`
   - `MANAGEMENT`
   - `PWA`
   - `SHARED`
7. `is_system_template`
8. `created_at`
9. `updated_at`

### `iam_group_permissions`

Responsabilidade:

- ligar grupo a permissoes atomicas.

Campos minimos:

1. `id`
2. `group_id`
3. `permission_key`

### `iam_membership_groups`

Responsabilidade:

- ligar membership a um ou mais grupos.

Campos minimos:

1. `id`
2. `membership_id`
3. `group_id`

### `iam_membership_permission_overrides` (fase posterior)

Responsabilidade:

- excecoes por usuario.

Campos minimos:

1. `id`
2. `membership_id`
3. `permission_key`
4. `effect`
   - `ALLOW`
   - `DENY`

## 5.2 Reaproveitamento de tabelas atuais

1. `users`
   - continua sendo a identidade
2. `user_site_allocations`
   - reaproveitar como alocacao de sites do membership na fase inicial
   - depois avaliar se precisa vincular direto ao `membership_id`
3. `audit_logs`
   - reaproveitar para trilha de IAM

## 5.3 Catalogo de permissoes

O catalogo deve ser unico e versionado.

Pode ser inicialmente code-driven com seed, sem tela de administracao do catalogo.

Formato recomendado da chave:

`{canal}.{modulo}.{recurso}.{acao}`

Exemplos:

- `management.dashboard.view`
- `management.users.view`
- `management.users.create`
- `management.users.assign_groups`
- `management.audit.view`
- `management.sites.view`
- `management.locations.view`
- `management.locations.edit`
- `management.devices.view`
- `management.devices.edit`
- `management.access_rules.view`
- `management.access_rules.edit`
- `management.condominium.view`
- `management.condominium.communications.publish`
- `pwa.dashboard.view`
- `pwa.persons.view`
- `pwa.persons.create`
- `pwa.persons.edit`
- `pwa.devices.view`
- `pwa.access_rules.view`
- `pwa.guarita.remote_commands`
- `shared.condominium.bulletin.publish`
- `shared.condominium.incidents.manage`
- `shared.condominium.common_areas.manage`

## 5.4 Grupos padrao recomendados

Primeiro pacote de grupos que devem nascer com seed:

1. `PLATFORM_ADMIN_BASE`
2. `TENANT_ADMIN_BASE`
3. `MANAGEMENT_USERS_ADMIN`
4. `MANAGEMENT_AUDIT_VIEWER`
5. `SITE_OPERATOR_PORTEIRO`
6. `SITE_OPERATOR_REGISTRATION`
7. `SITE_OPERATOR_READ_ONLY`
8. `CONDOMINIUM_SINDICO`
9. `CONDOMINIUM_PORTARIA`
10. `GUARITA_REMOTE_OPERATOR`

## 6. Regras funcionais obrigatorias

## 6.1 Visao por tenant

Se o membership tiver `visibility_scope = TENANT`:

1. o usuario ve dados de todos os sites do tenant ativo;
2. os filtros por site continuam disponiveis quando fizer sentido;
3. o usuario pode trocar o site ativo quando houver mais de um;
4. rotas e consultas continuam limitadas ao tenant ativo.

## 6.2 Visao por site

Se o membership tiver `visibility_scope = SITE`:

1. o usuario so ve dados dos sites alocados;
2. se houver um unico site alocado:
   - nao mostrar select de site
   - nao mostrar checkbox como se houvesse varias opcoes
   - preencher site automaticamente em formularios
3. se houver mais de um site alocado:
   - mostrar seletor apenas com os sites validos
4. mesmo que o frontend envie outro `site_id`, o backend deve negar ou corrigir o filtro.

## 6.3 Modulo oculto

Se o usuario nao tiver permissao para um modulo:

1. o menu nao aparece;
2. a rota nao aparece;
3. cards e atalhos nao aparecem;
4. widgets do dashboard nao aparecem;
5. endpoints retornam `403` se acessados manualmente;
6. websockets e eventos realtime nao devem entregar payload fora do escopo.

## 6.4 Acao negada

Se o usuario tiver permissao de leitura mas nao de escrita:

1. a pagina pode abrir em modo leitura;
2. botoes de criar/editar/excluir nao aparecem;
3. campos protegidos devem ficar `read-only` ou ocultos;
4. o backend continua bloqueando mutacao.

## 6.5 Modulos de condominio

Para papeis como `Sindico`:

1. o grupo precisa liberar apenas os modulos condominiais desejados;
2. o escopo continua sendo `tenant` ou `site`;
3. se for `site`, o sindico so ve o condominio/site ao qual pertence;
4. o mesmo usuario pode acumular:
   - grupo `CONDOMINIUM_SINDICO`
   - grupo `MANAGEMENT_USERS_ADMIN`
   - ou outro grupo, se o negocio precisar.

## 7. Contrato alvo de sessao e autorizacao

## 7.1 `POST /auth/me`

O `auth/me` precisa deixar de retornar apenas claims basicas e passar a retornar o grafo de autorizacao efetivo.

Payload recomendado:

1. `user`
2. `active_tenant`
3. `membership`
   - `system_role`
   - `visibility_scope`
   - `management_access`
   - `pwa_access`
   - `resident_app_syndic_access`
   - `guarita_remote_commands`
4. `allowed_sites`
5. `permission_groups`
6. `permission_keys`
7. `module_keys`
8. `ui_hints`
   - `hide_site_selector`
   - `fixed_site_id`
   - `default_site_id`
9. `authorization_version`

## 7.2 JWT

O JWT nao precisa carregar tudo, mas precisa carregar o minimo para enforcement e offline.

Claims recomendadas:

1. `activeTenant`
2. `membership_id`
3. `system_role`
4. `visibility_scope`
5. `allowed_site_ids`
6. `management_access`
7. `pwa_access`
8. `resident_app_syndic_access`
9. `guarita_remote_commands`
10. `authorization_version`

As permissoes completas podem vir do `auth/me` e do cache local.

## 7.3 Edge/local auth

O `edge controller` precisa refletir o mesmo snapshot de autorizacao.

Requisito:

1. gerar sessao local assinada para o usuario;
2. manter `tenant`, `site`, `groups`, `scope` e `authorization_version`;
3. impedir operacao offline em site nao autorizado;
4. manter visibilidade de modulo coerente no `PWA-reviewed` em modo local.

## 8. Roadmap incremental

## Fase 0 - Hardening da base atual

Objetivo:

Fechar os buracos mais evidentes antes de introduzir o novo IAM.

Entregas:

1. bloquear login no `PWA-reviewed` quando `pwa_access = false`;
2. padronizar resposta de sessao entre `Management`, `PWA-reviewed` e `controller`;
3. mapear todos os modulos e features existentes em um inventario unico;
4. definir naming oficial das permissoes;
5. revisar auditar a criacao/edicao/remocao de usuarios.

Pronto quando:

1. nenhum app aceita login em canal nao liberado;
2. existe um inventario unificado de modulos e acoes;
3. a equipe concorda com o catalogo inicial de permissoes.

## Fase 1 - Fundacao IAM no backend

Objetivo:

Criar o modelo de membership, grupos e resolucao de permissao sem quebrar o login atual.

Entregas:

1. `user_tenant_memberships`
2. `iam_permission_groups`
3. `iam_group_permissions`
4. `iam_membership_groups`
5. servico de resolucao de autorizacao efetiva
6. seed inicial de grupos e permissoes
7. backfill a partir de:
   - `users.role`
   - `management_access`
   - `pwa_access`
   - `resident_app_syndic_access`
   - `pwa_scope`
   - `user_site_allocations`

Pronto quando:

1. todo usuario autenticado no tenant ativo possuir `membership` resolvido;
2. o backend conseguir calcular `allowed_sites`, `permission_keys` e `module_keys`;
3. nenhum comportamento legado se perde na migracao.

## Fase 2 - Enforcement de autorizacao no backend

Objetivo:

Parar de depender apenas de menu escondido.

Entregas:

1. decorator e guard de permissao atomica, ex.:
   - `@RequirePermission('management.users.view')`
2. helper comum de escopo:
   - `tenant`
   - `site`
3. aplicacao inicial nos recursos prioritarios:
   - `users`
   - `sites`
   - `locations`
   - `persons`
   - `devices`
   - `profiles`
   - `schedules`
   - `audit`
4. negativa consistente com `403`
5. logs de auditoria de tentativa negada quando fizer sentido

Pronto quando:

1. um usuario `SITE` nao consegue consultar dados de outro site por URL, query ou payload manual;
2. um usuario sem permissao de escrita nao consegue mutar recurso;
3. rotas criticas de `Management` e `PWA-reviewed` ja estao protegidas.

## Fase 3 - Novo modulo de IAM no Management

Objetivo:

Transformar `Usuarios` em modulo real de IAM.

Entregas:

1. tela de usuarios com memberships por tenant;
2. edicao de:
   - acesso ao canal
   - escopo `TENANT` ou `SITE`
   - sites permitidos
   - grupos atribuidos
3. tela de grupos de permissao;
4. tela de detalhe do grupo com modulos e acoes;
5. preview de permissao efetiva do usuario;
6. templates de grupos padrao;
7. auditoria de alteracoes.

Pronto quando:

1. um admin consegue criar usuario;
2. vincular ao tenant;
3. definir visao `TENANT` ou `SITE`;
4. escolher grupos;
5. validar a permissao efetiva antes de salvar.

## Fase 4 - Adocao do IAM no Management

Objetivo:

Fazer o `Management` inteiro responder ao novo grafo de autorizacao.

Entregas:

1. navegacao por `module_keys`, nao por `role` hardcoded;
2. `router` por permissao;
3. dashboards e widgets por permissao;
4. filtros e formularios com `ui_hints`;
5. esconder selects de site quando o contexto for unico;
6. remover checkboxes/opcoes falsas quando o usuario nao tiver alternativa real.

Pronto quando:

1. um usuario com visao de `SITE` enxerga apenas:
   - `pessoas`
   - `locations`
   - `dispositivos`
   - `regras`
   - `modulos`
   do site permitido;
2. o menu nao mostra modulos sem acesso;
3. a UX fica coerente com o escopo do usuario.

## Fase 5 - Adocao do IAM no PWA-reviewed

Objetivo:

Aplicar a mesma regra de IAM ao operacional.

Entregas:

1. sidebar do `PWA-reviewed` por `module_keys`;
2. rotas por permissao;
3. widgets por permissao;
4. formularios por permissao e escopo;
5. cache local do snapshot de autorizacao;
6. sincronizacao do snapshot com o modo offline/local.

Pronto quando:

1. um usuario `SITE` so opera no site permitido;
2. modulos nao autorizados somem da barra lateral e do dashboard;
3. em modo local, a mesma visibilidade continua valendo.

## Fase 6 - Edge/local mode e consistencia offline

Objetivo:

Levar o IAM para a controller local e para o fallback offline.

Entregas:

1. sessao local assinada com snapshot de IAM;
2. restricao local por site;
3. restricao local por modulo;
4. expiracao e renovacao de snapshot;
5. logs locais de tentativas negadas;
6. sincronizacao de alteracao de permissao quando a central voltar.

Pronto quando:

1. perda de internet nao amplia permissao do usuario;
2. o site local continua protegido;
3. o `PWA-reviewed` segue escondendo o que nao e permitido.

## Fase 7 - Auditoria, observabilidade e rollout

Objetivo:

Fechar a trilha com governanca e QA.

Entregas:

1. auditoria de:
   - criacao de usuario
   - alteracao de membership
   - atribuicao/remocao de grupo
   - mudanca de escopo
   - tentativas negadas relevantes
2. metricas:
   - permissoes negadas por modulo
   - usuarios por tipo de escopo
   - grupos mais usados
3. rollout por feature flag
4. checklist de regressao

Pronto quando:

1. o time consegue rastrear quem alterou permissao, quando e em qual tenant;
2. existem alertas basicos de erro de autorizacao;
3. o rollout pode ser ativado por tenant.

## 9. Backlog priorizado

## NOW

### IAM-00 - Inventario oficial de modulos e permissoes

Objetivo:

Listar todos os modulos, features, acoes e canais existentes para criar o catalogo unico de permissao.

Tarefas:

1. mapear modulos do `Management`;
2. mapear modulos do `PWA-reviewed`;
3. mapear features de `edge/local mode`;
4. classificar por:
   - canal
   - modulo
   - recurso
   - acao
   - escopo suportado

Pronto quando:

1. existe um catalogo versionado;
2. cada rota e tela critica aponta para uma permission key.

### IAM-01 - Corrigir gates minimos dos canais

Objetivo:

Garantir que o usuario nao entre em app errado.

Tarefas:

1. reforcar `management_access` no `Management`;
2. aplicar check de `pwa_access` no `PWA-reviewed`;
3. garantir comportamento equivalente no `edge/local-auth`;
4. cobrir com teste.

Pronto quando:

1. login sem acesso ao canal falha de forma explicita;
2. a sessao local nao contorna esta regra.

### IAM-02 - Introduzir `user_tenant_memberships`

Objetivo:

Sair do modelo global de permissao no usuario.

Tarefas:

1. criar tabela;
2. criar migration e backfill;
3. migrar `role` e booleans para membership;
4. adaptar `auth/me` e `switch-tenant` para buscar membership do tenant ativo;
5. manter compatibilidade temporaria com campos antigos.

Pronto quando:

1. o tenant ativo resolve um membership unico;
2. a sessao deixa de depender de flags globais no usuario.

### IAM-03 - Grupos de permissao

Objetivo:

Permitir bundles reutilizaveis.

Tarefas:

1. criar tabelas de grupos;
2. seed de grupos padrao;
3. resolver permissoes efetivas por membership;
4. expor preview via API.

Pronto quando:

1. um mesmo grupo pode ser atribuido a varios usuarios;
2. um usuario pode acumular mais de um grupo.

### IAM-04 - Escopo unificado `TENANT` x `SITE`

Objetivo:

Aplicar o mesmo escopo no `Management`, `PWA-reviewed` e `edge`.

Tarefas:

1. criar `visibility_scope` no membership;
2. reaproveitar `user_site_allocations` como sites permitidos;
3. migrar `pwa_scope` para leitura do novo escopo;
4. expor `allowed_sites` e `ui_hints` no `auth/me`.

Pronto quando:

1. o mesmo usuario tem a mesma interpretacao de escopo em todos os canais;
2. o frontend para de depender de regras paralelas por app.

## NEXT

### IAM-05 - Guard e resolver de permissao no backend

Objetivo:

Centralizar autorizacao fina.

Tarefas:

1. criar `AuthorizationContextService`;
2. criar `@RequirePermission(...)`;
3. criar helper de filtro por site;
4. aplicar primeiro em:
   - `users`
   - `sites`
   - `locations`
   - `persons`
   - `acs_devices`
   - `audit`

Pronto quando:

1. o backend protege leitura e escrita;
2. nao depende mais apenas do frontend.

### IAM-06 - Tela de grupos no Management

Objetivo:

Operar grupos de permissao pelo portal.

Tarefas:

1. listar grupos;
2. criar grupo;
3. editar permissoes;
4. duplicar grupo template;
5. mostrar impacto por modulo.

Pronto quando:

1. o admin consegue modelar grupos sem SQL manual.

### IAM-07 - Evoluir tela de usuarios para IAM

Objetivo:

Transformar a pagina atual em hub de memberships e grupos.

Tarefas:

1. mostrar memberships por tenant;
2. editar escopo;
3. editar sites permitidos;
4. atribuir grupos;
5. mostrar resumo de acesso efetivo;
6. mostrar se o usuario e `TENANT` ou `SITE`.

Pronto quando:

1. a pagina atual deixa de ser apenas CRUD simples;
2. o admin consegue configurar o usuario inteiro em um fluxo unico.

### IAM-08 - Navegacao dinamica no Management

Objetivo:

Trocar `role` hardcoded por `module_keys + permission_keys`.

Tarefas:

1. adaptar `ManagementLayout`;
2. adaptar `router`;
3. adaptar dashboard;
4. adaptar componentes de pagina e acoes.

Pronto quando:

1. menus, rotas e widgets seguem o mesmo snapshot de IAM.

### IAM-09 - Navegacao dinamica no PWA-reviewed

Objetivo:

Aplicar a mesma matriz ao operacional.

Tarefas:

1. adaptar `OpsSidebar`;
2. adaptar `router`;
3. adaptar widgets do dashboard;
4. adaptar formularios.

Pronto quando:

1. o `PWA-reviewed` fica coerente com o `Management`.

## LATER

### IAM-10 - Overrides por usuario

Objetivo:

Permitir excecoes sem clonar grupos.

Tarefas:

1. permitir `ALLOW/DENY` por permission key;
2. mostrar diff em relacao aos grupos;
3. auditar override.

Pronto quando:

1. excecoes pontuais nao exigem criar novos grupos em excesso.

### IAM-11 - Templates de onboarding por tipo de operacao

Objetivo:

Criar perfis prontos para acelerar implantacao.

Templates sugeridos:

1. `Porteiro Base`
2. `Porteiro Cadastro`
3. `Gestor de Usuarios`
4. `Auditoria`
5. `Sindico`
6. `Operador Guarita`
7. `Leitura Site`

### IAM-12 - RLS e isolamento reforcado

Objetivo:

Endurecer a protecao no banco.

Tarefas:

1. avaliar `tenant_uuid + RLS`;
2. criar testes automatizados de isolamento;
3. aplicar a recursos criticos.

## 10. QA e validacao

## 10.1 Perfis minimos para testes

Criar massa de teste com:

1. `Platform Admin`
2. `Tenant Admin`
3. `Operador Tenant`
4. `Operador Site Unico`
5. `Operador Multi-Site`
6. `Leitura Site`
7. `Sindico`
8. `Usuario sem acesso ao PWA`
9. `Usuario sem acesso ao Management`

## 10.2 Cenarios obrigatorios

### Backend

1. usuario `SITE` nao lista dados de outro site;
2. usuario `SITE` nao cria registro em site nao permitido;
3. usuario `read-only` nao muta dados;
4. usuario sem modulo nao acessa endpoint do modulo;
5. `switch-tenant` recalcula corretamente o membership.

### Management

1. menu mostra apenas modulos liberados;
2. rota bloqueada redireciona ou mostra `403`;
3. pagina de site unico nao exibe select falso;
4. formularios preenchem `site` automaticamente quando o contexto for unico;
5. botoes de mutacao somem quando o usuario so pode ler.

### PWA-reviewed

1. sidebar mostra apenas modulos liberados;
2. widgets do dashboard respeitam modulo e site;
3. select de site aparece apenas quando necessario;
4. login sem `pwa_access` falha;
5. modo local preserva o mesmo escopo.

### Edge/local

1. sessao local nao amplia permissao;
2. usuario nao opera controladora de site nao autorizado;
3. perda de internet nao libera modulo indevido;
4. retorno da central nao perde consistencia do snapshot de IAM.

## 10.3 Tipos de teste

1. unitario:
   - resolver de permissao
   - merge de grupos
   - escopo de tenant/site
2. integracao:
   - guards
   - rotas criticas
   - `auth/me`
3. contrato:
   - shape do snapshot de autorizacao para `Management`, `PWA-reviewed` e `edge`
4. e2e:
   - fluxos completos por perfil
5. regressao manual assistida:
   - dashboards
   - CRUDs
   - operacao offline

## 10.4 Gaps de teste observados hoje

Hoje a cobertura automatizada relevante para este tema ainda e baixa:

1. ha testes de `users` muito pontuais;
2. ha testes de `persons` focados em foto/face;
3. nao ha suite consistente de autorizacao em `Management`;
4. nao ha suite consistente de autorizacao em `PWA-reviewed`.

Conclusao:

QA do IAM precisa entrar no backlog como entrega obrigatoria, nao opcional.

## 11. Definicao de pronto do modulo

Consideraremos o modulo de `Usuarios e Permissoes` completo quando:

1. um usuario puder ter papeis e acessos diferentes por tenant;
2. um usuario puder ter visao `TENANT` ou `SITE`;
3. grupos de permissao puderem ser criados e atribuidos a varios usuarios;
4. `Management` e `PWA-reviewed` esconderem modulos, rotas e acoes com base no mesmo snapshot;
5. o backend bloquear acesso indevido mesmo com manipulacao manual de URL/payload;
6. o edge/local mode respeitar o mesmo escopo;
7. alteracoes de IAM forem auditadas;
8. existir suite minima de testes unitarios, integracao, contrato e e2e para os cenario criticos.

## 12. Sequencia recomendada de execucao

Ordem recomendada para reduzir risco:

1. `IAM-00` inventario de modulos e permissoes
2. `IAM-01` gates minimos dos canais
3. `IAM-02` membership por tenant
4. `IAM-03` grupos de permissao
5. `IAM-04` escopo unificado `TENANT` x `SITE`
6. `IAM-05` enforcement no backend
7. `IAM-06` tela de grupos no `Management`
8. `IAM-07` tela de usuarios IAM
9. `IAM-08` navegacao dinamica no `Management`
10. `IAM-09` navegacao dinamica no `PWA-reviewed`
11. `IAM-10` overrides por usuario
12. `IAM-12` endurecimento com RLS e isolamento reforcado

## 13. Observacoes finais

Direcionamento recomendado:

1. nao reescrever auth agora;
2. nao criar microservico de IAM neste momento;
3. nao multiplicar `roles` fixas para cada necessidade de negocio;
4. usar `system role + permission groups + scope + allowed sites`;
5. tratar `Sindico` como grupo funcional de negocio, nao como substituto de `Platform Admin` ou `Tenant Admin`;
6. garantir que o resultado final seja um IAM unico de produto, e nao regras paralelas em cada app.
