import { AporteLocal, ownWrites } from './aporte-local';
import { Injectable, inject } from '@angular/core';
import { AlmacenSinConexion } from './almacen-sin-conexion.service';
import { queryLocalCatalog } from './consulta-catalogo';
import { environment } from '../../../environments/environment';

const resources = ['/suppliers', '/seasons', '/promotions', '/attributes/categories', '/attributes/sizes', '/attributes/colors', '/products', '/branches', '/users', '/inventory/movements'];
export function resourcePath(path: string): string | undefined {
  return resources.find(root => path === root || path.startsWith(root + '/'));
}
export function managedWrite(path: string, method: string): boolean {
  if(method==='POST' && ownWrites.includes(path)) return true;
  const root = resourcePath(path);
  if (path === '/users/me') return method === 'PUT';
  if (path === '/stocks/adjust') return method === 'POST';
  if (!root) return false;
  if (path === root) return method === 'POST';
  if (path.slice(root.length).split('/').length === 2) return method === 'PUT' || (root === '/inventory/movements' && method === 'DELETE');
  if (/\/toggle-status$/.test(path)) return method === 'PATCH';
  return root === '/branches' && /\/staff(?:\/[^/]+)?$/.test(path) && ['POST', 'DELETE'].includes(method);
}

@Injectable({ providedIn: 'root' })
export class RepositorioSinConexion {
  readonly store = inject(AlmacenSinConexion);
  private readonly base = environment.apiUrl.replace(/\/$/, '');
  private resolve(value: any): any {
    const aliases: Record<string, string> = {};
    for (const op of this.store.operations()) if (op.state === 'SYNCED') Object.assign(aliases, op.result?._local_ids || {});
    const visit = (item: any): any => Array.isArray(item) ? item.map(visit) : item && typeof item === 'object'
      ? Object.fromEntries(Object.entries(item).map(([k, v]) => [aliases[k] || k, visit(v)])) : typeof item === 'string' ? aliases[item] || item : item;
    return visit(value);
  }
  private projectedQuantity(branch: string, variant: string, quantity: number, savedAt: string): number {
    for (const op of this.store.operations().filter(row => row.scope === this.store.scope && this.resolve(row.branch_id) === branch)) {
      if (op.state === 'CONFLICT' || (op.state === 'SYNCED' && (op.confirmed_at || op.created_at) <= savedAt)) continue;
      const body = this.resolve(op.body);
      if (op.path === '/inventory/movements' && op.method === 'POST' && body.variant_id === variant)
        quantity = body.type === 'ADJUSTMENT' ? body.quantity : Math.max(0, quantity + (body.type === 'EXIT' ? -body.quantity : body.quantity));
      else if (op.path === '/stocks/adjust' && body.variant_id === variant) quantity = body.quantity;
      else if(op.path==='/own/exchanges') {
        if(body.new_variant_id===variant)quantity=Math.max(0,quantity-body.quantity);
        if(op.preview.returned_variant_id===variant)quantity+=body.quantity;
      }
      else if(op.path==='/own/loyalty/claim' && body.variant_id===variant)quantity=Math.max(0,quantity-1);
      else if (['/payments/offline-sale', '/reservations'].includes(op.path))
        for (const line of body.items || []) if (line.variant_id === variant) quantity = Math.max(0, quantity - line.quantity);
    }
    return quantity;
  }

  private async rows(root: string, scope = this.store.scope): Promise<any[]> {
    const cached = await this.store.cached(this.base + root, scope);
    const source = Array.isArray(cached?.data) ? cached.data : [];
    const items = new Map<string, any>(source.map(row => [row.id, structuredClone(row)]));
    await this.store.refresh();
    const aliases: Record<string, string> = {};
    for (const op of this.store.operations()) if (op.state === 'SYNCED') Object.assign(aliases, op.result?._local_ids || {});
    for (const op of this.store.operations().filter(row => row.scope === scope && resourcePath(row.path) === root)) {
      if (op.state === 'SYNCED' && (op.confirmed_at || op.created_at) <= (cached?.saved_at || '')) continue;
      const value = this.resolve(structuredClone(op.state === 'SYNCED' ? op.result : { ...op.preview, sync_status: op.state }));
      if (!value) continue;
      const localId = 'local-' + op.id;
      const id = aliases[value.id] || value.id;
      if (id !== localId) items.delete(localId);
      const segments = op.path.slice(root.length).split('/').filter(Boolean);
      const target = aliases[segments[0]] || segments[0] || id;
      if (op.method === 'DELETE' && root === '/inventory/movements') items.delete(target);
      else items.set(target, { ...(items.get(target) || {}), ...value, id: target });
    }
    return [...items.values()];
  }

