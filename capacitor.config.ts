import type { CapacitorConfig } from '@capacitor/cli';

// --------------------------------------------------------------------
// Capacitor config — AccessOS App (Morador / Síndico)
//
// Backend em produção: https://api.urtechsolucoes.com
// App web em produção: https://app.urtechsolucoes.com
//
// Para LIVE RELOAD durante desenvolvimento no device:
//   1. Descubra o IP do WSL2: hostname -I | awk '{print $1}'
//   2. Descomente o bloco `server` abaixo com o IP correto
//   3. Rode: npm run dev   (WSL2, porta 8080)
//   4. Rode: npx cap run android --livereload --external
//   5. NUNCA commite com server.url ativo
// --------------------------------------------------------------------

const config: CapacitorConfig = {
  appId: 'com.urtechsolucoes.accessos',
  appName: 'AccessOS',
  webDir: 'dist',

  // Live reload (desenvolvimento) — descomente somente durante testes no device:
  // server: {
  //   url: 'http://SEU_IP_WSL2:8080',
  //   cleartext: true,
  // },

  android: {
    // O build usa VITE_API_URL=https://api.urtechsolucoes.com (sem proxy nginx)
    // Permite requisições para domínio externo a partir da WebView
    allowMixedContent: false,     // HTTPS obrigatório em produção
    captureInput: true,           // melhora UX em campos de formulário
    webContentsDebuggingEnabled: false, // true somente em debug builds
  },

  ios: {
    // iOS impõe ATS (App Transport Security): HTTPS é obrigatório por padrão
    // api.urtechsolucoes.com usa HTTPS — sem ajuste necessário
    contentInset: 'automatic',
    scrollEnabled: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#3a2408',       // tema do AccessOS (theme_color do manifest)
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },

    StatusBar: {
      style: 'light',                   // texto/ícones claros (fundo escuro)
      backgroundColor: '#3a2408',
      overlaysWebView: false,
    },

    // PushNotifications — ativar quando Firebase/FCM for configurado
    // PushNotifications: {
    //   presentationOptions: ['badge', 'sound', 'alert'],
    // },
  },
};

export default config;
