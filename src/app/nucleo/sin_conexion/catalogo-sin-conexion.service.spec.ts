import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { CatalogoSinConexion, CATALOG_INTERVAL } from './catalogo-sin-conexion.service';
import { AlmacenSinConexion } from './almacen-sin-conexion.service';
import { TokenService } from '../servicios/token.service';
import { CatalogoService } from '../servicios/catalogo.service';
import { SucursalService } from '../servicios/sucursal.service';
import { StockService } from '../servicios/stock.service';
import { environment } from '../../../environments/environment';

describe('Hourly catalogue persistence', () => {
  let copy: CatalogoSinConexion;
  let store: AlmacenSinConexion;
  let catalog: any;
  const meta = environment.apiUrl + '/offline/catalog-meta';
  beforeEach(() => {
    const user = {
      id: crypto.randomUUID(),
      role: 'CUSTOMER',
      selected_tenant_id: 'company',
      branch_id: 'branch',
    };
    catalog = {
      getFilterOptions: vi.fn(() => of({ branches: [{ id: 'branch' }] })),
      getProducts: vi.fn(() => of({ items: [], total: 0 })),
      getProduct: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: TokenService, useValue: { getIdentity: () => user } },
        { provide: CatalogoService, useValue: catalog },
        { provide: SucursalService, useValue: {} },
        { provide: StockService, useValue: {} },
        { provide: HttpClient, useValue: { get: () => of([]) } },
      ],
    });
    store = TestBed.inject(AlmacenSinConexion);
    copy = TestBed.inject(CatalogoSinConexion);
  });
  afterEach(() => vi.restoreAllMocks());
  it('downloads on first entry, skips a fresh copy and refreshes after one hour', async () => {
    const download = vi.spyOn(copy, 'download').mockResolvedValue();
    await copy.check();
    expect(download).toHaveBeenCalledTimes(1);
    const now = Date.now();
    await store.cache(meta, { downloaded_at: new Date(now).toISOString(), products: 2 });
    await copy.check();
    expect(download).toHaveBeenCalledTimes(1);
    expect(copy.productCount()).toBe(2);
    vi.spyOn(Date, 'now').mockReturnValue(now + CATALOG_INTERVAL);
    await copy.check();
    expect(download).toHaveBeenCalledTimes(2);
  });
  it('stores a paged catalogue and details without making one request per product', async () => {
    const products = Array.from({ length: 101 }, (_, i) => ({
      id: String(i),
      name: 'Prenda ' + i,
      variants: [],
    }));
    catalog.getProducts.mockImplementation((q: any) =>
      of({ items: q.page === 1 ? products.slice(0, 100) : products.slice(100), total: 101 }),
    );
    await copy.download();
    expect(copy.error()).toBe('');
    expect(copy.productCount()).toBe(101);
    expect(catalog.getProducts).toHaveBeenCalledTimes(2);
    expect(catalog.getProduct).not.toHaveBeenCalled();
    expect((await store.cached(environment.apiUrl + '/offline/products'))?.data).toHaveLength(101);
    expect((await store.cached(meta))?.data.downloaded_at).toBe(copy.lastDownload());
  });
  it('does not replace the successful timestamp when a download fails', async () => {
    const old = '2026-01-01T00:00:00.000Z';
    await store.cache(meta, { downloaded_at: old, products: 5 });
    catalog.getProducts.mockReturnValue(throwError(() => new Error('No connection')));
    await copy.download();
    expect(copy.error()).toBeTruthy();
    expect((await store.cached(meta))?.data.downloaded_at).toBe(old);
  });

  it('downloads all authorized branches and every page of staff records in one complete snapshot', async () => {
    const tokens = TestBed.inject(TokenService) as any;
    const staff = { id: crypto.randomUUID(), role: 'ADMIN', tenant_id: 'company' };
    tokens.getIdentity = () => staff;
    const branchService = TestBed.inject(SucursalService) as any;
    branchService.getBranches = () => of([{ id: 'north', name: 'Norte' }, { id: 'south', name: 'Sur' }]);
    const calls: string[] = [];
    const client = TestBed.inject(HttpClient) as any;
    client.get = (url: string, options: any = {}) => {
      calls.push(url + '?' + JSON.stringify(options.params || {}));
      if (url.endsWith('/products')) return of(options.params.offset === 0 ? Array.from({ length: 100 }, (_, i) => ({ id: 'p' + i })) : [{ id: 'p100' }]);
      if (url.includes('/stocks/branch/')) return of([{ variant_id: 'v', quantity: url.endsWith('north') ? 5 : 8 }]);
      return of([]);
    };
    await copy.download();
    expect(copy.error()).toBe('');
    expect((await store.cached(environment.apiUrl + '/products'))?.data).toHaveLength(101);
    expect((await store.cached(environment.apiUrl + '/stocks/branch/north'))?.data[0].quantity).toBe(5);
    expect((await store.cached(environment.apiUrl + '/stocks/branch/south'))?.data[0].quantity).toBe(8);
    expect(calls.filter(url => url.includes('/products?'))).toHaveLength(2);
  });
});