  async queue(path: string, method: string, body: any): Promise<any> {
    if(ownWrites.includes(path))return new AporteLocal(this.store).queue(path,body);
    const user = this.store.tokens.getIdentity();
    const scope = this.store.scope;
    if (!user) throw new Error('Inicia sesión antes de guardar cambios locales.');
    const root = resourcePath(path);
    const adminOnly = root === '/branches' || (root === '/users' && path !== '/users/me');
    if (path !== '/users/me' && (adminOnly ? user.role !== 'ADMIN' : !['ADMIN', 'STORE_MANAGER'].includes(user.role))) throw new Error('Tu rol no permite esta operación.');
    const current = path === '/users/me' ? user : root ? (await this.rows(root)).find(row => row.id === path.slice(root.length + 1).split('/')[0]) : null;
    let stock: any;
    if (path === '/stocks/adjust' || (path === '/inventory/movements' && method === 'POST')) {
      stock = (await this.inventory(body.branch_id)).find(row => row.variant_id === body.variant_id);
      if (!stock) throw new Error('Descarga primero el stock de esta variante y sucursal.');
      if (body.type === 'EXIT' && body.quantity > stock.quantity) throw new Error('Stock local insuficiente para esta salida.');
      if (body.type === 'ADJUSTMENT' || path === '/stocks/adjust') body = { ...body, _base_quantity: stock.quantity };
    }
    const preview = (id: string, now: string) => {
      const value: any = {
        is_active: true, is_verified: false, ...current, ...body,
        id: current?.id || id, created_at: current?.created_at || now, updated_at: now,
      };
      delete value.password;
      if (path.endsWith('/toggle-status')) value.is_active = !current?.is_active;
      if (root === '/branches') Object.assign(value, { manager: current?.manager || null, cashiers: current?.cashiers || [], staff_count: current?.staff_count || 0 });
      if (root === '/seasons' || root === '/promotions') value.product_count = current?.product_count || 0;
      if (root === '/products' && method === 'POST') value.variants = (body.variants || []).map((v: any, index: number) => ({
        ...v, id: id + '-variant-' + index, product_id: id, sku: v.sku || 'LOCAL-' + index, is_active: true,
        stocks: Object.entries(v.initial_stock || {}).map(([branch_id, quantity]) => ({ branch_id, variant_id: id + '-variant-' + index, quantity, min_alert_threshold: 5 })),
      }));
      if (root === '/inventory/movements') {
        value.previous_stock = stock?.quantity ?? current?.previous_stock;
        value.new_stock = body.type === 'ADJUSTMENT' ? body.quantity : (stock?.quantity || 0) + (body.type === 'EXIT' ? -body.quantity : body.quantity || 0);
        value.product_name = stock?.product_name || current?.product_name;
        value.sku = stock?.sku || current?.sku;
        value.user_id = user.id; value.user_name = user.full_name;
      }
      return value;
    };
    if (user.id !== this.store.owner || scope !== this.store.scope) throw new Error('La cuenta o tienda cambió. Vuelve a abrir el formulario antes de guardar.');
    return this.store.enqueue(path, body, preview, method, ['/inventory/movements', '/stocks/adjust'].includes(path));
  }

  private filtered(items: any[], params: URLSearchParams): any[] {
    let rows = items.filter(item => {
      for (const key of ['category_id', 'season_id', 'supplier_id', 'branch_id', 'variant_id', 'product_id', 'role', 'type', 'category_type', 'city', 'is_active', 'status']) {
        if (params.has(key) && String(item[key]) !== params.get(key)) return false;
      }
      const term = (params.get('search') || '').trim().toLocaleLowerCase();
      return !term || [item.name, item.full_name, item.email, item.company_name, item.product_name, item.sku, item.description, item.contact_name].join(' ').toLocaleLowerCase().includes(term);
    });
    const start = Number(params.get('skip') || params.get('offset') || 0);
    if (start || params.has('limit')) rows = rows.slice(start, params.has('limit') ? start + Number(params.get('limit')) : undefined);
    return rows;
  }

