import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { AlmacenSinConexion } from './almacen-sin-conexion.service';
import { RepositorioSinConexion } from './repositorio-sin-conexion.service';
import { offlineInterceptor } from './sin_conexion.interceptor';
import { TokenService } from '../servicios/token.service';
import { SincronizacionSinConexion } from './sincronizacion-sin-conexion.service';
import { environment } from '../../../environments/environment';

describe('Ordinary screens with a local database', () => {
  const base = environment.apiUrl;
  let store: AlmacenSinConexion;
  let repo: RepositorioSinConexion;
  let api: HttpClient;
  let http: HttpTestingController;
  let user: any;
  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    user = { id: crypto.randomUUID(), role: 'ADMIN', tenant_id: 'company', full_name: 'Admin', email: 'admin@example.com' };
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([offlineInterceptor])), provideHttpClientTesting(),
      { provide: TokenService, useValue: { getIdentity: () => user } }],
    });
    store = TestBed.inject(AlmacenSinConexion); repo = TestBed.inject(RepositorioSinConexion);
    api = TestBed.inject(HttpClient); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('creates local masters and a garment with related variants, visible after reopening', async () => {
    const category: any = await firstValueFrom(api.post(base + '/attributes/categories', { name: 'Local category' }));
    const size: any = await firstValueFrom(api.post(base + '/attributes/sizes', { name: 'Mediana', code: 'M' }));
    const color: any = await firstValueFrom(api.post(base + '/attributes/colors', { name: 'Azul', hex_code: '#123456' }));
    const branch: any = await firstValueFrom(api.post(base + '/branches', { name: 'Sucursal nueva', city: 'La Paz', address: 'Av. Principal' }));
    const product: any = await firstValueFrom(api.post(base + '/products', { name: 'Prenda local', price: 20, category_id: category.id,
      variants: [{ size_id: size.id, color_id: color.id, initial_stock: { [branch.id]: 5 } }],
    }));
    const products: any = await firstValueFrom(api.get(base + '/products', { params: { search: 'local', is_active: true } }));
    expect(products[0].category_name).toBe('Local category');
    expect(products[0].variants[0].size_name).toBe('Mediana');
    expect(products[0].variants[0].total_stock).toBe(5);
    const restored = TestBed.runInInjectionContext(() => new RepositorioSinConexion());
    expect((await restored.read(base + '/products'))?.data[0].id).toBe(product.id);
    const inventory: any = await firstValueFrom(api.get(base + '/stocks/branch/' + branch.id));
    expect(inventory[0].quantity).toBe(5);
    expect(store.operations()).toHaveLength(5);
    http.expectNone(() => true);
  });

  it('projects offline movements into stock, product stock and the cross-branch matrix', async () => {
    await store.cache(base + '/branches', [{ id: 'branch', name: 'Centro', is_active: true }, { id: 'other', name: 'Otra', is_active: true }]);
    await store.cache(base + '/products', [{ id: 'p', name: 'Camisa', price: 20, variants: [{ id: 'v', stocks: [{ branch_id: 'branch', quantity: 5 }] }] }]);
    await store.cache(base + '/stocks/branch/branch', [{ variant_id: 'v', product_id: 'p', product_name: 'Camisa', quantity: 5, min_alert_threshold: 2 }]);
    await store.cache(base + '/stocks/branch/other', [{ variant_id: 'v', product_id: 'p', product_name: 'Camisa', quantity: 8, min_alert_threshold: 2 }]);
    const movement: any = await firstValueFrom(api.post(base + '/inventory/movements', { branch_id: 'branch', variant_id: 'v', type: 'ENTRY', quantity: 2, reason: 'Ingreso nuevo' }));
    expect(movement.new_stock).toBe(7);
    expect((await repo.inventory('branch'))[0].quantity).toBe(7);
    expect((await repo.products(true))[0].total_stock).toBe(7);
    expect((await repo.read(base + '/stocks/matrix'))?.data[0].branches).toEqual({ branch: 7, other: 8 });
    expect((await repo.read(base + '/inventory/movements?branch_id=branch'))?.data[0].sync_status).toBe('PENDING');
  });

  it('stores staff credentials encrypted and never includes them in previews or list responses', async () => {
    const employee: any = await firstValueFrom(api.post(base + '/users', { email: 'staff@example.com', full_name: 'Staff', role: 'CASHIER', password: 'StrongPass123!' }));
    const operation = store.operations()[0];
    expect(JSON.stringify(operation)).not.toContain('StrongPass123!');
    expect(employee.password).toBeUndefined();
    expect(operation.secrets).toBeDefined();
    expect((await store.commandBody(operation)).password).toBe('StrongPass123!');
    expect((await repo.read(base + '/users'))?.data[0].password).toBeUndefined();
  });

  it('keeps the previous complete snapshot and queue if staging is cancelled', async () => {
    await store.cache(base + '/suppliers', [{ id: 'old' }]);
    await repo.queue('/attributes/categories', 'POST', { name: 'Pendiente' });
    store.beginSnapshot(store.scope);
    await store.cache(base + '/suppliers', [{ id: 'partial' }]);
    expect((await store.cached(base + '/suppliers'))?.data[0].id).toBe('old');
    store.cancelSnapshot();
    expect((await store.cached(base + '/suppliers'))?.data[0].id).toBe('old');
    expect(store.operations()).toHaveLength(1);
    store.beginSnapshot(store.scope);
    await store.cache(base + '/suppliers', [{ id: 'new' }]);
    await store.commitSnapshot(store.scope);
    expect((await store.cached(base + '/suppliers'))?.data[0].id).toBe('new');
    expect(store.operations()).toHaveLength(1);
  });

  it('stores profile edits against the current identity and sends unrelated writes only with connection', async () => {
    const profile: any = await firstValueFrom(api.put(base + '/users/me', { full_name: 'Nombre local' }));
    expect(profile.id).toBe(user.id);
    expect((await repo.read(base + '/users/me'))?.data.full_name).toBe('Nombre local');
    await expect(firstValueFrom(api.post(base + '/payments/one/paypal-order', {}))).rejects.toMatchObject({ status: 0 });
  });

  it('retries the original operation after a lost response, then syncs its dependent garment', async () => {
    const category: any = await firstValueFrom(api.post(base + '/attributes/categories', { name: 'Categoría pendiente' }));
    await firstValueFrom(api.post(base + '/products', { name: 'Prenda dependiente', price: 20, category_id: category.id, variants: [] }));
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    store.online.set(true);
    const sync = TestBed.inject(SincronizacionSinConexion);
    const tick = () => new Promise(resolve => setTimeout(resolve, 30));
    const first = sync.sync(); await tick();
    const request = http.expectOne(base + '/sync/operations');
    const originalId = request.request.body.operation_id;
    request.error(new ProgressEvent('lost-response'));
    await first;
    expect(store.operations()[0].state).toBe('PENDING');
    const retry = sync.sync(); await tick();
    http.expectOne(base + '/sync/status').flush({ online: true });
    await tick();
    const repeated = http.expectOne(base + '/sync/operations');
    expect(repeated.request.body.operation_id).toBe(originalId);
    repeated.flush({ id: 'real-category', name: 'Categoría pendiente', _local_ids: { [category.id]: 'real-category' } });
    await tick();
    const product = http.expectOne(base + '/sync/operations');
    expect(product.request.body.body.category_id).toBe(category.id);
    product.flush({ id: 'real-product', name: 'Prenda dependiente', price: 20, category_id: 'real-category', variants: [] });
    await retry;
    expect(store.operations().every(row => row.state === 'SYNCED')).toBe(true);
    expect((await repo.read(base + '/products'))?.data[0].category_name).toBe('Categoría pendiente');
  });

  it('uses the server immediately when connected despite a previous offline indicator', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    store.online.set(false);
    store.message.set('Mostrando datos guardados el día anterior.');
    const saving = firstValueFrom(api.post<any>(base + '/attributes/categories', { name: 'Online category' }));
    await new Promise(resolve => setTimeout(resolve, 30));
    http.expectOne(base + '/sync/operations').flush({ id: 'server-category', name: 'Online category' });
    expect((await saving).id).toBe('server-category');
    expect(store.online()).toBe(true);
    expect(store.operations()[0].state).toBe('SYNCED');
    const reading = firstValueFrom(api.get<any[]>(base + '/attributes/categories'));
    http.expectOne(base + '/attributes/categories').flush([{ id: 'server-category', name: 'Fresh server data' }]);
    expect((await reading)[0].name).toBe('Fresh server data');
  });
});
