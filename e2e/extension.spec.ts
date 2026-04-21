import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  type BrowserContext,
  test as base,
  chromium,
  expect,
  type Page,
  type Worker,
} from '@playwright/test';

interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
  serverOrigin: string;
}

const fixtureMap: Record<string, string> = {
  '/generic-product.html': 'generic-product.html',
  '/generic-product-alt.html': 'generic-product-alt.html',
  '/amazon-product.html': 'amazon-product.html',
  '/amazon-product-important-info.html': 'amazon-product-important-info.html',
  '/amazon-product-noisy.html': 'amazon-product-noisy.html',
  '/shopify-product.html': 'shopify-product.html',
};

const test = base.extend<ExtensionFixtures>({
  serverOrigin: async ({ browserName: _browserName }, use) => {
    const server = await startFixtureServer();
    const address = server.address();
    if (address == null || typeof address === 'string') {
      throw new Error('No fue posible obtener el puerto del servidor de fixtures.');
    }

    await use(`http://127.0.0.1:${address.port}`);
    await new Promise<void>((resolvePromise, rejectPromise) => {
      server.close((error) => {
        if (error != null) {
          rejectPromise(error);
          return;
        }
        resolvePromise();
      });
    });
  },
  context: async ({ browserName: _browserName }, use) => {
    const extensionPath = resolve(process.cwd(), 'dist');
    const userDataDir = mkdtempSync(resolve(tmpdir(), 'md-extractor-playwright-'));
    const env = process.env as NodeJS.ProcessEnv & { PW_HEADLESS?: string };
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: env.PW_HEADLESS !== 'false',
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });

    await use(context);
    await context.close();
    rmSync(userDataDir, { recursive: true, force: true });
  },
  serviceWorker: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (worker == null) {
      worker = await context.waitForEvent('serviceworker');
    }

    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    const extensionId = new URL(serviceWorker.url()).host;
    await use(extensionId);
  },
});

test.setTimeout(120_000);

async function startFixtureServer(): Promise<Server> {
  const server = createServer((request, response) => {
    const pathname = request.url == null ? '/' : new URL(request.url, 'http://127.0.0.1').pathname;
    const fixtureName = fixtureMap[pathname];

    if (fixtureName == null) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const body = readFileSync(resolve(process.cwd(), 'tests/fixtures', fixtureName), 'utf8');
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(body);
  });

  await new Promise<void>((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => resolvePromise());
  });

  return server;
}

async function getTabIdForUrl(serviceWorker: Worker, url: string): Promise<number> {
  const tabId = await serviceWorker.evaluate(async (targetUrl) => {
    const [tab] = await chrome.tabs.query({ url: targetUrl });
    return tab?.id ?? null;
  }, url);

  if (tabId == null) {
    throw new Error(`No se encontro tabId para ${url}`);
  }

  return tabId;
}

async function openPanel(
  context: BrowserContext,
  extensionId: string,
  tabId: number,
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html?tabId=${tabId}`);
  return page;
}

function previewRegion(panel: Page) {
  return panel.getByLabel('Preview markdown');
}

async function activateExtraction(panel: Page): Promise<void> {
  await panel.getByRole('button', { name: /Activar extracción/i }).click();
}

async function expectPickerVisualsClean(page: Page): Promise<void> {
  await expect(page.locator('[data-md-extractor-selected="true"]')).toHaveCount(0);
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.style.cursor || ''))
    .toBe('');
  await expect
    .poll(async () =>
      page.evaluate(() => {
        return Array.from(document.querySelectorAll('[data-md-extractor-overlay="true"]')).filter(
          (element) => window.getComputedStyle(element).opacity !== '0',
        ).length;
      }),
    )
    .toBe(0);
}

test('autoextrae al activar y genera markdown en orden DOM', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const productPage = await context.newPage();
  await productPage.goto(`${serverOrigin}/generic-product.html`);
  const tabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/generic-product.html`);
  const panel = await openPanel(context, extensionId, tabId);

  await activateExtraction(panel);
  await expect(previewRegion(panel)).toContainText('# Cafetera Nimbus 2L');
  await expect(previewRegion(panel)).toContainText('$89.900');
  await expect(previewRegion(panel)).toContainText('Cafetera con jarra termica');

  const previewText = (await previewRegion(panel).textContent()) ?? '';
  expect(previewText.indexOf('# Cafetera Nimbus 2L')).toBeLessThan(previewText.indexOf('$89.900'));
  expect(previewText.indexOf('$89.900')).toBeLessThan(
    previewText.indexOf('Cafetera con jarra termica'),
  );

  await panel.close();
  await productPage.close();
});