  async products(projectStock = false): Promise<any[]> {
    const products = await this.rows('/products');
    const savedAt = (await this.store.cached(this.base + '/products'))?.saved_at || '';
    const [categories, sizes, colors, seasons, suppliers, promotions] = await Promise.all(
      ['/attributes/categories', '/attributes/sizes', '/attributes/colors', '/seasons', '/suppliers', '/promotions'].map(root => this.rows(root)),
    );
    for (const product of products) {
      const created = this.store.operations().find(op => op.path === '/products' && op.method === 'POST' && (op.result?.id === product.id || op.preview.id === product.id));
      const baseline = created?.confirmed_at && created.confirmed_at > savedAt ? created.confirmed_at : savedAt;
      product.category_name = categories.find(c => c.id === product.category_id)?.name || product.category_name;
      product.season_name = seasons.find(c => c.id === product.season_id)?.name || product.season_name;
      product.supplier_name = suppliers.find(c => c.id === product.supplier_id)?.company_name || product.supplier_name;
      const promotion = promotions.find(c => c.id === product.promotion_id);
      product.discount_percent = promotion?.is_active ? promotion.discount_percent : product.discount_percent || 0;
      product.variants = (product.variants || []).map((variant: any) => {
        const size = sizes.find(c => c.id === variant.size_id), color = colors.find(c => c.id === variant.color_id);
        const stocks = (variant.stocks || []).map((s: any) => ({ ...s, quantity: projectStock ? this.projectedQuantity(s.branch_id, variant.id, s.quantity, baseline) : s.quantity }));
        return { ...variant, size_name: size?.name || variant.size_name || '', size_code: size?.code || variant.size_code || '', color_name: color?.name || variant.color_name || '', color_hex: color?.hex_code || variant.color_hex || '', stocks, total_stock: stocks.reduce((n: number, stock: any) => n + stock.quantity, 0) };
      });
      product.total_stock = product.variants.reduce((n: number, v: any) => n + v.total_stock, 0);
    }
    return products;
  }

  async inventory(branch: string): Promise<any[]> {
    const cached = await this.store.cached(this.base + '/stocks/branch/' + branch);
    const rows = new Map<string, any>((cached?.data || []).map((row: any) => [row.variant_id, { ...row }]));
    for (const p of await this.products()) for (const v of p.variants) {
      const stock = v.stocks.find((s: any) => s.branch_id === branch);
      if (!rows.has(v.id) && stock) rows.set(v.id, { ...v, variant_id: v.id, product_id: p.id, product_name: p.name, category_name: p.category_name, price: v.price_override || p.price, quantity: stock.quantity, min_alert_threshold: stock.min_alert_threshold || 5 });
    }
    return [...rows.values()].map(row => {
      const quantity = this.projectedQuantity(branch, row.variant_id, row.quantity, cached?.saved_at || '');
      return { ...row, quantity, is_low_stock: quantity <= row.min_alert_threshold };
    });
  }

