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

async function activatePicker(panel: Page): Promise<void> {
  await panel.getByRole('button', { name: /Activar picker/i }).click();
  await expect(panel.getByText(/Picker activo/i)).toBeVisible();
}

function summaryRegion(panel: Page) {
  return panel.getByLabel('Resumen pagina');
}

function selectionRegion(panel: Page) {
  return panel.getByLabel('Selecciones guardadas');
}

test('captura por click y drag, agrega nota y copia markdown', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const productPage = await context.newPage();
  await productPage.goto(`${serverOrigin}/generic-product.html`);
  const tabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/generic-product.html`);
  const panel = await openPanel(context, extensionId, tabId);

  await activatePicker(panel);
  await expect(summaryRegion(panel).getByText('Cafetera Nimbus 2L', { exact: true })).toBeVisible();

  await productPage.locator('h1').click();
  await expect(
    selectionRegion(panel)
      .getByText(/Cafetera Nimbus 2L/i)
      .first(),
  ).toBeVisible();

  await productPage.locator('.price').click();
  await expect(
    selectionRegion(panel)
      .getByText(/\$89\.900/i)
      .first(),
  ).toBeVisible();

  await productPage.locator('#description').evaluate((element) => {
    const selection = window.getSelection();
    if (selection == null) {
      return;
    }

    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.addRange(range);
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });

  await expect(
    selectionRegion(panel)
      .getByText(/temporizador y filtro lavable/i)
      .first(),
  ).toBeVisible();

  await panel.getByLabel('Etiqueta de nota').fill('Nota manual');
  await panel.getByLabel('Nota manual').fill('Comparar precio con marketplaces locales.');
  await panel.getByRole('button', { name: /Guardar nota/i }).click();
  await expect(panel.getByText(/Nota guardada/i)).toBeVisible();

  await panel.getByRole('button', { name: /Copiar Markdown/i }).click();
  await expect(panel.getByText(/Markdown copiado/i)).toBeVisible();
  await expect(panel.getByLabel('Preview markdown').getByText(/\$89\.900/)).toBeVisible();
  await expect(panel.getByLabel('Preview markdown')).toContainText('# Cafetera Nimbus 2L');
  await expect(
    panel.getByLabel('Preview markdown').getByText('Comparar precio con marketplaces locales.'),
  ).toBeVisible();
  await expect(panel.getByLabel('Preview markdown').getByText(/^Fuente:/)).toHaveCount(0);
  await expect(panel.getByLabel('Preview markdown').getByText(/Referencia DOM/)).toHaveCount(0);

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
  await activatePicker(firstPanel);
  await productPage.locator('#description').click();
  await expect(
    selectionRegion(firstPanel)
      .getByText(/Cafetera con jarra termica/i)
      .first(),
  ).toBeVisible();
  await firstPanel.close();

  const reopenedPanel = await openPanel(context, extensionId, tabId);
  await expect(
    selectionRegion(reopenedPanel)
      .getByText(/Cafetera con jarra termica/i)
      .first(),
  ).toBeVisible();
});

test('agrega y quita contexto al inicio del markdown', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const productPage = await context.newPage();
  await productPage.goto(`${serverOrigin}/generic-product.html`);
  const tabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/generic-product.html`);
  const panel = await openPanel(context, extensionId, tabId);

  await expect(panel.getByRole('button', { name: /Capturar principal/i })).toHaveCount(0);
  await activatePicker(panel);
  await productPage.locator('#description').click();
  await expect(
    selectionRegion(panel)
      .getByText(/Cafetera con jarra termica/i)
      .first(),
  ).toBeVisible();

  await panel.getByRole('button', { name: /Agregar contexto/i }).click();
  await expect(panel.getByText(/Contexto agregado al Markdown/i)).toBeVisible();
  await expect(panel.getByRole('button', { name: /Quitar contexto/i })).toBeVisible();
  await expect(panel.getByLabel('Preview markdown')).toContainText('## Contexto');
  await expect(panel.getByLabel('Preview markdown')).toContainText(
    `${serverOrigin}/generic-product.html`,
  );

  await panel.getByRole('button', { name: /Quitar contexto/i }).click();
  await expect(panel.getByText(/Contexto removido del Markdown/i)).toBeVisible();
  await expect(panel.getByRole('button', { name: /Agregar contexto/i })).toBeVisible();
  await expect(panel.getByLabel('Preview markdown').getByText('## Contexto')).toHaveCount(0);

  await panel.close();
  await productPage.close();
});

