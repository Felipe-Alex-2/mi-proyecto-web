import { Injectable, inject, signal } from '@angular/core';
import { TokenService } from '../servicios/token.service';
import { ContextoSesion } from '../servicios/contexto-sesion.service';
import { environment } from '../../../environments/environment';

export type SyncState = 'PENDING' | 'SYNCED' | 'CONFLICT';
export interface OfflineOperation {
  id: string;
  owner: string;
  scope: string;
  tenant_id: string;
  branch_id: string;
  method: string;
  path: string;
  body: any;
  preview: any;
  created_at: string;
  state: SyncState;
  attempts: number;
  message: string;
  result?: any;
  confirmed_at?: string;
  conflict?: { code: string; message: string; variant_id?: string; product_name?: string; available?: number; requested?: number };
  secrets?: { iv: number[]; data: number[] };
}
export interface CacheRow {
  key: string;
  scope: string;
  url: string;
  data: any;
  saved_at: string;
}

@Injectable({ providedIn: 'root' })
export class AlmacenSinConexion {
  private readonly session = inject(ContextoSesion);
  readonly tokens = inject(TokenService);
  readonly online = signal(navigator.onLine);
  readonly message = signal('');
  readonly operations = signal<OfflineOperation[]>([]);
  readonly revision = signal(0);
  private database?: Promise<IDBDatabase>;
  private lastCreatedAt = 0;
  private staging?: { scope: string; started_at: string; rows: Map<string, CacheRow> };
  get snapshotActive(): boolean { return !!this.staging; }
  readonly storageUsage = signal<number | null>(null);
  readonly storageQuota = signal<number | null>(null);
  readonly persistent = signal(false);
  setOnline(online: boolean): void {
    this.online.set(online);
    if (online && /^(Mostrando datos guardados|Guardado en este dispositivo|Guardado localmente)/.test(this.message())) this.message.set('');
  }
  get owner(): string {
    return this.tokens.getIdentity()?.id || '';
  }
  get scope(): string {
    const user = this.tokens.getIdentity();
    return [
      environment.apiUrl,
      user?.id,
      user?.role === 'CUSTOMER' ? user.selected_tenant_id : user?.tenant_id,
      user?.role === 'CUSTOMER' ? user.branch_id : 'staff',
    ].join('|');
  }
  private open(): Promise<IDBDatabase> {
    if (!globalThis.indexedDB)
      return Promise.reject(new Error('Este navegador no permite guardar datos offline.'));
    return (this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(this.session.key('vesta-offline'), 3);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('operations')) db.createObjectStore('operations', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys', { keyPath: 'id' });
        const operations = request.transaction!.objectStore('operations');
        if (!operations.indexNames.contains('owner')) operations.createIndex('owner', 'owner');
        const cache = request.transaction!.objectStore('cache');
        if (!cache.indexNames.contains('scope')) cache.createIndex('scope', 'scope');
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onblocked = () => this.message.set('Cierra las otras ventanas antiguas de VESTA para completar la actualización del almacenamiento local. Tus pendientes se conservan.');
      request.onerror = () => { this.database = undefined; reject(request.error); };
    }));
  }
  async read<T>(store: string, key?: string): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const request =
        key === undefined ? tx.objectStore(store).getAll() : tx.objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async write(store: string, value: any): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  async cache(url: string, data: any, scope = this.scope): Promise<void> {
    const row = {
      key: scope + '|' + url,
      scope,
      url,
      data,
      saved_at: this.staging?.scope === scope ? this.staging.started_at : new Date().toISOString(),
    };
    if (this.staging?.scope === scope) this.staging.rows.set(row.key, row);
    else await this.write('cache', row);
  }
  beginSnapshot(scope: string): void { this.staging = { scope, started_at: new Date().toISOString(), rows: new Map() }; }
  cancelSnapshot(): void { this.staging = undefined; }
  async commitSnapshot(scope: string): Promise<void> {
    const staging = this.staging;
    if (!staging || staging.scope !== scope || this.scope !== scope) throw new Error('La cuenta o tienda cambió durante la descarga.');
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('cache', 'readwrite');
      for (const row of staging.rows.values()) tx.objectStore('cache').put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('No se pudo guardar la copia completa.'));
    });
    this.staging = undefined;
    await this.measureStorage();
  }
  async measureStorage(): Promise<void> {
    try {
      const estimate = await navigator.storage?.estimate();
      this.storageUsage.set(estimate?.usage ?? null);
      this.storageQuota.set(estimate?.quota ?? null);
      this.persistent.set(await navigator.storage?.persisted() || false);
    } catch { /* Storage estimates are optional in some browsers. */ }
  }
  async protectStorage(): Promise<void> {
    try { this.persistent.set(await navigator.storage?.persist() || false); } catch { /* Optional. */ }
    await this.measureStorage();
  }
  async cached(url: string, scope = this.scope): Promise<CacheRow | undefined> {
    return this.read<CacheRow | undefined>('cache', scope + '|' + url);
  }
  async refresh(): Promise<void> {
    const rows = await this.ownedOperations();
    this.operations.set(
      rows
        .filter((row) => row.owner === this.owner && row.scope.startsWith(environment.apiUrl + '|'))
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)),
    );
  }
  async ownedOperations(): Promise<OfflineOperation[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction('operations', 'readonly').objectStore('operations').index('owner').getAll(this.owner);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async enqueue(path: string, body: any, preview: any = {}, method = 'POST', needsBranch = true, branchOverride?:string): Promise<any> {
    const user = this.tokens.getIdentity();
    const scope = this.scope;
    const tenant = user?.role === 'CUSTOMER' ? user.selected_tenant_id : user?.tenant_id;
    const branch = branchOverride || body.branch_id || user?.branch_id || '';
    if (!user || !tenant || (needsBranch && !branch))
      throw new Error(
        'Inicia sesión y selecciona tu empresa y sucursal antes de operar sin conexión.',
      );
    this.lastCreatedAt = Math.max(Date.now(), this.lastCreatedAt + 1);
    const id = crypto.randomUUID(),
      created_at = new Date(this.lastCreatedAt).toISOString();
    const extra = typeof preview === 'function' ? preview('local-' + id, created_at) : preview;
    const sanitized = { ...body };
    let secrets: OfflineOperation['secrets'];
    if (sanitized.password) {
      const key = await this.secretKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify({ password: sanitized.password })));
      secrets = { iv: Array.from(iv), data: Array.from(new Uint8Array(data)) };
      delete sanitized.password;
    }
    const local = {
      ...sanitized,
      ...extra,
      id: extra.id || 'local-' + id,
      sync_status: 'PENDING',
      created_at,
      status: 'PENDING',
      payment_code: 'LOCAL-' + id.slice(0, 8),
      reservation_code: 'LOCAL-' + id.slice(0, 8),
      payment_status: 'PENDING',
    };
    await this.write('operations', {
      id,
      owner: user.id,
      scope,
      tenant_id: tenant,
      branch_id: branch,
      method,
      path,
      body: sanitized,
      ...(secrets ? { secrets } : {}),
      preview: local,
      created_at,
      state: 'PENDING',
      attempts: 0,
      message: 'Guardado en este dispositivo. Pendiente de confirmación del servidor.',
    } satisfies OfflineOperation);
    await this.refresh();
    this.message.set(
      'Guardado en este dispositivo. Se enviará automáticamente al recuperar conexión.',
    );
    return local;
  }
  private async secretKey(): Promise<CryptoKey> {
    const db = await this.open();
    // Generate outside the transaction; choose the first persisted key atomically.
    const generated = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite'), store = tx.objectStore('keys');
      const request = store.get('credentials');
      let key: CryptoKey;
      request.onsuccess = () => {
        key = request.result?.key || generated;
        if (!request.result) store.put({ id: 'credentials', key });
      };
      tx.oncomplete = () => resolve(key);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }
  async commandBody(row: OfflineOperation): Promise<any> {
    if (!row.secrets) return row.body;
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(row.secrets.iv) }, await this.secretKey(), new Uint8Array(row.secrets.data));
    return { ...row.body, ...JSON.parse(new TextDecoder().decode(decrypted)) };
  }
  async update(row: OfflineOperation): Promise<void> {
    if (row.state === 'SYNCED' && !row.confirmed_at) row = { ...row, confirmed_at: new Date().toISOString() };
    if (row.state === 'SYNCED') row = { ...row, secrets: undefined };
    await this.write('operations', row);
    await this.refresh();
    this.revision.update((n) => n + 1);
    if (row.path === '/users/me' && row.owner === this.owner) {
      const user = row.state === 'SYNCED' ? row.result : row.state === 'CONFLICT' ? (await this.cached(environment.apiUrl + '/users/me'))?.data : null;
      if (user) window.dispatchEvent(new CustomEvent('vesta-profile-confirmed', { detail: user }));
    }
  }
  async listCache(): Promise<CacheRow[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction('cache', 'readonly').objectStore('cache').index('scope').getAll(this.scope);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
