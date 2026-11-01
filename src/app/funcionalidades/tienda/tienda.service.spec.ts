import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { of } from 'rxjs';
import { TiendaService } from './tienda.service';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { SaasService } from '../../nucleo/servicios/saas.service';
import { User } from '../../nucleo/modelos/usuario.model';
import { CatalogProduct } from '../../nucleo/modelos/catalogo.model';
import { shopReturnUrl, customerShopGuard } from './tienda.guard';
import { TokenService } from '../../nucleo/servicios/token.service';

describe('Tienda web y acceso de clientes', () => {
  let shop: TiendaService;
  let http: HttpTestingController;
  let user: ReturnType<typeof signal<User | null>>;
  const customer = {
    id: 'customer-a',
    role: 'CUSTOMER',
    selected_tenant_id: 'company-a',
    branch_id: 'branch-a',
  } as User;
  const product = { id: 'product-a', name: 'Polera' } as CatalogProduct;
  beforeEach(() => {
    sessionStorage.clear();
    user = signal<User | null>(null);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AutenticacionService, useValue: { currentUser: user, selectStore: vi.fn() } },
        {
          provide: SaasService,
          useValue: {
            directory: () =>
              of([
                { id: 'empty', name: 'Sin sucursales', branches: [] },
                {
                  id: 'company-a',
                  name: 'Tienda A',
                  branches: [{ id: 'branch-a', name: 'Central' }],
                },
              ]),
          },
        },
      ],
    });
    shop = TestBed.inject(TiendaService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });
  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });
  function loadCustomer() {
    user.set(customer);
    TestBed.tick();
    http.expectOne(shop.api + '/cart').flush({ items: [], total_items: 0, total_amount: 0 });
    http.expectOne(shop.api + '/favorites').flush([]);
    http.expectOne(shop.api + '/notifications').flush([]);
  }
  it('permite consultar el catálogo público y solicita acceso antes de una acción', () => {
    expect(shop.selection()).toEqual({ tenant_id: 'company-a', branch_id: 'branch-a' });
    shop.products().subscribe();
    const request = http.expectOne((req) => req.url.endsWith('/shop/catalog/products'));
    expect(request.request.params.get('tenant_id')).toBe('company-a');
    expect(request.request.params.get('store_branch')).toBe('branch-a');
    request.flush({ items: [], total: 0, page: 1, page_size: 20 });
    shop.add(product, 'variant-a', 1);
    shop.toggleFavorite(product);
    expect(shop.authPrompt()).toBe(true);
    expect(shop.authReturn()).toBe('/catalog?product=product-a');
    http.expectNone((req) => req.method !== 'GET');
  });
  it('usa el carrito del servidor y descarta respuestas de otra sesión', () => {
    loadCustomer();
    shop.add(product, 'variant-a', 2);
    const request = http.expectOne(shop.api + '/cart/items');
    expect(request.request.body).toEqual({ variant_id: 'variant-a', quantity: 2 });
    user.set(null);
    TestBed.tick();
    request.flush({ items: [{ id: 'private-item' }], total_items: 2, total_amount: 100 });
    expect(shop.cart().items).toEqual([]);
    expect(shop.favorites()).toEqual([]);
    expect(shop.notifications()).toEqual([]);
  });
  it('consulta el catálogo autenticado para conservar la integración sin conexión', () => {
    loadCustomer();
    shop.products({ search: 'azul' }).subscribe();
    const request = http.expectOne((req) => req.url.endsWith('/catalog/products'));
    expect(request.request.url.endsWith('/shop/catalog/products')).toBe(false);
    expect(request.request.params.get('search')).toBe('azul');
    request.flush({ items: [], total: 0, page: 1, page_size: 20 });
  });
  it('conserva el destino del cliente y rechaza redirecciones externas o de personal', () => {
    expect(shopReturnUrl('CUSTOMER', '/catalog?product=abc')).toBe('/catalog?product=abc');
    expect(shopReturnUrl('CUSTOMER', 'https://example.com')).toBe('/home');
    expect(shopReturnUrl('CUSTOMER', '//example.com')).toBe('/home');
    expect(shopReturnUrl('CUSTOMER', '/payments')).toBe('/home');
    expect(shopReturnUrl('CASHIER', '/cart')).toBe('/payments');
    expect(shopReturnUrl('ADMIN', '/cart')).toBe('/dashboard');
  });
  it('protege los enlaces directos a las páginas personales', () => {
    const router = TestBed.inject(Router),
      tokens = TestBed.inject(TokenService);
    const token = vi.spyOn(tokens, 'hasToken').mockReturnValue(false);
    let result = TestBed.runInInjectionContext(() =>
      customerShopGuard({} as any, { url: '/cart' } as any),
    );
    expect(router.serializeUrl(result as UrlTree)).toContain('/login?returnUrl=%2Fcart');
    token.mockReturnValue(true);
    user.set({ ...customer, role: 'ADMIN' });
    result = TestBed.runInInjectionContext(() =>
      customerShopGuard({} as any, { url: '/cart' } as any),
    );
    expect(router.serializeUrl(result as UrlTree)).toBe('/dashboard');
    user.set(customer);
    expect(
      TestBed.runInInjectionContext(() => customerShopGuard({} as any, { url: '/cart' } as any)),
    ).toBe(true);
  });
});
