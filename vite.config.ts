import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load ALL env vars from .env.local (no prefix filter)
  // so CLAUDE_API_KEY is available server-side without the VITE_ prefix
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),

      // SiliconFlow API proxy – injects SILICONFLOW_API_KEY on the server side
      // so the key never reaches the browser
      {
        name: 'siliconflow-api-proxy',
        configureServer(server) {
          server.middlewares.use('/api/claude/v1/messages', (req: any, res: any) => {
            const apiKey = env.SILICONFLOW_API_KEY;

            if (!apiKey) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  error: {
                    message: '未找到 SILICONFLOW_API_KEY。请在 .env.local 中添加：\nSILICONFLOW_API_KEY=sk-...',
                  },
                }),
              );
              return;
            }

            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => {
              chunks.push(chunk);
            });
            req.on('end', async () => {
              const body = Buffer.concat(chunks);
              try {
                const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                  },
                  body,
                });

                res.statusCode = response.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(await response.text());
              } catch (e: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: { message: e.message ?? '请求失败' } }));
              }
            });
          });
        },
      },
    ],

    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
  };
});