test('persiste el draft por pestaña al reabrir el panel', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const productPage = await context.newPage();
  await productPage.goto(`${serverOrigin}/generic-product.html`);
  const tabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/generic-product.html`);

  const firstPanel = await openPanel(context, extensionId, tabId);
  await activateExtraction(firstPanel);
  await expect(previewRegion(firstPanel)).toContainText('Cafetera con jarra termica');
  await firstPanel.close();

  const reopenedPanel = await openPanel(context, extensionId, tabId);
  await expect(previewRegion(reopenedPanel)).toContainText('Cafetera con jarra termica');

  await reopenedPanel.close();
  await productPage.close();
});

test('el panel muestra solo el toggle principal y un boton secundario de reextraccion', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const productPage = await context.newPage();
  await productPage.goto(`${serverOrigin}/generic-product.html`);
  const tabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/generic-product.html`);
  const panel = await openPanel(context, extensionId, tabId);

  await activateExtraction(panel);
  await expect(previewRegion(panel)).toContainText('# Cafetera Nimbus 2L');
  await expect(panel.getByRole('button', { name: /Activar extracción/i })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: /Pausar extracción/i })).toHaveCount(1);
  await expect(panel.getByRole('button', { name: /Extraer de nuevo/i })).toHaveCount(1);
  await expect(panel.getByRole('button', { name: /Copiar Markdown/i })).toHaveCount(1);
  await expect(panel.getByRole('button', { name: /Agregar contexto/i })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: /Acciones/i })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: /^Reiniciar$/i })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: /^Limpiar todo$/i })).toHaveCount(0);

  await panel.close();
  await productPage.close();
});

test('mantiene highlight amarillo y click toggles quita y vuelve a agregar en orden', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const productPage = await context.newPage();
  await productPage.goto(`${serverOrigin}/generic-product.html`);
  const tabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/generic-product.html`);
  const panel = await openPanel(context, extensionId, tabId);

  await activateExtraction(panel);

  const heading = productPage.locator('h1');
  await expect(heading).toHaveAttribute('data-md-extractor-selected', 'true');

  await heading.click();
  await expect(heading).not.toHaveAttribute('data-md-extractor-selected', 'true');
  await expect(previewRegion(panel).getByText('# Cafetera Nimbus 2L')).toHaveCount(0);

  await heading.click();
  await expect(heading).toHaveAttribute('data-md-extractor-selected', 'true');
  await expect(previewRegion(panel)).toContainText('# Cafetera Nimbus 2L');

  const previewText = (await previewRegion(panel).textContent()) ?? '';
  expect(previewText.indexOf('# Cafetera Nimbus 2L')).toBeLessThan(previewText.indexOf('$89.900'));

  await panel.close();
  await productPage.close();
});

test('quitar un bloque desde el preview elimina la selección y sincroniza highlights', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const productPage = await context.newPage();
  await productPage.goto(`${serverOrigin}/generic-product.html`);
  const tabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/generic-product.html`);
  const panel = await openPanel(context, extensionId, tabId);

  await activateExtraction(panel);

  const heading = productPage.locator('h1');
  await expect(heading).toHaveAttribute('data-md-extractor-selected', 'true');
  await expect(previewRegion(panel)).toContainText('# Cafetera Nimbus 2L');

  await panel.getByRole('button', { name: /Quitar bloque 1/i }).click();

  await expect(panel.getByText(/Bloque eliminado/i)).toBeVisible();
  await expect(previewRegion(panel).getByText('# Cafetera Nimbus 2L')).toHaveCount(0);
  await expect(previewRegion(panel)).toContainText('$89.900');
  await expect(heading).not.toHaveAttribute('data-md-extractor-selected', 'true');

  await panel.close();
  await productPage.close();
});

