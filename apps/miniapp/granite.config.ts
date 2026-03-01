import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'estate-quick-sale',
  brand: {
    displayName: '부동산 급매 레이더',
    // Will be updated to Cloudflare tunnel domain once available
    icon: 'https://estate-quick-sale.vercel.app/icon-512.png',
    primaryColor: '#3182f6',
  },
  permissions: [],
  web: {
    port: 5173,
    outdir: 'dist',
    commands: {
      dev: 'npx vite',
      build: 'npx vite build',
    },
  },
});
