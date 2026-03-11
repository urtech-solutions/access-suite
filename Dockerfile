# =============================================================================
# AccessOS — Mobile App Runtime (React + Vite)
# =============================================================================
# Este Dockerfile suporta dois cenários:
#
# 1. target=runtime
#    Build de produção servido por nginx para o runtime do app.
#
# 2. target=dev
#    Ambiente de desenvolvimento com Vite acessível na rede local.
#
# Build args:
#   VITE_API_URL  — URL da API central acessível pelo navegador do celular
#   VITE_APP_MODE — modo inicial do app (`backend` ou `preview`)
# =============================================================================

# --- Stage 1: dependencies --------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci


# --- Stage 2: development ---------------------------------------------------
FROM node:20-alpine AS dev

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 8080

CMD ["npm", "run", "dev:mobile"]


# --- Stage 3: build ---------------------------------------------------------
FROM deps AS builder

ARG VITE_API_URL=
ARG VITE_APP_MODE=backend
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_APP_MODE=${VITE_APP_MODE}

COPY . .
RUN npm run build


# --- Stage 4: runtime -------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
