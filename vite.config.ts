import fs from "node:fs";
import { defineConfig, loadEnv } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { createAccessSuiteDevApiPlugin } from "./src/dev/access-suite-dev-api";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget =
    env.VITE_DEV_API_PROXY_TARGET?.trim() || "http://localhost:3000";
  const keepApiPrefix = env.VITE_DEV_API_PROXY_KEEP_PREFIX === "true";
  const appBasePath = env.VITE_APP_BASE_PATH?.trim() || "/access-os/";
  const devServerPort = Number(
    env.VITE_DEV_SERVER_PORT || env.ACCESS_SUITE_DEV_PORT || 8088,
  );
  const devServerHost = env.VITE_DEV_SERVER_HOST?.trim() || "0.0.0.0";
  const devHttpsEnabled = env.VITE_DEV_HTTPS === "true";
  const devApiMockEnabled = env.VITE_DEV_API_MOCK === "true";
  const devHttpsPfxPath = env.VITE_DEV_HTTPS_PFX
    ? path.resolve(process.cwd(), env.VITE_DEV_HTTPS_PFX)
    : "";
  const devHttps =
    devHttpsEnabled && devHttpsPfxPath && fs.existsSync(devHttpsPfxPath)
      ? {
          pfx: fs.readFileSync(devHttpsPfxPath),
          passphrase: env.VITE_DEV_HTTPS_PFX_PASSPHRASE || undefined,
        }
      : undefined;

  return {
    base: appBasePath,
    server: {
      host: devServerHost,
      port: devServerPort,
      strictPort: true,
      https: devHttps,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (proxyPath) =>
            keepApiPrefix
              ? proxyPath
              : proxyPath.replace(/^\/api(?=\/|$)/, ""),
        },
        "/uploads": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
        "/socket.io": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        "/public/external-events": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [
      devApiMockEnabled && createAccessSuiteDevApiPlugin("/api"),
      react(),
      devHttpsEnabled && !devHttps && basicSsl(),
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
