import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vitePluginSqlite } from './server/vitePluginSqlite.js';

export default defineConfig({
  plugins: [react(), vitePluginSqlite()],
});
