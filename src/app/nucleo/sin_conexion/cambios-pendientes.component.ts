import { wholesaleSummary } from '../venta-mayor';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AlmacenSinConexion, OfflineOperation } from './almacen-sin-conexion.service';
import { SincronizacionSinConexion } from './sincronizacion-sin-conexion.service';

@Component({
  selector: 'app-pending-changes',
  imports: [DatePipe, DecimalPipe, FormsModule],
  template: `
    <section id="pending" aria-labelledby="pending-title">
      <div class="heading"><h2 id="pending-title">Cambios pendientes y resultados</h2>
        <button type="button" (click)="sync.sync()" [disabled]="sync.syncing() || !store.online()">{{sync.syncing() ? 'Sincronizando…' : 'Sincronizar ahora'}}</button>
      </div>
      <p>Los cambios se guardan en este dispositivo. El servidor confirma permisos, disponibilidad y límites al recuperar la conexión.</p>
      <p>Una reserva o venta pendiente todavía no garantiza stock. Si el servidor la rechaza por falta de existencias, esa operación no registra un cobro ni descuenta inventario.</p>
      @if(error()) { <p role="alert">{{error()}}</p> }
      @if(store.storageUsage() !== null) {
        <p>Almacenamiento del sitio: {{store.storageUsage()! / 1048576 | number:'1.1-1'}} MB
          @if(store.storageQuota()) { de aproximadamente {{store.storageQuota()! / 1048576 | number:'1.0-0'}} MB disponibles como cuota. }
          La web y la PWA comparten esta cuota del navegador.</p>
      }
      @if(!store.persistent()) { <button type="button" (click)="store.protectStorage()">Proteger almacenamiento local</button> }
      @else { <p>Almacenamiento persistente concedido por el navegador.</p> }
      @for(row of visible(); track row.id) {
        <article><div class="heading"><strong>{{label(row)}} · {{row.preview.name || row.preview.company_name || row.preview.full_name || row.preview.customer_name || 'Registro'}}</strong>
          <span>{{row.state === 'SYNCED' ? 'Confirmado' : row.state === 'CONFLICT' ? 'Conflicto' : 'Pendiente'}}</span></div>
          <small>{{row.created_at | date:'dd/MM/yyyy HH:mm'}} · Intentos: {{row.attempts}}</small><p>{{row.message}}</p>
          @if(row.state === 'CONFLICT') {
            <button type="button" (click)="retry(row)" [disabled]="sync.syncing()">Volver a intentar tras revisar</button>
            @if(canCorrect(row)) {
              <button type="button" (click)="edit(row)" [disabled]="sync.syncing()">Corregir cantidades</button>
            }
          }
          @if(editing() === row.id) {
            <p>Reduce las cantidades o coloca 0 para quitar una línea. Debe quedar al menos una prenda. La disponibilidad se comprueba de nuevo al enviar.</p>
            @for(item of row.body.items; track item.variant_id) {
              <label>{{item.product_name || (row.conflict?.variant_id === item.variant_id ? row.conflict?.product_name : item.variant_id)}}
                <input type="number" min="0" [max]="item.quantity" step="1" [(ngModel)]="quantities[item.variant_id]" [disabled]="sync.syncing()" />
              </label>
            }
            <button type="button" (click)="correct(row)" [disabled]="sync.syncing()">Guardar corrección y reintentar</button>
            <button type="button" (click)="editing.set(null)">Cerrar</button>
          }
        </article>
      } @empty { <p>No hay cambios locales registrados para tu cuenta.</p> }
    </section>
  `,
  styles: [`section{background:white;border:1px solid #e4ddd6;border-radius:18px;padding:24px;margin:20px 0} .heading{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}h2{font-size:1.1rem}p,small{font-size:.85rem;color:#77685c}article{border-top:1px solid #e4ddd6;padding:16px 0}button{border:1px solid #cdbfb1;border-radius:9px;padding:9px 14px;background:#faf7f2;color:#654438;cursor:pointer}button:disabled{opacity:.5}span{font-size:.8rem;background:#f4e8ca;border-radius:12px;padding:4px 9px}`],
})
export class CambiosPendientesComponent {
  readonly store = inject(AlmacenSinConexion);
  readonly sync = inject(SincronizacionSinConexion);
  readonly editing = signal<string | null>(null);
  readonly error = signal('');
  quantities: Record<string, number> = {};
  readonly visible = computed(() => this.store.operations().filter(row => row.scope === this.store.scope).slice().reverse());
  constructor() { void this.store.refresh().catch(() => {}); void this.store.measureStorage(); }
  label(row: OfflineOperation): string {
    const names: Record<string, string> = { suppliers: 'Proveedor', promotions: 'Promoción', seasons: 'Temporada', products: 'Prenda', branches: 'Sucursal', users: 'Personal / perfil', inventory: 'Movimiento', stocks: 'Stock', reservations: 'Reserva', payments: 'Pago', attributes: 'Talla, color o categoría' };
    return names[row.path.split('/')[1]] || 'Cambio';
  }
  canCorrect(row: OfflineOperation): boolean {
    return row.state === 'CONFLICT' && row.conflict?.code === 'STOCK_INSUFFICIENT' &&
      ['/reservations', '/payments/offline-sale'].includes(row.path) && !!row.body.items?.length && !row.body.reservation_id;
  }
  edit(row: OfflineOperation): void {
    if (!this.canCorrect(row) || this.sync.syncing()) return;
    this.error.set('');
    this.quantities = Object.fromEntries(row.body.items.map((item: any) => [item.variant_id, item.quantity]));
    this.editing.set(row.id);
  }
  async correct(row: OfflineOperation): Promise<void> {
    if (this.sync.syncing() || !this.canCorrect(row)) return;
    const items = row.body.items.map((item: any) => ({ ...item, quantity: Number(this.quantities[item.variant_id]) }));
    if (items.some((item: any, index: number) => !Number.isSafeInteger(item.quantity) || item.quantity < 0 || item.quantity > row.body.items[index].quantity) ||
        !items.some((item: any) => item.quantity > 0) || items.every((item: any, index: number) => item.quantity === row.body.items[index].quantity)) {
      this.error.set('Reduce alguna cantidad, usa números enteros y conserva al menos una prenda.'); return;
    }
    try {
      await this.store.refresh();
      const current = this.store.operations().find(item => item.id === row.id);
      if (!current || current.owner !== this.store.owner || current.scope !== this.store.scope || !this.canCorrect(current) || JSON.stringify(current.body) !== JSON.stringify(row.body)) {
        this.error.set('La operación cambió. Revisa su estado antes de corregirla.'); return;
      }
      const body = { ...current.body, items: items.filter((item: any) => item.quantity > 0) };
      if (current.path === '/payments/offline-sale') {
        body.items = body.items.map((item: any) => ({ ...item, subtotal: Math.round(item.quantity * item.unit_price * 100) / 100 }));
        body.amount = wholesaleSummary(body.items.reduce((sum: number, item: any) => sum + item.subtotal, 0), body.items.reduce((sum:number,item:any)=>sum+item.quantity,0)).total_amount;
        if (body.amount <= 0) { this.error.set('El total de la venta debe ser mayor a cero.'); return; }
      }
      // Preserve the UUID: if another window already confirmed the original,
      // the server rejects changed data instead of creating a second charge.
      await this.store.update({ ...current, body, preview: { ...current.preview, ...body, total_items: body.items.reduce((sum: number, item: any) => sum + item.quantity, 0) }, state: 'PENDING', conflict: undefined, message: 'Cantidades corregidas. Pendiente de confirmación del servidor.' });
      this.editing.set(null); this.error.set('');
      await this.sync.sync();
    } catch { this.error.set('No se pudo guardar la corrección. La operación original se conserva.'); }
  }
  async retry(row: OfflineOperation) {
    if (this.sync.syncing()) return;
    this.editing.set(null);
    await this.store.refresh();
    const current = this.store.operations().find(item => item.id === row.id);
    if (!current || current.owner !== this.store.owner || current.state !== 'CONFLICT') return;
    await this.store.update({ ...current, state: 'PENDING', conflict: undefined, message: 'Pendiente de reintento tras revisión.' }); await this.sync.sync();
  }
}
