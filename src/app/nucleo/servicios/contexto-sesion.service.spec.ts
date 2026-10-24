import 'fake-indexeddb/auto';
import { Injector } from '@angular/core';
import { vi } from 'vitest';
import { ContextoSesion } from './contexto-sesion.service';
import { TokenService } from './token.service';
import { AlmacenSinConexion } from '../sin_conexion/almacen-sin-conexion.service';
import { User } from '../modelos/usuario.model';

describe('Web and installed PWA session isolation', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  function windowServices(mode: string) {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === `(display-mode: ${mode})` }));
    const injector = Injector.create({ providers: [ContextoSesion, TokenService, AlmacenSinConexion] });
    return {
      context: injector.get(ContextoSesion),
      tokens: injector.get(TokenService),
      store: injector.get(AlmacenSinConexion),
    };
  }
  function login(tokens: TokenService, id: string, role: 'ADMIN' | 'CUSTOMER') {
    tokens.saveTokens(`header.${btoa(JSON.stringify({ sub: id }))}.signature`, `refresh-${id}`);
    tokens.saveIdentity({
      id, role, tenant_id: 'company', selected_tenant_id: 'company', branch_id: 'branch',
    } as User);
  }

  it.each(['standalone', 'minimal-ui', 'window-controls-overlay'])(
    'detects installed display mode %s without changing an already opened web session', (mode) => {
      const web = windowServices('browser');
      const pwa = windowServices(mode);
      expect(web.context.channel).toBe('web');
      expect(pwa.context.channel).toBe('pwa');
      expect(windowServices('fullscreen').context.channel).toBe('web');
    },
  );

  it('keeps the legacy web login and never inherits it in the PWA', () => {
    localStorage.setItem('auth_access_token', 'existing-admin');
    localStorage.setItem('auth_refresh_token', 'existing-refresh');
    expect(windowServices('browser').tokens.getAccessToken()).toBe('existing-admin');
    const pwa = windowServices('standalone');
    expect(pwa.tokens.hasToken()).toBe(false);
    expect(pwa.tokens.getRefreshToken()).toBeNull();
    expect(pwa.tokens.getIdentity()).toBeNull();
  });

  it('retains different users on reopen and logs out only the selected application', () => {
    const web = windowServices('browser');
    login(web.tokens, 'admin', 'ADMIN');
    const pwa = windowServices('standalone');
    login(pwa.tokens, 'customer', 'CUSTOMER');
    expect(web.tokens.getIdentity()?.id).toBe('admin');
    expect(windowServices('browser').tokens.getRefreshToken()).toBe('refresh-admin');
    expect(windowServices('standalone').tokens.getIdentity()?.id).toBe('customer');
    web.tokens.clearTokens();
    expect(pwa.tokens.getIdentity()?.id).toBe('customer');
    login(web.tokens, 'other-admin', 'ADMIN');
    pwa.tokens.clearTokens();
    expect(web.tokens.getIdentity()?.id).toBe('other-admin');
    expect(pwa.tokens.hasToken()).toBe(false);
  });

  it('separates offline cache and pending operations even for the same user and store', async () => {
    const id = crypto.randomUUID();
    const web = windowServices('browser');
    login(web.tokens, id, 'CUSTOMER');
    const pwa = windowServices('standalone');
    login(pwa.tokens, id, 'CUSTOMER');
    const url = '/catalog/' + id;
    await web.store.cache(url, { source: 'web' });
    expect(await pwa.store.cached(url)).toBeUndefined();
    await pwa.store.cache(url, { source: 'pwa' });
    expect((await web.store.cached(url))?.data).toEqual({ source: 'web' });
    await web.store.enqueue('/reservations', { branch_id: 'branch' });
    await pwa.store.refresh();
    expect(pwa.store.operations()).toEqual([]);
    await pwa.store.enqueue('/reservations', { branch_id: 'branch' });
    await web.store.refresh();
    expect(web.store.operations()).toHaveLength(1);
    expect(pwa.store.operations()).toHaveLength(1);
    expect(web.store.operations()[0].id).not.toBe(pwa.store.operations()[0].id);
    const reopened = windowServices('standalone');
    await reopened.store.refresh();
    expect(reopened.store.operations()[0].id).toBe(pwa.store.operations()[0].id);
  });
});