test('pausar extracción limpia la página visualmente sin perder el draft', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const productPage = await context.newPage();
  await productPage.goto(`${serverOrigin}/generic-product.html`);
  const tabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/generic-product.html`);
  const panel = await openPanel(context, extensionId, tabId);

  await activateExtraction(panel);
  await expect(productPage.locator('h1')).toHaveAttribute('data-md-extractor-selected', 'true');

  await panel.getByRole('button', { name: /Pausar extracción/i }).click();
  await expect(panel.getByText(/Extracción pausada/i)).toBeVisible();
  await expectPickerVisualsClean(productPage);

  const reopenedPanel = await openPanel(context, extensionId, tabId);
  await expect(previewRegion(reopenedPanel)).toContainText('# Cafetera Nimbus 2L');

  await reopenedPanel.close();
  await panel.close();
  await productPage.close();
});

test('cerrar el panel limpia la página visualmente y preserva el draft al reabrir', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const productPage = await context.newPage();
  await productPage.goto(`${serverOrigin}/generic-product.html`);
  const tabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/generic-product.html`);
  const panel = await openPanel(context, extensionId, tabId);

  await activateExtraction(panel);
  await expect(productPage.locator('h1')).toHaveAttribute('data-md-extractor-selected', 'true');

  await panel.close();
  await expectPickerVisualsClean(productPage);

  const reopenedPanel = await openPanel(context, extensionId, tabId);
  await expect(previewRegion(reopenedPanel)).toContainText('# Cafetera Nimbus 2L');
  await expect(reopenedPanel.getByRole('button', { name: /Activar extracción/i })).toHaveCount(1);

  await reopenedPanel.close();
  await productPage.close();
});

test('reiniciar regenera la extracción desde cero', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const productPage = await context.newPage();
  await productPage.goto(`${serverOrigin}/generic-product.html`);
  const tabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/generic-product.html`);
  const panel = await openPanel(context, extensionId, tabId);

  await activateExtraction(panel);
  const heading = productPage.locator('h1');
  await heading.click();
  await expect(previewRegion(panel).getByText('# Cafetera Nimbus 2L')).toHaveCount(0);

  await panel.getByRole('button', { name: /Extraer de nuevo/i }).click();
  await expect(panel.getByText(/Extracción reiniciada/i)).toBeVisible();
  await expect(previewRegion(panel)).toContainText('# Cafetera Nimbus 2L');
  await expect(heading).toHaveAttribute('data-md-extractor-selected', 'true');

  await panel.close();
  await productPage.close();
});

test('Amazon revela secciones ocultas seguras antes de extraer', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const amazonPage = await context.newPage();
  await amazonPage.goto(`${serverOrigin}/amazon-product.html`, { waitUntil: 'domcontentloaded' });
  const amazonTabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/amazon-product.html`);
  const amazonPanel = await openPanel(context, extensionId, amazonTabId);

  await activateExtraction(amazonPanel);

  await expect(previewRegion(amazonPanel)).toContainText('Battery life up to 30 hours');
  await expect(previewRegion(amazonPanel)).not.toContainText(
    'Customers often keep this item with a travel case',
  );
  await expect(amazonPage.locator('#feature-bullets-hidden')).not.toHaveAttribute('hidden', '');

  await amazonPanel.close();
  await amazonPage.close();
});

test('Amazon aprovecha product quick view preloaded para extraer información útil sin ruido del overlay', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const amazonPage = await context.newPage();
  await amazonPage.goto(`${serverOrigin}/amazon-product.html`, { waitUntil: 'domcontentloaded' });
  const amazonTabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/amazon-product.html`);
  const amazonPanel = await openPanel(context, extensionId, amazonTabId);

  await activateExtraction(amazonPanel);

  await expect(previewRegion(amazonPanel)).toContainText('## Important information');
  await expect(previewRegion(amazonPanel)).toContainText(
    'Jerusalem artichoke root, chicory root fiber, vegetable capsule.',
  );
  await expect(previewRegion(amazonPanel)).not.toContainText(
    'Report an issue with this product or seller',
  );
  await expect(previewRegion(amazonPanel)).not.toContainText('Was this summary helpful?');

  await amazonPanel.close();
  await amazonPage.close();
});

test('Amazon agrega detalles del producto y especificaciones reveladas programáticamente', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const amazonPage = await context.newPage();
  await amazonPage.goto(`${serverOrigin}/amazon-product.html`, { waitUntil: 'domcontentloaded' });
  const amazonTabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/amazon-product.html`);
  const amazonPanel = await openPanel(context, extensionId, amazonTabId);

  await activateExtraction(amazonPanel);

  await expect(previewRegion(amazonPanel)).toContainText('# Sony WH-1000XM5 Wireless Headphones');
  const previewText = (await previewRegion(amazonPanel).textContent()) ?? '';
  expect(previewText.indexOf('# Sony WH-1000XM5 Wireless Headphones')).toBeLessThan(
    previewText.indexOf('Midnight Blue'),
  );

  await expect(previewRegion(amazonPanel)).toContainText('027242923473');
  await expect(previewRegion(amazonPanel)).toContainText('Midnight Blue');
  await expect(previewRegion(amazonPanel)).toContainText('Bluetooth 5.2');
  await expect(previewRegion(amazonPanel)).toContainText('10 x 8 x 3 inches');

  await amazonPanel.close();
  await amazonPage.close();
});

