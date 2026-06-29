# Validacao No Celular

## Objetivo

Validar o MVP mobile diretamente no navegador do celular, sem empacotar Android/iOS ainda.

## Pre-requisitos

- celular e computador na mesma rede Wi-Fi;
- dependencias instaladas no `access-suite`;
- porta `5123` liberada na maquina onde o app vai rodar.

## Modo mais rapido

No diretorio `access-suite`, execute:

```bash
npm run dev:mobile
```

Depois, no celular, abra:

```text
http://SEU_IP_LOCAL:5123
```

Exemplo:

```text
http://192.168.0.15:5123
```

## Validacao com Docker

Copie o arquivo de ambiente:

```bash
cp .env.docker.example .env.docker
```

### Runtime padrao do app em container

```bash
docker compose --env-file .env.docker up -d --build
```

Depois abra no celular:

```text
http://SEU_IP_LOCAL:3004
```

Esse `up` padrao sobe apenas o runtime do app, em build de producao, com foco no fluxo real de backend.

### Desenvolvimento com hot reload em container

```bash
docker compose --env-file .env.docker --profile dev up -d --build access_dev
```

Depois abra no celular:

```text
http://SEU_IP_LOCAL:8080
```

Observacao: o `profile dev` em Docker continua em `8080`, mas o
desenvolvimento local fora do container passou a usar `npm run dev:mobile` em
`5123`.

## O que foi adicionado para isso

- `Dockerfile` multi-stage;
- `docker-compose.yml` com runtime padrao e modo dev sob `profile`;
- `.env.docker.example` para portas e URL da API;
- `docker/nginx.conf` para servir o build do app com fallback SPA.

## Como descobrir o IP local da maquina

### Linux

```bash
hostname -I
```

### Windows

```powershell
ipconfig
```

Use o IPv4 da placa de rede conectada ao Wi-Fi.

## Runtime padrao do compose

O `docker compose up -d --build` agora reflete o ambiente real do app:

- sobe apenas o container runtime;
- inicia direto na autenticacao real;
- usa `VITE_API_URL` apontando para a API real;
- o container de desenvolvimento so sobe se voce pedir explicitamente com `--profile dev`.

## Validacao com backend real do morador

Quando quiser validar integracao:

1. suba o backend;
2. no backend, inclua o origin do app em `CORS_ORIGIN`:
   - `http://SEU_IP_LOCAL:3004`
   - `http://SEU_IP_LOCAL:5123`
   - `http://SEU_IP_LOCAL:8080` se tambem usar o profile `dev`
3. recrie o backend para aplicar o `.env`;
4. abra o app no celular;
5. abra `Entrar com CPF` na tela inicial;
6. altere `VITE_API_URL` no `.env.docker` ou a URL da API na tela `Perfil e conexao` para o IP da sua maquina com a porta do backend;
7. informe um CPF liberado em `Pessoas > Uso do APP`;
8. se for o primeiro acesso do CPF, crie a senha;
9. se o CPF estiver em mais de um site/tenant, selecione a unidade desejada;
10. valide os modulos reais do app.

Exemplo de API:

```text
http://192.168.0.15:3000
```

## Alternativa mais estavel

Para testar um build de producao local:

```bash
npm run build
npm run preview:mobile
```

Depois abra no celular:

```text
http://SEU_IP_LOCAL:4173
```

## Se o celular nao abrir

Verifique:

- se o celular esta na mesma rede;
- se esta usando o IP da maquina host e nao IP de container;
- se firewall/antivirus nao bloqueou a porta;
- se a porta `5123`, `8080` ou `4173` esta liberada;
- se voce abriu com `http://` e nao `https://`.

## Fluxo esperado do backend

- `login` por e-mail e senha em `auth/access-os/login`;
- revalidacao da sessao em `auth/access-os/me`;
- aceite de convite quando a conta ainda nao possui vinculo ativo;
- consumo dos endpoints do app:
  - `resident-app/visitors`
  - `resident-app/incidents`
  - `resident-app/bulletin`
  - `resident-app/common-areas`
  - `resident-app/reservations`

## Validacao do dono do site

Para validar a primeira visao gerencial do dono do site:

