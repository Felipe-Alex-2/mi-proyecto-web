import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { AlmacenSinConexion } from './almacen-sin-conexion.service';
import { offlineInterceptor } from './sin_conexion.interceptor';
import { TokenService } from '../servicios/token.service';
import { environment } from '../../../environments/environment';
import { vi } from 'vitest';

describe('Persistent offline operations', () => {
  let store: AlmacenSinConexion;
  let http: HttpTestingController;
  let api: HttpClient;
  let identity: any;
  beforeEach(() => {
    identity = {
      id: crypto.randomUUID(),
      role: 'CUSTOMER',
      selected_tenant_id: 'company-a',
      tenant_id: null,
      branch_id: 'branch-a',
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([offlineInterceptor])),
        provideHttpClientTesting(),
        { provide: TokenService, useValue: { getIdentity: () => identity } },
      ],
    });
    store = TestBed.inject(AlmacenSinConexion);
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(HttpClient);
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });
  async function tick() {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const body = { branch_id: 'branch-a', items: [{ variant_id: 'variant', quantity: 1 }] };
  it('persists a disconnected reservation across service instances and isolates another account', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const result: any = await firstValueFrom(api.post(environment.apiUrl + '/reservations', body));
    expect(result.sync_status).toBe('PENDING');
    expect(store.operations()).toHaveLength(1);
    const restored = TestBed.runInInjectionContext(() => new AlmacenSinConexion());
    await restored.refresh();
    expect(restored.operations()[0].body).toEqual(body);
    identity = { ...identity, id: 'another-user' };
    await restored.refresh();
    expect(restored.operations()).toEqual([]);
  });
  it('uses the same durable UUID when the online response is lost', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const resultPromise = firstValueFrom(api.post(environment.apiUrl + '/reservations', body));
    await tick();
    const request = http.expectOne(environment.apiUrl + '/sync/operations');
    const operationId = request.request.body.operation_id;
    request.error(new ProgressEvent('network-error'));
    const result: any = await resultPromise;
    expect(result.id).toBe('local-' + operationId);
    expect(store.operations()[0].id).toBe(operationId);
    expect(store.operations()[0].state).toBe('PENDING');
  });
  it('does not label a rejected request as a confirmed or pending success', async () => {
    const resultPromise = firstValueFrom(api.post(environment.apiUrl + '/reservations', body));
    const rejection = expect(resultPromise).rejects.toMatchObject({ status: 409, error: { detail: 'Sin stock' } });
    const detail = { code: 'STOCK_INSUFFICIENT', message: 'Sin stock', variant_id: 'variant', available: 0, requested: 1 };
    await tick();
    http
      .expectOne(environment.apiUrl + '/sync/operations')
      .flush({ detail }, { status: 409, statusText: 'Conflict' });
    await rejection;
    expect(store.operations()[0].state).toBe('CONFLICT');
    expect(store.operations()[0].message).toBe('Sin stock');
    expect(store.operations()[0].conflict).toEqual(detail);
  });
  it('serves only the cache from the original company and branch on network failure', async () => {
    const url = environment.apiUrl + '/catalog/products';
    await store.cache(url, { items: [{ name: 'Polera A' }] });
    const cached = firstValueFrom(api.get(url));
    http.expectOne(url).error(new ProgressEvent('offline'));
    expect(await cached).toEqual({ items: [{ name: 'Polera A' }] });
    identity = { ...identity, selected_tenant_id: 'company-b', branch_id: 'branch-b' };
    const missing = firstValueFrom(api.get(url));
    const rejection = expect(missing).rejects.toMatchObject({ status: 0 });
    http.expectOne(url).error(new ProgressEvent('offline'));
    await rejection;
  });
  it('lists cash sales saved from Payments as pending when offline', async () => {
    identity = { ...identity, role: 'ADMIN', tenant_id: 'company-a' };
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const result: any = await firstValueFrom(
      api.post(environment.apiUrl + '/payments', {
        branch_id: 'branch-a',
        customer_name: 'Cliente',
        amount: 25,
        concept: 'Cobro de contado',
        payment_type: 'EFECTIVO',
      }),
    );
    expect(result.sync_status).toBe('PENDING');
    const cash: any = await firstValueFrom(
      api.post(environment.apiUrl + '/payments/' + result.id + '/cash', {
        payment_type: 'EFECTIVO',
      }),
    );
    expect(cash.id).toBe(result.id);
    expect(cash.sync_status).toBe('PENDING');
    const url = environment.apiUrl + '/payments?branch_id=branch-a&limit=100';
    await store.cache(url, []);
    const records = firstValueFrom(
      api.get(environment.apiUrl + '/payments', { params: { branch_id: 'branch-a', limit: 100 } }),
    );
    http.expectNone(url);
    expect(((await records) as any[])[0].id).toBe(result.id);
  });
  it('can search the downloaded catalogue without a previously cached search URL', async () => {
    await store.cache(environment.apiUrl + '/offline/products', [
      { id: 'one', name: 'Polera azul', min_price: 10, variants: [] },
    ]);
    const url = environment.apiUrl + '/catalog/products?search=azul&page_size=12';
    const response = firstValueFrom(api.get(url));
    http.expectOne(url).error(new ProgressEvent('offline'));
    expect(((await response) as any).items[0].id).toBe('one');
  });
  it('keeps PayPal and unrelated writes out of the offline queue', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    store.online.set(false);
    await expect(
      firstValueFrom(api.post(environment.apiUrl + '/payments/one/paypal-order', {})),
    ).rejects.toMatchObject({ status: 0 });
    await store.refresh();
    expect(store.operations()).toHaveLength(0);
  });
});
