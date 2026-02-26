import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'estate-quick-sale',
  brand: {
    displayName: '급매 레이더',
    icon: 'https://estate-quick-sale-backs-projects-87a24f27.vercel.app/icon-512.png',
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