  async read(url: string): Promise<{ data: any; saved_at: string } | undefined> {
    const parsed = new URL(url), path = parsed.pathname.slice(new URL(this.base).pathname.length), params = parsed.searchParams;
    const root = resourcePath(path);
    if(path.startsWith('/own/') || path==='/promotions/suggestions/stock-age') return new AporteLocal(this.store).read(url);
    if (path === '/users/me') {
      const rows = this.store.operations().filter(row => row.scope === this.store.scope && row.path === '/users/me');
      const user = this.store.tokens.getIdentity();
      return user ? { data: { ...user, ...rows.filter(row => row.state !== 'CONFLICT').at(-1)?.preview }, saved_at: user.updated_at || '' } : undefined;
    }
    if (root) {
      const cached = await this.store.cached(this.base + root);
      const items = root === '/products' ? await this.products(true) : await this.rows(root);
      if (!cached && !items.length) return undefined;
      const id = path.slice(root.length + 1).split('/')[0];
      return { data: id ? items.find(row => row.id === id) : this.filtered(items, params), saved_at: cached?.saved_at || new Date().toISOString() };
    }
    const stock = /^\/stocks\/branch\/([^/]+)$/.exec(path);
    if (stock) return { data: this.filtered(await this.inventory(stock[1]), params).filter(row => !params.get('low_stock_only') || row.is_low_stock), saved_at: (await this.store.cached(this.base + path))?.saved_at || '' };
    const branches = await this.rows('/branches');
    if (path === '/stocks/matrix') {
      const visible = branches.filter(b => b.is_active && (!params.get('branch_id') || b.id === params.get('branch_id')));
      const inventories = await Promise.all(visible.map(async b => ({ branch: b.id, rows: await this.inventory(b.id) })));
      const matrix = new Map<string, any>();
      for (const inventory of inventories) for (const row of inventory.rows) {
        if (params.get('product_id') && row.product_id !== params.get('product_id')) continue;
        const value = matrix.get(row.variant_id) || { ...row, total_quantity: 0, branches: {} };
        value.branches[inventory.branch] = row.quantity; value.total_quantity += row.quantity; matrix.set(row.variant_id, value);
      }
      return { data: [...matrix.values()], saved_at: '' };
    }
    const summary = /^\/inventory\/summary\/([^/]+)$/.exec(path);
    if (summary) {
      const rows = await this.inventory(summary[1]);
      return { data: { branch_id: summary[1], branch_name: branches.find(b => b.id === summary[1])?.name || '', total_variants: rows.length, total_units: rows.reduce((n, r) => n + r.quantity, 0), low_stock_count: rows.filter(r => r.is_low_stock).length, out_of_stock_count: rows.filter(r => !r.quantity).length }, saved_at: '' };
    }
    const availability = /^\/stocks\/variant\/([^/]+)\/availability$/.exec(path);
    if (availability) return { data: await Promise.all(branches.map(async b => {
      const quantity = (await this.inventory(b.id)).find(row => row.variant_id === availability[1])?.quantity || 0;
      return { branch_id: b.id, branch_name: b.name, branch_city: b.city, branch_address: b.address, quantity, status: quantity <= 0 ? 'OUT_OF_STOCK' : quantity <= 5 ? 'LOW_STOCK' : 'IN_STOCK' };
    })), saved_at: '' };
    if (path.startsWith('/catalog/products')) {
      const snapshot = await this.store.cached(this.base + '/offline/products');
      if (!snapshot) return undefined;
      const products = structuredClone(snapshot.data).map((p: any) => {
        for (const variant of p.variants || []) {
          variant.branch_availability = (variant.branch_availability || []).map((b: any) => ({ ...b, quantity: this.projectedQuantity(b.branch_id, variant.id, b.quantity, snapshot.saved_at) }));
          variant.total_stock = variant.branch_availability.reduce((n: number, b: any) => n + b.quantity, 0);
        }
        p.total_stock = (p.variants || []).reduce((n: number, v: any) => n + v.total_stock, 0);
        return p;
      });
      const data = path === '/catalog/products' ? queryLocalCatalog(products, url) : products.find((p: any) => p.id === path.split('/').pop());
      return { data, saved_at: snapshot.saved_at };
    }
    if (path === '/payments' || path === '/reservations') {
      const cached = await this.store.cached(url) || await this.store.cached(this.base + path);
      await this.store.refresh();
      const operations = this.store.operations().filter(row => row.scope === this.store.scope && row.path === (path === '/payments' ? '/payments/offline-sale' : '/reservations'));
      const items = new Map<string, any>((cached?.data || []).map((row: any) => [row.id, row]));
      for (const row of operations) {
        const item = row.state === 'SYNCED' ? row.result : { ...row.preview, sync_status: row.state };
        if (item) items.set(item.id, item);
      }
      return cached || operations.length ? { data: this.filtered([...items.values()], params), saved_at: cached?.saved_at || new Date().toISOString() } : undefined;
    }
    return this.store.cached(url);
  }
}
