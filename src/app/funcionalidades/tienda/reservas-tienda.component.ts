import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { TiendaService } from './tienda.service';
import { Reservation } from '../../nucleo/modelos/reserva.model';
import { DialogoTiendaDirective } from './dialogo-tienda.directive';
type CustomerReservation = Reservation & {
  company_name?: string;
  tenant_id?: string;
  sync_status?: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, DialogoTiendaDirective],
  styleUrl: './tienda.css',
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Todo en un lugar</p>
        <h1>Mis reservas.</h1>
        <p class="muted">
          Tus prendas, sus estados y dónde recogerlas. El historial se conserva al cambiar de
          tienda.
        </p>
      </div>
      <button
        class="secondary"
        type="button"
        [disabled]="loading() || busy()"
        (click)="reload.update(increment)"
      >
        Actualizar
      </button>
    </div>
    @if (cancelledCheckout) {
      <p class="notice">
        Saliste de PayPal. Tu reserva sigue pendiente; puedes retomar el pago si aún está vigente.
      </p>
    }
    @if (error()) {
      <p class="notice error" role="alert">{{ error() }}</p>
    }
    @if (loading()) {
      <div class="empty" role="status">Buscando tus reservas…</div>
    } @else {
      <div class="stack">
        @for (r of rows(); track r.id) {
          <article class="panel">
            <div class="row">
              <div>
                <p class="eyebrow">{{ r.company_name || 'Tu tienda' }} · {{ r.branch_name }}</p>
                <h2>{{ r.reservation_code }}</h2>
              </div>
              <span class="status">{{
                r.sync_status === 'PENDING' ? 'Pendiente de sincronizar' : status(r.status)
              }}</span>
            </div>
            <p class="muted section-space">
              <small
                >{{ r.branch_address }} · Creada
                {{ shop.date(r.created_at) | date: 'dd/MM/yyyy HH:mm' }} · Vence
                {{ shop.date(r.expires_at) | date: 'dd/MM/yyyy HH:mm' }}</small
              >
            </p>
            @for (item of r.items; track item.id) {
              <div class="line-item">
                @if (item.image_url) {
                  <img [src]="shop.image(item.image_url)" [alt]="item.product_name || 'Prenda'" />
                }
                <div class="line-copy">
                  <h3>{{ item.product_name }}</h3>
                  <p>
                    {{ item.size_name }} · {{ item.color_name }} · {{ item.quantity }} unidad(es)
                  </p>
                </div>
                <strong>{{ (r.wholesale_discount_percent ? (item.original_price ?? item.price) : item.price) * item.quantity | number: '1.2-2' }} Bs</strong>
              </div>
            }
            <div class="summary-row">
              <span>{{ r.payment_status === 'PAID' ? 'Pagado' : 'Total de la reserva' }}</span
              ><strong
                >{{ r.total_amount ?? r.total_estimated_amount | number: '1.2-2' }} Bs</strong
              >
            </div>
            <p class="muted">
              <small>{{
                r.payment_status === 'PAID'
                  ? 'Pago confirmado. Recoge tus prendas en la sucursal indicada.'
                  : 'Pago pendiente. Puedes pagar en tienda.'
              }}</small>
            </p>
            @if (r.customer_notes) {
              <p class="muted">
                <small>Tu nota: {{ r.customer_notes }}</small>
              </p>
            }
            <div class="actions section-space">
              @if (active(r) && !r.id.startsWith('local-')) {
                @if (
                  r.branch_id === shop.selection()?.branch_id &&
                  (!r.tenant_id || r.tenant_id === shop.selection()?.tenant_id)
                ) {
                  <button class="primary" type="button" [disabled]="busy()" (click)="pay(r.id)">
                    Pagar con PayPal (Sandbox)
                  </button>
                } @else {
                  <span class="muted"
                    ><small
                      >Selecciona la tienda de esta reserva para pagar con PayPal.</small
                    ></span
                  >
                }
                <button
                  class="text-button"
                  type="button"
                  [disabled]="busy()"
                  (click)="cancelTarget.set(r)"
                >
                  Cancelar reserva
                </button>
              }
              @if (r.payment_status === 'PAID') {
                <button class="secondary" type="button" (click)="print(r)">
                  Ver comprobante de reserva
                </button>
              }
            </div>
          </article>
        } @empty {
          <div class="empty">
            <h2>Aquí comienza tu próxima visita</h2>
            <p>Aún no tienes reservas. Descubre prendas y reserva desde el carrito.</p>
            <a class="primary" routerLink="/catalog">Explorar catálogo</a>
          </div>
        }
      </div>
    }
    @if (cancelTarget(); as r) {
      <div class="overlay">
        <section
          class="dialog"
          style="max-width:460px"
          appShopDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-title"
        >
          <h2 id="cancel-title">¿Cancelar {{ r.reservation_code }}?</h2>
          <p class="muted section-space">
            Las prendas volverán a estar disponibles para otros clientes.
          </p>
          <div class="actions section-space">
            <button class="primary" type="button" [disabled]="busy()" (click)="cancel(r)">
              Sí, cancelar reserva</button
            ><button
              class="secondary"
              type="button"
              [disabled]="busy()"
              (click)="cancelTarget.set(null)"
            >
              Conservar reserva
            </button>
          </div>
        </section>
      </div>
    }
    @if (receipt(); as r) {
      <div class="overlay" (click)="receipt.set(null)">
        <section
          class="dialog"
          style="max-width:520px"
          appShopDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="receipt-title"
          (click)="$event.stopPropagation()"
        >
          <button
            class="dialog-close"
            type="button"
            aria-label="Cerrar comprobante"
            (click)="receipt.set(null)"
          >
            ×
          </button>
          <p class="eyebrow">Pago confirmado</p>
          <h2 id="receipt-title">Comprobante de reserva</h2>
          <div class="stack section-space">
            <p>{{ r.reservation_code }} · {{ r.company_name }} · {{ r.branch_name }}</p>
            <p>Cliente: {{ shop.auth.currentUser()?.full_name }}</p>
            <p>Código para cambios / devoluciones: <strong>{{r.exchange_code || r.reservation_code}}</strong></p>
            <p>Plazo: 48 horas desde la emisión del recibo.</p>
            @if(r.exchange_deadline){<p>Límite: {{r.exchange_deadline | date:'dd/MM/yyyy HH:mm'}}</p>}
            <p>Fecha: {{ shop.date(r.paid_at) | date: 'dd/MM/yyyy HH:mm' }}</p>
            <p>Método: {{ r.payment_method }}</p>
            <p>Referencia PayPal: {{ r.paypal_capture_id || r.paypal_order_id }}</p>
            @for (item of r.items; track item.id) {
              <div class="row">
                <span>{{ item.product_name }} × {{ item.quantity }}</span
                ><strong>{{ (r.wholesale_discount_percent ? (item.original_price ?? item.price) : item.price) * item.quantity | number: '1.2-2' }} Bs</strong>
              </div>
            }
            @if(r.wholesale_discount_percent){<p>Subtotal: {{r.subtotal_before_wholesale | number:'1.2-2'}} · Venta por mayor −{{r.wholesale_discount_percent}}%: −{{r.wholesale_discount_amount | number:'1.2-2'}}</p>}
            <div class="summary-row">
              <span>Total pagado</span
              ><strong
                >{{ r.total_amount ?? r.total_estimated_amount | number: '1.2-2' }} Bs</strong
              >
            </div>
            <p class="muted">
              <small
                >Los comprobantes PDF de compras en caja están disponibles en Mis compras y
                comprobantes.</small
              >
            </p>
            <a class="secondary" routerLink="/purchases" (click)="receipt.set(null)"
              >Ver mis compras</a
            >
          </div>
        </section>
      </div>
    }
  `,
})
export class ReservasTiendaComponent {
  readonly shop = inject(TiendaService);
  readonly route = inject(ActivatedRoute);
  readonly destroyRef = inject(DestroyRef);
  readonly rows = signal<CustomerReservation[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly reload = signal(0);
  readonly increment = (n: number) => n + 1;
  readonly cancelTarget = signal<CustomerReservation | null>(null);
  readonly receipt = signal<CustomerReservation | null>(null);
  readonly cancelledCheckout = this.route.snapshot.queryParamMap.get('checkout') === 'cancel';
  private autoPay = this.route.snapshot.queryParamMap.get('pay');
  constructor() {
    effect((onCleanup) => {
      const scope = this.shop.scope();
      this.reload();
      this.rows.set([]);
      this.cancelTarget.set(null);
      this.receipt.set(null);
      this.loading.set(true);
      this.error.set('');
      const request = this.shop.http
        .get<CustomerReservation[]>(`${this.shop.api}/reservations`)
        .subscribe({
          next: (rows) => {
            if (scope !== this.shop.scope()) return;
            this.rows.set(rows);
            this.loading.set(false);
            if (this.autoPay) {
              const id = this.autoPay;
              this.autoPay = null;
              const row = rows.find((r) => r.id === id);
              if (row && this.active(row)) this.pay(id);
              this.shop.router.navigate([], {
                relativeTo: this.route,
                queryParams: { pay: null },
                queryParamsHandling: 'merge',
                replaceUrl: true,
              });
            }
          },
          error: (e) => {
            this.loading.set(false);
            this.error.set(e?.error?.detail || 'No se pudieron cargar las reservas.');
          },
        });
      onCleanup(() => request.unsubscribe());
    });
  }
  status(value: string) {
    return (
      (
        {
          PENDING: 'Pendiente',
          CONFIRMED: 'Confirmada',
          COMPLETED: 'Completada',
          CANCELLED: 'Cancelada',
          EXPIRED: 'Vencida',
        } as Record<string, string>
      )[value] || value
    );
  }
  active(r: CustomerReservation) {
    return (
      ['PENDING', 'CONFIRMED'].includes(r.status) &&
      r.payment_status !== 'PAID' &&
      new Date(this.shop.date(r.expires_at)!).getTime() > Date.now()
    );
  }
  pay(id: string) {
    if (this.busy() || !this.shop.requireCustomer('/my-reservations')) return;
    this.busy.set(true);
    this.error.set('');
    this.shop.http
      .post<{ approval_url: string }>(
        `${this.shop.api}/reservations/${encodeURIComponent(id)}/paypal-order`,
        {},
      )
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (result) => {
          const url = new URL(result.approval_url);
          if (
            url.protocol === 'https:' &&
            (url.hostname === 'paypal.com' || url.hostname.endsWith('.paypal.com'))
          )
            window.location.assign(url.href);
          else this.error.set('No se recibió un enlace válido de PayPal.');
        },
        error: (e) =>
          this.error.set(
            e?.error?.detail ||
              'No se pudo iniciar el pago. La reserva se conserva; puedes reintentar.',
          ),
      });
  }
  cancel(r: CustomerReservation) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.shop.http
      .delete<CustomerReservation>(`${this.shop.api}/reservations/${r.id}`)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          this.cancelTarget.set(null);
          this.reload.update(this.increment);
        },
        error: (e) => this.error.set(e?.error?.detail || 'No se pudo cancelar la reserva.'),
      });
  }
  print(r: CustomerReservation) {
    this.receipt.set(r);
  }
}
