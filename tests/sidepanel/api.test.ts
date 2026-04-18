import { ensureOriginPermission, toOriginPermissionPattern } from '@/sidepanel/api';

describe('sidepanel api permissions', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      tabs: {
        get: vi.fn(),
      },
      permissions: {
        contains: vi.fn(),
        request: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('genera patron por origen solo para http y https', () => {
    expect(toOriginPermissionPattern('https://www.amazon.com/product')).toBe(
      'https://www.amazon.com/*',
    );
    expect(toOriginPermissionPattern('http://127.0.0.1:4173/page')).toBe('http://127.0.0.1:4173/*');
    expect(toOriginPermissionPattern('chrome://extensions')).toBeNull();
  });

  it('no solicita permiso si el origen ya esta concedido', async () => {
    const tabsGet = vi.fn().mockResolvedValue({ url: 'https://www.amazon.com/example' });
    const permissionsContains = vi.fn().mockResolvedValue(true);
    const permissionsRequest = vi.fn();

    Object.assign(chrome.tabs, { get: tabsGet });
    Object.assign(chrome.permissions, {
      contains: permissionsContains,
      request: permissionsRequest,
    });

    await ensureOriginPermission(12);

    expect(permissionsContains).toHaveBeenCalledWith({
      origins: ['https://www.amazon.com/*'],
    });
    expect(permissionsRequest).not.toHaveBeenCalled();
  });

  it('solicita permiso cuando el origen aun no esta concedido', async () => {
    const tabsGet = vi.fn().mockResolvedValue({ url: 'https://shop.example.com/product' });
    const permissionsContains = vi.fn().mockResolvedValue(false);
    const permissionsRequest = vi.fn().mockResolvedValue(true);

    Object.assign(chrome.tabs, { get: tabsGet });
    Object.assign(chrome.permissions, {
      contains: permissionsContains,
      request: permissionsRequest,
    });

    await ensureOriginPermission(22);

    expect(permissionsRequest).toHaveBeenCalledWith({
      origins: ['https://shop.example.com/*'],
    });
  });

  it('falla en esquemas no soportados o cuando el usuario rechaza el permiso', async () => {
    Object.assign(chrome.tabs, {
      get: vi.fn().mockResolvedValue({ url: 'chrome://extensions' }),
    });
    Object.assign(chrome.permissions, {
      contains: vi.fn(),
      request: vi.fn(),
    });

    await expect(ensureOriginPermission(1)).rejects.toThrow(/http o https/i);

    Object.assign(chrome.tabs, {
      get: vi.fn().mockResolvedValue({ url: 'https://www.amazon.com/example' }),
    });
    Object.assign(chrome.permissions, {
      contains: vi.fn().mockResolvedValue(false),
      request: vi.fn().mockResolvedValue(false),
    });

    await expect(ensureOriginPermission(1)).rejects.toThrow(/No se concedio acceso/i);
  });
});
