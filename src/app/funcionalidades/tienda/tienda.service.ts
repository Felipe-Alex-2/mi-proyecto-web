import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, finalize, forkJoin, of, tap } from 'rxjs';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { SaasService, StoreCompany } from '../../nucleo/servicios/saas.service';
import {
  CatalogProduct,
  CatalogProductListResponse,
  CatalogFilterOptions,
} from '../../nucleo/modelos/catalogo.model';
import { environment } from '../../../environments/environment';

export interface StoreSelection {
  tenant_id: string;
  branch_id: string;
}
export interface CartItem {
  id: string;
  variant_id: string;
  quantity: number;
  product_id: string;
  product_name: string;
  size_name: string;
  color_name: string;
  price: number;
  subtotal: number;
  image_url?: string;
  available_stock: number;
}
export interface Cart {
  items: CartItem[];
  total_items: number;
  total_amount: number;
}
export interface ShopNotification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  reservation_id?: string;
}
const emptyCart = (): Cart => ({ items: [], total_items: 0, total_amount: 0 });

@Injectable({ providedIn: 'root' })
export class TiendaService {
  readonly http = inject(HttpClient);
  private readonly saas = inject(SaasService);
  readonly auth = inject(AutenticacionService);
  readonly router = inject(Router);
  readonly api = environment.apiUrl;
  readonly companies = signal<StoreCompany[]>([]);
  readonly directoryLoading = signal(true);
  readonly directoryError = signal('');
  readonly guestSelection = signal<StoreSelection | null>(this.readSelection());
  readonly selection = computed(() => {
    const user = this.auth.currentUser();
    return user?.role === 'CUSTOMER' && user.selected_tenant_id && user.branch_id
      ? { tenant_id: user.selected_tenant_id, branch_id: user.branch_id }
      : this.guestSelection();
  });
  readonly company = computed(() =>
    this.companies().find((c) => c.id === this.selection()?.tenant_id),
  );
  readonly branch = computed(() =>
    this.company()?.branches.find((b) => b.id === this.selection()?.branch_id),
  );
  readonly ready = computed(() => !!this.company() && !!this.branch());
  readonly customer = computed(() => this.auth.currentUser()?.role === 'CUSTOMER');
  readonly scope = computed(
    () =>
      `${this.auth.currentUser()?.id || 'guest'}:${this.selection()?.tenant_id}:${this.selection()?.branch_id}`,
  );
  readonly cart = signal<Cart>(emptyCart());
  readonly favorites = signal<CatalogProduct[]>([]);
  readonly notifications = signal<ShopNotification[]>([]);
  readonly unread = computed(() => this.notifications().filter((n) => !n.is_read).length);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly authPrompt = signal(false);
  readonly authReturn = signal('/home');
  readonly cartError = signal('');
  readonly favoritesError = signal('');
  readonly notificationsError = signal('');

  constructor() {
    this.loadDirectory();
    effect((onCleanup) => {
      const scope = this.scope();
      const customer = this.customer();
      const ready = this.ready();
      this.cart.set(emptyCart());
      this.favorites.set([]);
      this.notifications.set([]);
      this.cartError.set('');
      this.favoritesError.set('');
      this.notificationsError.set('');
      this.error.set('');
      this.message.set('');
      if (!customer || !ready) return;
      const request = forkJoin({
        cart: this.http.get<Cart>(`${this.api}/cart`).pipe(
          catchError(() => {
            this.cartError.set('No se pudo cargar tu carrito.');
            return of(emptyCart());
          }),
        ),
        favorites: this.http.get<CatalogProduct[]>(`${this.api}/favorites`).pipe(
          catchError(() => {
            this.favoritesError.set('No se pudieron cargar tus favoritos.');
            return of([]);
          }),
        ),
      }).subscribe((data) => {
        if (scope === this.scope()) {
          this.cart.set(data.cart);
          this.favorites.set(data.favorites);
        }
      });
      const refresh = () =>
        this.http.get<ShopNotification[]>(`${this.api}/notifications`).subscribe({
          next: (rows) => {
            if (scope === this.scope()) {
              this.notifications.set(rows);
              this.notificationsError.set('');
            }
          },
          error: () => {
            if (scope === this.scope())
              this.notificationsError.set(
                'No se pudieron cargar las notificaciones. Se reintentará automáticamente.',
              );
          },
        });
      let notificationRequest = refresh();
      const timer = setInterval(() => {
        notificationRequest.unsubscribe();
        notificationRequest = refresh();
      }, 30000);
      onCleanup(() => {
        request.unsubscribe();
        notificationRequest.unsubscribe();
        clearInterval(timer);
      });
    });
  }

