import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AlmacenSinConexion } from './almacen-sin-conexion.service';
import { CatalogoService } from '../servicios/catalogo.service';
import { SucursalService } from '../servicios/sucursal.service';
import { StockService } from '../servicios/stock.service';
import { environment } from '../../../environments/environment';

export const CATALOG_INTERVAL = 60 * 60 * 1000;
@Injectable({ providedIn: 'root' })
export class CatalogoSinConexion {
  readonly store = inject(AlmacenSinConexion);
  private catalog = inject(CatalogoService);
  private branches = inject(SucursalService);
  private stock = inject(StockService);
  private http = inject(HttpClient);
  readonly busy = signal(false);
  readonly lastDownload = signal<string | null>(null);
  readonly error = signal('');
  readonly productCount = signal(0);
  private started = false;
  private enteredScope = '';
  private metaUrl = environment.apiUrl + '/offline/catalog-meta';
  start() {
    if (this.started) return;
    this.started = true;
    const tick = () => void this.check().catch(() => {});
    window.addEventListener('vesta-session-changed', () => {
      this.lastDownload.set(null);
      this.productCount.set(0);
      tick();
    });
    window.addEventListener('online', tick);
    window.addEventListener('focus', tick);
    setInterval(tick, 60000);
    tick();
  }
  async check() {
    if (!this.store.owner) return;
    const scope = this.store.scope;
    const firstEntry = this.enteredScope !== scope;
    const meta = await this.store.cached(this.metaUrl, scope);
    if (scope !== this.store.scope) return;
    this.lastDownload.set(meta?.data.downloaded_at || null);
    this.productCount.set(meta?.data.products || 0);
    if (
      navigator.onLine &&
      this.store.online() &&
      (firstEntry || !!this.error() || !meta || Date.now() - Date.parse(meta.data.downloaded_at) >= CATALOG_INTERVAL)
    ) {
      await this.download(false);
      if (!this.error() && scope === this.store.scope) this.enteredScope = scope;
    }
  }
  async download(manual = true): Promise<void> {
    if (this.busy() || !this.store.owner) return;
    if (!navigator.onLine || !this.store.online()) {
      if (manual) this.error.set('Necesitas conexión para actualizar el catálogo.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const scope = this.store.scope;
    const user = this.store.tokens.getIdentity()!;
    const customer = user.role === 'CUSTOMER';
    this.store.beginSnapshot(scope);
    try {
      if (customer && !user.branch_id)
        throw new Error('Selecciona tu empresa y sucursal desde el perfil.');
      const filters = await firstValueFrom(this.catalog.getFilterOptions());
      await this.store.cache(environment.apiUrl + '/catalog/filters', filters, scope);
      const branches = customer
        ? filters.branches.filter((branch) => branch.id === user.branch_id)
        : await firstValueFrom(this.branches.getBranches());
      const assertScope = () => {
        if (!this.store.online())
          throw new Error(
            'No se pudo completar la descarga. Se conserva la fecha de la última copia completa.',
          );
        if (scope !== this.store.scope)
          throw new Error('La tienda o cuenta cambió. Se actualizará su propia copia.');
      };
      assertScope();
      if (!customer) {
        // Each collection is fetched completely, in bounded pages where supported.
        for (const path of ['/attributes/categories', '/attributes/sizes', '/attributes/colors', '/suppliers', '/seasons', '/promotions']) {
          await this.store.cache(environment.apiUrl + path, await firstValueFrom(this.http.get(environment.apiUrl + path)), scope);
          assertScope();
        }
        await this.store.cache(environment.apiUrl + '/products', await this.downloadPages('/products'), scope);
        if (user.role === 'ADMIN') await this.store.cache(environment.apiUrl + '/users', await this.downloadPages('/users', 'skip'), scope);
        if (['ADMIN', 'STORE_MANAGER'].includes(user.role)) await this.store.cache(environment.apiUrl + '/inventory/movements', await this.downloadPages('/inventory/movements'), scope);
        await this.store.cache(environment.apiUrl + '/reservations', await this.downloadPages('/reservations'), scope);
        for (const path of ['/saas/subscription', '/saas/plans']) {
          await this.store.cache(environment.apiUrl + path, await firstValueFrom(this.http.get(environment.apiUrl + path)), scope);
          assertScope();
        }
      }
      const products: any[] = [];
      // Download the complete authorized catalogue in bounded server pages.
      let page = 1,
        total = Infinity;
      while (products.length < total) {
        const response = await firstValueFrom(
          this.catalog.getProducts({ page, pageSize: 100, sortBy: 'newest' }),
        );
        assertScope();
        products.push(...response.items);
        total = response.total;
        if (!response.items.length) break;
        page++;
      }
      await this.store.cache(environment.apiUrl + '/offline/products', products, scope);
      await this.store.cache(environment.apiUrl + '/offline/branches', branches, scope);
      await this.store.cache(environment.apiUrl + '/branches', branches, scope);
      for (const branch of branches) {
        assertScope();
        let variants: any[];
        if (customer)
          variants = products.flatMap((product) =>
            product.variants.map((v: any) => ({
              variant_id: v.id,
              product_name: product.name,
              size: v.size_name,
              color: v.color_name,
              sku: v.sku,
              unit_price: v.price,
              quantity:
                v.branch_availability.find((b: any) => b.branch_id === branch.id)?.quantity || 0,
            })),
          );
        else {
          const inventory = await this.downloadPages('/stocks/branch/' + branch.id);
          await this.store.cache(environment.apiUrl + '/stocks/branch/' + branch.id, inventory, scope);
          assertScope();
          variants = inventory.map((v) => ({
            ...v,
            size: v.size_name,
            color: v.color_name,
            unit_price: v.price,
          }));
          await this.store.cache(
            environment.apiUrl +
              '/payments?branch_id=' +
              encodeURIComponent(branch.id) +
              '&limit=100',
            await firstValueFrom(
              this.http.get(environment.apiUrl + '/payments', {
                params: { branch_id: branch.id, limit: 100 },
              }),
            ),
            scope,
          );
          await this.store.cache(
            environment.apiUrl +
              '/payments/pending-reservations?branch_id=' +
              encodeURIComponent(branch.id),
            await firstValueFrom(
              this.http.get(environment.apiUrl + '/payments/pending-reservations', {
                params: { branch_id: branch.id },
              }),
            ),
            scope,
          );
        }
        assertScope();
        await this.store.cache(
          environment.apiUrl + '/offline/catalog/' + branch.id,
          variants,
          scope,
        );
      }
      if (customer) {
        await this.store.cache(environment.apiUrl + '/reservations', await this.downloadPages('/reservations'), scope);
        await this.store.cache(environment.apiUrl + '/saas/history', await firstValueFrom(this.http.get(environment.apiUrl + '/saas/history')), scope);
      }
      assertScope();
      const completedAt = new Date().toISOString();
      await this.store.cache(
        this.metaUrl,
        { downloaded_at: completedAt, products: products.length },
        scope,
      );
      assertScope();
      await this.store.commitSnapshot(scope);
      this.enteredScope = scope;
      this.lastDownload.set(completedAt);
      this.productCount.set(products.length);
    } catch (error: any) {
      this.store.cancelSnapshot();
      this.error.set(
        error.name === 'QuotaExceededError' ? 'No hay espacio suficiente. Se conserva la última copia completa y todos los pendientes.' : error.error?.detail ||
          error.message ||
          'No se pudo actualizar el catálogo. Se conserva la última copia.',
      );
    } finally {
      this.busy.set(false);
    }
  }
  private async downloadPages(path: string, offsetKey = 'offset'): Promise<any[]> {
    const rows: any[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await firstValueFrom(this.http.get<any[]>(environment.apiUrl + path, { params: { limit: 100, [offsetKey]: offset } }));
      if (!this.store.online()) throw new Error('Se interrumpió la descarga. Se conserva la última copia completa.');
      rows.push(...page);
      if (page.length < 100) return rows;
    }
  }
}