test('Amazon filtra ruido inicial y fusiona metadata util en una sola tabla', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const amazonPage = await context.newPage();
  await amazonPage.goto(`${serverOrigin}/amazon-product-noisy.html`, {
    waitUntil: 'domcontentloaded',
  });
  const amazonTabId = await getTabIdForUrl(
    serviceWorker,
    `${serverOrigin}/amazon-product-noisy.html`,
  );
  const amazonPanel = await openPanel(context, extensionId, amazonTabId);

  await activateExtraction(amazonPanel);

  const preview = previewRegion(amazonPanel);
  await expect(preview).toContainText("# Physician's Choice Probióticos 60 mil millones");
  await expect(preview).toContainText('US$24.97');
  await expect(preview).toContainText('| Campo | Valor |');
  await expect(preview).toContainText(
    '| Total del paquete según la medida elegida para referenciar precio | 30 Conteo |',
  );
  await expect(preview).toContainText('| Sabor | Probiótico 60B |');
  await expect(preview).toContainText('| Color | No |');
  await expect(preview).not.toContainText('Enviar a Cristian');
  await expect(preview).not.toContainText('No se puede agregar el artículo a la Lista');
  await expect(preview).not.toContainText(
    'No puede enviarse este producto al punto de entrega seleccionado',
  );
  await expect(preview).not.toContainText('US$19.97');
  await expect(preview).not.toContainText('US$30.99');
  await expect(preview).not.toContainText('US$39.97');
  await expect(preview).not.toContainText('![Imagen');

  const previewText = (await preview.textContent()) ?? '';
  expect(previewText.indexOf("# Physician's Choice Probióticos 60 mil millones")).toBeLessThan(
    previewText.indexOf('| Campo | Valor |'),
  );

  await amazonPanel.close();
  await amazonPage.close();
});

test('Amazon incluye la sección de información importante con subsecciones semánticas', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const amazonPage = await context.newPage();
  await amazonPage.goto(`${serverOrigin}/amazon-product-important-info.html`, {
    waitUntil: 'domcontentloaded',
  });
  const amazonTabId = await getTabIdForUrl(
    serviceWorker,
    `${serverOrigin}/amazon-product-important-info.html`,
  );
  const amazonPanel = await openPanel(context, extensionId, amazonTabId);

  await activateExtraction(amazonPanel);

  const preview = previewRegion(amazonPanel);
  await expect(preview).toContainText('## Información importante');
  await expect(preview).toContainText('### Información de seguridad');
  await expect(preview).toContainText('### Indicaciones');
  await expect(preview).toContainText('### Ingredientes');
  await expect(preview).toContainText('### Instrucciones');
  await expect(preview).toContainText('### Exclusión de garantías y responsabilidad');
  await expect(preview).toContainText('Mantener fuera del alcance de los niños.');
  await expect(preview).toContainText('Tomar para la salud intestinal');
  await expect(preview).toContainText('Lactobacillus casei, Lactobacillus acidophilus');
  await expect(preview).toContainText(
    'Como suplemento dietético, tome una (1) cápsula vegetal una vez al día.',
  );
  await expect(preview).toContainText(
    'Las declaraciones relacionadas con suplementos dietéticos no han sido evaluadas',
  );
  await expect(preview).not.toContainText('Informar de un problema con este producto o vendedor');
  await expect(preview).not.toContainText('¿Te pareció útil esta función de resumen del producto?');

  const previewText = (await preview.textContent()) ?? '';
  expect(previewText.match(/### Exclusión de garantías y responsabilidad/g)?.length ?? 0).toBe(1);

  await amazonPanel.close();
  await amazonPage.close();
});
