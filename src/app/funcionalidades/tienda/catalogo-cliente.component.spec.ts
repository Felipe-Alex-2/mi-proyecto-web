import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { CatalogoTiendaComponent } from './catalogo-tienda.component';
import { TiendaService } from './tienda.service';
import { CatalogProduct } from '../../nucleo/modelos/catalogo.model';

describe('Catálogo de cliente con presentación de colección', () => {
  const product: CatalogProduct = {
    id: 'p1',
    name: 'Polera VESTA',
    description: 'Polera de algodón',
    category_name: 'Poleras',
    gender: 'HOMBRE',
    season_name: 'Invierno',
    min_price: 50,
    max_price: 50,
    total_stock: 20,
    discount_percent: 30,
    image_url: '/images/catalogo-poleras-vesta.png',
    variants: [],
    colors: [{ name: 'Terracota', hex: '#a34f3d' }],
    sizes: [{ name: 'Mediana', code: 'M' }],
  };
  let shop: any;
  beforeEach(() => {
    shop = {
      ready: signal(true),
      scope: signal('visitor:company:central'),
      directoryLoading: signal(false),
      company: signal({
        id: 'company',
        name: 'VESTA',
        branches: [
          { id: 'central', name: 'Central', city: 'La Paz' },
          { id: 'norte', name: 'Norte', city: 'La Paz' },
        ],
      }),
      branch: signal({ id: 'central', name: 'Central' }),
      selection: signal({ tenant_id: 'company', branch_id: 'central' }),
      customer: signal(false),
      busy: signal(false),
      error: signal(''),
      message: signal(''),
      products: vi.fn(() => of({ items: [product], total: 1, page: 1, page_size: 12 })),
      filters: () =>
        of({
          categories: [{ id: 'c1', name: 'Poleras' }],
          sizes: [],
          colors: [],
          seasons: [],
          genders: [],
          branches: [],
          min_price: 0,
          max_price: 100,
        }),
      image: (url: string) => url,
      isFavorite: () => false,
      toggleFavorite: vi.fn(),
      choose: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [CatalogoTiendaComponent],
      providers: [provideRouter([]), { provide: TiendaService, useValue: shop }],
    });
    shop.router = TestBed.inject(Router);
    vi.spyOn(shop.router, 'navigate').mockResolvedValue(true);
  });

  it('muestra banner, variantes, descuento y stock sin acciones administrativas', () => {
    const fixture = TestBed.createComponent(CatalogoTiendaComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('h1')?.textContent).toContain('Catálogo de prendas');
    expect(element.querySelector('.collection-banner img')?.getAttribute('src')).toBe(
      '/images/catalogo-poleras-vesta.png',
    );
    expect(element.querySelector('.collection-card')).not.toBeNull();
    expect(element.querySelector('.collection-price strong')?.textContent).toContain('35.00');
    expect(element.querySelector('.collection-description')?.textContent).toContain(
      'Polera de algodón',
    );
    expect(element.querySelector('.color-dot')?.getAttribute('aria-label')).toBe('Terracota');
    expect(element.querySelector('.size-list')?.textContent).toContain('M');
    expect(element.querySelector('.collection-stock')?.textContent).toContain(
      '20 unid. disponibles',
    );
    const controls = [...element.querySelectorAll('button,a')].map((el) => el.textContent?.trim());
    for (const label of ['Nueva prenda', 'Editar', 'Desactivar', 'Stock'])
      expect(controls).not.toContain(label);
    expect(element.querySelector('.collection-actions a')?.getAttribute('href')).toContain(
      '/catalog?product=p1',
    );
    element.querySelector<HTMLButtonElement>('.collection-favorite')!.click();
    expect(shop.toggleFavorite).toHaveBeenCalledWith(product);
    fixture.destroy();
  });

  it('conserva los filtros de consulta y valida la sucursal antes de cambiarla', () => {
    const fixture = TestBed.createComponent(CatalogoTiendaComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.search = 'algodón';
    component.category = 'c1';
    component.page.set(3);
    component.apply();
    fixture.detectChanges();
    expect(shop.products).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'algodón', category_id: 'c1', page: 1 }),
    );
    component.changeBranch('otra-empresa');
    expect(shop.choose).not.toHaveBeenCalled();
    component.changeBranch('norte');
    expect(shop.choose).toHaveBeenCalledWith({ tenant_id: 'company', branch_id: 'norte' });
    fixture.destroy();
  });
});
