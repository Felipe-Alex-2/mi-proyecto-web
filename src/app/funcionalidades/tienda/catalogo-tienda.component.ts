import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { CatalogProduct, CatalogFilterOptions } from '../../nucleo/modelos/catalogo.model';
import { TiendaService } from './tienda.service';
import { PrendasTiendaComponent } from './prendas-tienda.component';
import { DialogoTiendaDirective } from './dialogo-tienda.directive';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PrendasTiendaComponent, DialogoTiendaDirective],
  templateUrl: './catalogo-tienda.component.html',
  styleUrls: ['./tienda.css', './catalogo-tienda.component.css'],
})
export class CatalogoTiendaComponent {
  readonly shop = inject(TiendaService);
  readonly route = inject(ActivatedRoute);
  readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly mode = this.route.snapshot.data['mode'] || 'catalog';
  readonly products = signal<CatalogProduct[]>([]);
  readonly filters = signal<CatalogFilterOptions | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly total = signal(0);
  readonly page = signal(1);
  readonly revision = signal(0);
  readonly identity = (value: number) => value + 1;
  readonly selected = signal<CatalogProduct | null>(null);
  readonly variant = signal('');
  quantity = 1;
  search = '';
  category = '';
  size = '';
  color = '';
  season = '';
  gender = '';
  sort = 'newest';
  minPrice?: number;
  maxPrice?: number;
  readonly selectedVariant = computed(() =>
    this.selected()?.variants.find((v) => v.id === this.variant()),
  );
  readonly availability = computed(
    () =>
      this.selectedVariant()?.branch_availability.find(
        (b) => b.branch_id === this.shop.selection()?.branch_id,
      )?.quantity || 0,
  );
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / 12)));
  constructor() {
    effect((onCleanup) => {
      const ready = this.shop.ready(),
        scope = this.shop.scope(),
        query = this.query(),
        page = this.page();
      this.revision();
      if (this.mode === 'favorites') return;
      if (!ready) {
        this.products.set([]);
        return;
      }
      this.loading.set(true);
      this.error.set('');
      if (query.get('search') !== null) this.search = query.get('search') || '';
      const request = forkJoin({
        products: this.shop.products({
          search: this.search,
          category_id: this.category,
          size_id: this.size,
          color_id: this.color,
          season_id: this.season,
          gender: this.gender,
          min_price: this.minPrice,
          max_price: this.maxPrice,
          sort_by: this.sort,
          page,
          page_size: this.mode === 'home' ? 6 : 12,
        }),
        filters: this.shop.filters(),
      }).subscribe({
        next: (result) => {
          if (scope !== this.shop.scope()) return;
          this.products.set(result.products.items);
          this.total.set(result.products.total);
          this.filters.set(result.filters);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.error.set(
            typeof e.error?.detail === 'string'
              ? e.error.detail
              : 'No se pudo cargar el catálogo. Intenta nuevamente.',
          );
        },
      });
      onCleanup(() => request.unsubscribe());
    });
    effect((onCleanup) => {
      const id = this.query().get('product'),
        ready = this.shop.ready();
      this.shop.scope();
      this.selected.set(null);
      this.variant.set('');
      this.quantity = 1;
      if (!id || !ready) return;
      const request = this.shop.product(id).subscribe({
        next: (product) => this.selected.set(product),
        error: () => this.error.set('Esta prenda no está disponible en la tienda seleccionada.'),
      });
      onCleanup(() => request.unsubscribe());
    });
  }
  apply() {
    this.page.set(1);
    this.revision.update((n) => n + 1);
    this.shop.router.navigate([], {
      relativeTo: this.route,
      queryParams: { search: this.search || null },
      queryParamsHandling: 'merge',
    });
  }
  reset() {
    this.search = '';
    this.category = '';
    this.size = '';
    this.color = '';
    this.season = '';
    this.gender = '';
    this.minPrice = undefined;
    this.maxPrice = undefined;
    this.sort = 'newest';
    this.apply();
  }
  close() {
    this.shop.router.navigate([], {
      relativeTo: this.route,
      queryParams: { product: null },
      queryParamsHandling: 'merge',
    });
  }
  changeBranch(branchId: string) {
    const company = this.shop.company();
    if (
      !company?.branches.some((branch) => branch.id === branchId) ||
      branchId === this.shop.selection()?.branch_id
    )
      return;
    this.page.set(1);
    this.shop.choose({ tenant_id: company.id, branch_id: branchId });
  }
  scrollToProducts() {
    document
      .getElementById('catalog-products')
      ?.scrollIntoView({
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'start',
      });
  }
  add() {
    const p = this.selected();
    if (p) this.shop.add(p, this.variant(), this.quantity);
  }
  fitting() {
    const p = this.selected();
    if (p && this.shop.requireCustomer(`/fitting?product=${p.id}`))
      this.shop.router.navigate(['/fitting'], { queryParams: { product: p.id } });
  }
}
