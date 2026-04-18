import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'MD Extractor',
  version: '0.1.0',
  description: 'Extrae contenido relevante de paginas de compras y lo organiza como Markdown.',
  minimum_chrome_version: '116',
  background: {
    service_worker: 'src/background/main.ts',
    type: 'module',
  },
  action: {
    default_title: 'Abrir MD Extractor',
  },
  permissions: ['activeTab', 'clipboardWrite', 'scripting', 'sidePanel', 'storage', 'tabs'],
  optional_host_permissions: ['http://*/*', 'https://*/*'],
  host_permissions: ['http://127.0.0.1/*', 'http://localhost/*'],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
});
