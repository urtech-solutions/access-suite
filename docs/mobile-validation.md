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
