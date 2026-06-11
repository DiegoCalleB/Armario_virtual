import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

function injectEnvPlugin() {
  return {
    name: 'inject-env',
    transformIndexHtml(html: string) {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
      return html.replace(
        '<head>',
        `<head>
    <script>
      window.VITE_SUPABASE_URL = ${JSON.stringify(supabaseUrl)};
      window.VITE_SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey)};
    </script>`
      );
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), injectEnvPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