1. no Management, acesse `/peoples/access-os-invites`;
2. selecione o site ativo desejado;
3. na secao `Usuarios do app`, informe o e-mail do dono;
4. confirme que o campo `Papel` esta fixo como `Dono do site`;
5. envie o convite;
6. crie ou acesse uma conta AccessOS com o mesmo e-mail;
7. se o envio real de e-mail nao estiver disponivel, use o fallback do backend:
   - consultar `outbox_events.payload.context.verification_code`;
   - ou ler o log `LogEmailTransport` do backend;
8. aceite o token do convite;
9. entre no app em `/access-os/`.

Resultado esperado:

- a home mostra `Gerencia do site`;
- o titulo principal e o nome do site;
- o papel mostrado e `Dono do site`;
- os indicadores operacionais aparecem em modo somente leitura;
- a navegacao inferior mostra apenas `Inicio` e `Perfil`;
- `/access-os/profile` abre a conta e o site ativo;
- acessos diretos a `/access-os/visitors`, `/access-os/common-areas`,
  `/access-os/chat` e `/access-os/incidents` redirecionam para `/access-os/`;
- nao devem aparecer acoes de visitante, reserva, cadastro de pessoas, morador,
  sindico ou condominio nessa visao gerencial.

Validacoes de API recomendadas:

- `GET /access-os/site/overview` deve responder `200` apenas para contexto
  ativo `APP_USER OWNER`;
- contexto `PERSON`, `APP_USER MANAGER`, `APP_USER SUPPORT`, sem contexto ou
  com outro `site_id` deve ser recusado;
- o resumo deve retornar apenas dados do site do contexto ativo.

## Validacao de visoes configuraveis

Para validar a autorizacao configuravel do Access Suite:

1. no Management, acesse `/peoples/access-suite-views`;
2. selecione o site ativo;
3. crie uma visao `Morador completo` com os modulos e acoes esperados;
4. vincule a visao ao tipo de pessoa usado por um morador real;
5. crie uma visao `Visitante basico` com apenas as capacidades desejadas;
6. vincule a visao ao tipo de pessoa usado por um visitante real;
7. confirme no preview da tela que cada pessoa recebe a uniao correta das
   capacidades das tags ativas;
8. entre no app com cada pessoa e valide a navegacao.

Resultado esperado para `Morador completo`:

- `auth/access-os/login` e `auth/access-os/me` retornam
  `user.access_suite.modules`, `user.access_suite.capabilities` e
  `user.access_suite.views`;
- tabs, cards e botoes aparecem somente para capacidades liberadas;
- acoes permitidas executam normalmente;
- `user.modules` continua preenchido para compatibilidade.

Resultado esperado para `Visitante basico`:

- o app mostra apenas Inicio, Perfil, Notificacoes e os modulos explicitamente
  liberados pela visao;
- botoes de criar, cancelar, confirmar, comentar ou enviar mensagem nao
  aparecem sem capacidade correspondente;
- rota direta para modulo sem permissao mostra sem acesso ou redireciona para a
  home, conforme a rota.

Validacoes negativas:

- chamada direta de API sem capacidade deve retornar `403` quando o modulo do
  tenant/site estiver habilitado;
- tag expirada em `person_type_assignments` nao deve contribuir permissao;
- pessoa com multiplas tags ativas deve receber a uniao das visoes vinculadas;
- ao alterar uma visao no Management, a mudanca deve refletir apos
  reidratacao em `auth/access-os/me` ou novo login;
- `APP_USER OWNER` permanece fora das visoes configuraveis e continua somente
  leitura em Inicio e Perfil.

## Atualizacao 2026-06-07

- o app nao alterna mais para modo `preview`; toda validacao deve assumir
  autenticacao real ou mock de API no Vite
- para validar o publish web em subpath, use `npm run dev` e abra
  `http://SEU_IP_LOCAL:3004/access-os/`
- o proxy local do Vite passou a mirar `http://localhost:3333` por padrao

## Recomendacao para esta fase

Para um teste mais proximo do ambiente real, use:

1. `cp .env.docker.example .env.docker`
2. ajuste `VITE_API_URL` para o backend real
3. `docker compose --env-file .env.docker up -d --build`
4. valide o login AccessOS e os modulos reais

Se quiser isolar o ambiente e evitar depender de Node local:

1. `cp .env.docker.example .env.docker`
2. `docker compose --env-file .env.docker up -d --build`
3. abrir `http://SEU_IP_LOCAL:3004`

Depois partimos para:

- ajustes de UX;
- integracao backend;
- empacotamento com Capacitor.