test('mantiene highlight amarillo y segundo click lo desactiva', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const productPage = await context.newPage();
  await productPage.goto(`${serverOrigin}/generic-product.html`);
  const tabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/generic-product.html`);
  const panel = await openPanel(context, extensionId, tabId);

  await activatePicker(panel);

  const heading = productPage.locator('h1');
  await heading.click();
  await expect(
    selectionRegion(panel)
      .getByText(/Cafetera Nimbus 2L/i)
      .first(),
  ).toBeVisible();
  await expect(heading).toHaveAttribute('data-md-extractor-selected', 'true');

  await heading.click();
  await expect(selectionRegion(panel).getByText(/Cafetera Nimbus 2L/i)).toHaveCount(0);
  await expect(heading).not.toHaveAttribute('data-md-extractor-selected', 'true');

  await panel.close();
  await productPage.close();
});

test('sincroniza highlight con borrado desde side panel', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const productPage = await context.newPage();
  await productPage.goto(`${serverOrigin}/generic-product.html`);
  const tabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/generic-product.html`);
  const panel = await openPanel(context, extensionId, tabId);

  await activatePicker(panel);

  const description = productPage.locator('#description');
  await description.click();
  await expect(
    selectionRegion(panel)
      .getByText(/Cafetera con jarra termica/i)
      .first(),
  ).toBeVisible();
  await expect(description).toHaveAttribute('data-md-extractor-selected', 'true');

  await selectionRegion(panel)
    .getByRole('button', { name: /Eliminar/i })
    .first()
    .click();
  await expect(selectionRegion(panel).getByText(/Cafetera con jarra termica/i)).toHaveCount(0);
  await expect(description).not.toHaveAttribute('data-md-extractor-selected', 'true');

  await panel.close();
  await productPage.close();
});

test('mantiene drafts separados por tab', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const firstPage = await context.newPage();
  await firstPage.goto(`${serverOrigin}/generic-product.html`);
  const secondPage = await context.newPage();
  await secondPage.goto(`${serverOrigin}/generic-product-alt.html`);

  const firstTabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/generic-product.html`);
  const secondTabId = await getTabIdForUrl(
    serviceWorker,
    `${serverOrigin}/generic-product-alt.html`,
  );

  const firstPanel = await openPanel(context, extensionId, firstTabId);
  await activatePicker(firstPanel);
  await firstPage.locator('#description').click();
  await expect(
    selectionRegion(firstPanel)
      .getByText(/Cafetera con jarra termica/i)
      .first(),
  ).toBeVisible();
  await firstPanel.close();

  const secondPanel = await openPanel(context, extensionId, secondTabId);
  await activatePicker(secondPanel);
  await secondPage.locator('#description').click();
  await expect(
    selectionRegion(secondPanel)
      .getByText(/Licuadora compacta/i)
      .first(),
  ).toBeVisible();

  const reopenedFirst = await openPanel(context, extensionId, firstTabId);
  await expect(
    selectionRegion(reopenedFirst)
      .getByText(/Cafetera con jarra termica/i)
      .first(),
  ).toBeVisible();
  await expect(selectionRegion(reopenedFirst).getByText(/Licuadora compacta/i)).toHaveCount(0);
});

test('autocompleta metadata para fixture tipo Amazon', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const amazonPage = await context.newPage();
  await amazonPage.goto(`${serverOrigin}/amazon-product.html`, { waitUntil: 'domcontentloaded' });
  const amazonTabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/amazon-product.html`);
  const amazonPanel = await openPanel(context, extensionId, amazonTabId);
  await activatePicker(amazonPanel);
  await expect(
    summaryRegion(amazonPanel).getByText('Sony WH-1000XM5 Wireless Headphones'),
  ).toBeVisible();
  await expect(summaryRegion(amazonPanel).getByText('$399.99')).toBeVisible();
  await amazonPanel.close();
  await amazonPage.close();
});

test('autocompleta metadata para fixture tipo Shopify', async ({
  context,
  extensionId,
  serviceWorker,
  serverOrigin,
}) => {
  const shopifyPage = await context.newPage();
  await shopifyPage.goto(`${serverOrigin}/shopify-product.html`, { waitUntil: 'domcontentloaded' });
  const shopifyTabId = await getTabIdForUrl(serviceWorker, `${serverOrigin}/shopify-product.html`);
  const shopifyPanel = await openPanel(context, extensionId, shopifyTabId);
  await activatePicker(shopifyPanel);
  await expect(summaryRegion(shopifyPanel).getByText('North Studio Canvas Tote')).toBeVisible();
  await expect(summaryRegion(shopifyPanel).getByText('$48.00')).toBeVisible();
  await shopifyPanel.close();
  await shopifyPage.close();
});
