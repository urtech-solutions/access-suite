export const APP_NAME = "AccessOS";
export const APP_TAGLINE = "Controle de acesso inteligente para o seu condomínio.";
export const DEFAULT_API_BASE_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "/api" : "http://localhost:3000");
