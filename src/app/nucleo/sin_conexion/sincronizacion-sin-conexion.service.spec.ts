import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TokenService } from '../servicios/token.service';
import { AlmacenSinConexion } from './almacen-sin-conexion.service';
import { SincronizacionSinConexion } from './sincronizacion-sin-conexion.service';
import { environment } from '../../../environments/environment';
import { vi } from 'vitest';

describe('Automatic outbox synchronization', () => {
  let identity: any;
  let store: AlmacenSinConexion;
  let sync: SincronizacionSinConexion;
  let http: HttpTestingController;
  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    identity = {
      id: crypto.randomUUID(),
      role: 'CUSTOMER',
      selected_tenant_id: 'original-company',
      branch_id: 'original-branch',
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TokenService, useValue: { getIdentity: () => identity } },
      ],
    });
    store = TestBed.inject(AlmacenSinConexion);
    sync = TestBed.inject(SincronizacionSinConexion);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });
  async function tick() {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  it('sends the original company and branch after the customer selects a different store', async () => {
    await store.enqueue('/reservations', {
      branch_id: 'original-branch',
      items: [{ variant_id: 'one', quantity: 1 }],
    });
    identity = { ...identity, selected_tenant_id: 'another-company', branch_id: 'another-branch' };
    const task = sync.sync();
    await tick();
    const request = http.expectOne(environment.apiUrl + '/sync/operations');
    expect(request.request.body.tenant_id).toBe('original-company');
    expect(request.request.headers.get('X-Vesta-Branch')).toBe('original-branch');
    request.flush({ id: 'server-reservation' });
    await task;
    expect(store.operations()[0].state).toBe('SYNCED');
    expect(store.operations()[0].result.id).toBe('server-reservation');
  });
  it('recovers the online indicator after an outage even with an empty queue', async () => {
    store.online.set(false);
    const task = sync.sync();
    await tick();
    http.expectOne(environment.apiUrl + '/sync/status').flush({ online: true });
    await task;
    expect(store.online()).toBe(true);
  });

  it('returns online before processing a pending change that is rejected as a conflict', async () => {
    await store.enqueue('/reservations', { branch_id: 'original-branch', items: [] });
    store.online.set(false);
    store.message.set('Guardado localmente. Pendiente de confirmación al recuperar conexión.');
    const task = sync.sync(); await tick();
    http.expectOne(environment.apiUrl + '/sync/status').flush({ online: true });
    await tick();
    expect(store.online()).toBe(true);
    expect(store.message()).toBe('');
    http.expectOne(environment.apiUrl + '/sync/operations').flush({ detail: 'Sin stock' }, { status: 409, statusText: 'Conflict' });
    await task;
    expect(store.online()).toBe(true);
    expect(store.operations()[0].state).toBe('CONFLICT');
  });
  it('preserves pending data and the UUID after a failed transmission', async () => {
    const local = await store.enqueue('/reservations', {
      branch_id: 'original-branch',
      items: [{ variant_id: 'one', quantity: 1 }],
    });
    const task = sync.sync();
    await tick();
    const request = http.expectOne(environment.apiUrl + '/sync/operations');
    expect('local-' + request.request.body.operation_id).toBe(local.id);
    request.error(new ProgressEvent('offline'));
    await task;
    expect(store.operations()[0].state).toBe('PENDING');
    expect(store.operations()[0].attempts).toBe(1);
    const retry = sync.sync(); await tick();
    http.expectOne(environment.apiUrl + '/sync/status').flush({ online: true }); await tick();
    const resent = http.expectOne(environment.apiUrl + '/sync/operations');
    expect('local-' + resent.request.body.operation_id).toBe(local.id);
    resent.flush({ id: 'confirmed-on-retry' }); await retry;
    expect(store.operations()[0].state).toBe('SYNCED');
  });
  it('keeps stock conflicts with their reason and continues synchronizing unrelated operations', async () => {
    await store.enqueue('/reservations', { branch_id: 'original-branch', items: [{ variant_id: 'one', quantity: 2 }] });
    await store.enqueue('/reservations', { branch_id: 'original-branch', items: [{ variant_id: 'two', quantity: 1 }] });
    const task = sync.sync(); await tick();
    const detail = { code: 'STOCK_INSUFFICIENT', message: 'Stock insuficiente para Polera. Disponible: 1, solicitado: 2.', available: 1, requested: 2, variant_id: 'one' };
    http.expectOne(environment.apiUrl + '/sync/operations').flush({ detail }, { status: 409, statusText: 'Conflict' }); await tick();
    http.expectOne(environment.apiUrl + '/sync/operations').flush({ id: 'second-reservation' }); await task;
    expect(store.operations()[0].state).toBe('CONFLICT');
    expect(store.operations()[0].conflict).toEqual(detail);
    expect(store.operations()[0].message).toBe(detail.message);
    expect(store.operations()[1].state).toBe('SYNCED');
    await sync.sync(); // No automatic retry of rejected business operations.
    http.expectNone(environment.apiUrl + '/sync/operations');
  });
});
