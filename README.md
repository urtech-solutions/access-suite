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
http://localhost:8080
```

O arquivo `.env.development.local` deixa o app em modo `backend` e habilita
`VITE_DEV_API_MOCK=true`. Nesse modo, o Vite responde as chamadas `/api/*` com
contratos JSON definidos para desenvolvimento, sem exigir o backend real. Para
testar contra o backend real em `VITE_DEV_API_PROXY_TARGET`, altere
`VITE_DEV_API_MOCK=false`.

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

## Documentacao

- `docs/mobile-app-architecture.md`
- `docs/mobile-validation.md`

## Validacao de qualidade

```bash
npm run build
npm run lint
npm run test
```