  private readSelection(): StoreSelection | null {
    try {
      const value = JSON.parse(sessionStorage.getItem('vesta-shop-selection') || 'null');
      return typeof value?.tenant_id === 'string' && typeof value?.branch_id === 'string'
        ? value
        : null;
    } catch {
      return null;
    }
  }
  loadDirectory() {
    this.directoryLoading.set(true);
    this.directoryError.set('');
    this.saas.directory().subscribe({
      next: (rows) => {
        this.companies.set(rows);
        this.directoryLoading.set(false);
        const selected = this.guestSelection();
        if (
          !rows.some(
            (c) =>
              c.id === selected?.tenant_id && c.branches.some((b) => b.id === selected?.branch_id),
          )
        ) {
          const first = rows.find((c) => c.branches.length);
          this.guestSelection.set(
            first ? { tenant_id: first.id, branch_id: first.branches[0].id } : null,
          );
        }
      },
      error: () => {
        this.directoryLoading.set(false);
        this.directoryError.set('No se pudieron cargar las tiendas.');
      },
    });
  }
  choose(selection: StoreSelection) {
    if (this.busy()) return;
    this.error.set('');
    if (this.customer()) {
      this.busy.set(true);
      this.auth
        .selectStore(selection)
        .pipe(finalize(() => this.busy.set(false)))
        .subscribe({ next: () => this.remember(selection), error: (e) => this.fail(e) });
    } else this.remember(selection);
  }
  private remember(selection: StoreSelection) {
    this.guestSelection.set(selection);
    try {
      sessionStorage.setItem('vesta-shop-selection', JSON.stringify(selection));
    } catch {}
  }
  params(filters: Record<string, string | number | undefined> = {}) {
    let params = new HttpParams();
    const selection = this.selection();
    for (const [key, value] of Object.entries({
      tenant_id: selection?.tenant_id,
      store_branch: selection?.branch_id,
      ...filters,
    })) {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    }
    return params;
  }
  private catalogUrl() {
    return `${this.api}/${this.customer() ? 'catalog' : 'shop/catalog'}`;
  }
  products(filters: Record<string, string | number | undefined> = {}) {
    return this.http.get<CatalogProductListResponse>(`${this.catalogUrl()}/products`, {
      params: this.params(filters),
    });
  }
  filters() {
    return this.http.get<CatalogFilterOptions>(`${this.catalogUrl()}/filters`, {
      params: this.params(),
    });
  }
  product(id: string) {
    return this.http.get<CatalogProduct>(
      `${this.catalogUrl()}/products/${encodeURIComponent(id)}`,
      { params: this.params() },
    );
  }
  requireCustomer(returnUrl = this.router.url): boolean {
    if (this.customer()) return true;
    if (this.auth.currentUser()) {
      this.error.set('Esta acción está disponible para cuentas de cliente.');
      return false;
    }
    this.authReturn.set(returnUrl);
    this.authPrompt.set(true);
    return false;
  }
  login() {
    this.authPrompt.set(false);
    this.router.navigate(['/login'], { queryParams: { returnUrl: this.authReturn() } });
  }
  isFavorite(id: string) {
    return this.favorites().some((p) => p.id === id);
  }
  toggleFavorite(product: CatalogProduct) {
    if (!this.requireCustomer(`/catalog?product=${encodeURIComponent(product.id)}`) || this.busy())
      return;
    const saved = this.isFavorite(product.id),
      scope = this.scope();
    this.busy.set(true);
    this.error.set('');
    const url = `${this.api}/favorites/${encodeURIComponent(product.id)}`;
    (saved ? this.http.delete(url) : this.http.put(url, {}))
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          if (scope === this.scope())
            this.favorites.update((rows) =>
              saved ? rows.filter((p) => p.id !== product.id) : [...rows, product],
            );
        },
        error: (e) => this.fail(e),
      });
  }
  add(product: CatalogProduct, variant_id: string, quantity: number) {
    if (!this.requireCustomer(`/catalog?product=${encodeURIComponent(product.id)}`) || this.busy())
      return;
    if (!variant_id || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      this.error.set('Selecciona una talla, color y cantidad válida.');
      return;
    }
    this.mutateCart(
      this.http.post<Cart>(`${this.api}/cart/items`, { variant_id, quantity }),
      'Prenda agregada a tu carrito.',
    );
  }
  updateQuantity(item: CartItem, quantity: number) {
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > item.available_stock ||
      this.busy()
    )
      return;
    this.mutateCart(this.http.put<Cart>(`${this.api}/cart/items/${item.id}`, { quantity }));
  }
  removeItem(id: string) {
    if (!this.busy()) this.mutateCart(this.http.delete<Cart>(`${this.api}/cart/items/${id}`));
  }
  clearCart() {
    return this.http.delete<Cart>(`${this.api}/cart`).pipe(tap((cart) => this.cart.set(cart)));
  }
  refreshCart() {
    const scope = this.scope();
    this.http.get<Cart>(`${this.api}/cart`).subscribe({
      next: (cart) => {
        if (scope === this.scope()) {
          this.cart.set(cart);
          this.cartError.set('');
        }
      },
      error: (e) => {
        if (scope === this.scope()) this.fail(e);
      },
    });
  }
  private mutateCart(request: import('rxjs').Observable<Cart>, message = '') {
    const scope = this.scope();
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (cart) => {
        if (scope === this.scope()) {
          this.cart.set(cart);
          this.message.set(message);
          this.cartError.set('');
        }
      },
      error: (e) => this.fail(e),
    });
  }
  fail(error: any) {
    this.error.set(
      typeof error?.error?.detail === 'string'
        ? error.error.detail
        : error?.status === 0
          ? 'No hay conexión con el servidor. Intenta nuevamente.'
          : 'No se pudo completar la operación. Intenta nuevamente.',
    );
  }
  image(url?: string | null) {
    if (!url) return '';
    if (/^(https?:|data:image\/)/i.test(url)) return url;
    return new URL(url, new URL(this.api, window.location.origin).origin).href;
  }
  date(value?: string | null) {
    return value ? (/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`) : null;
  }
}
