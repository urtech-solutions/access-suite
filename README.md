# Security Vision Access

App mobile-first para validacao do MVP de moradores e sindicos da plataforma Security Vision.

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- TanStack Query

## Modos de uso

### Desenvolvimento local

```bash
npm install
npm run dev:mobile
```

App em:

```text
http://localhost:5123
```

Esse fluxo abre o shell mobile direto no navegador, sem subpath, com proxy
local para a API. O alvo padrao do proxy agora e `http://localhost:3333`; se
voce precisar apontar para outro backend, ajuste `VITE_DEV_API_PROXY_TARGET`.

### Desenvolvimento web no subpath AccessOS

```bash
npm run dev
```

App em:

```text
http://localhost:3004/access-os/
```

Esse modo replica o publish web sob `/access-os/`, util para validar assets,
links e base path antes de subir no gateway HTTPS.

### Validacao mobile em Docker

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up -d --build
```

App em:

```text
http://SEU_IP_LOCAL:8088
```

Esse fluxo sobe apenas o runtime do app, em build de producao, apontando para o backend real configurado em `VITE_API_URL`.

### Desenvolvimento em Docker com hot reload

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker --profile dev up -d --build access_dev
```

App em:

```text
http://SEU_IP_LOCAL:8080
```

O container de desenvolvimento so sobe quando solicitado com `--profile dev`.

## Contrato atual de autenticacao

O app deixou de alternar entre `preview` e `backend`. O fluxo atual e
backend-only:

- login em `auth/access-os/login`
- reidratacao de sessao em `auth/access-os/me`
- bloqueio em tela de `sem acesso` quando a conta autenticada nao possui
  contexto residencial ativo
- selecao de residencia apenas entre contextos reais retornados pelo backend

## Documentacao

- `docs/mobile-app-architecture.md`
- `docs/mobile-validation.md`

## Validacao de qualidade

```bash
npm run build
npm run lint
npm run test
```
