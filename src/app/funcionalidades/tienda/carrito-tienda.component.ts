import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { TiendaService } from './tienda.service';
import { Reservation } from '../../nucleo/modelos/reserva.model';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  styleUrl: './tienda.css',
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Un paso más cerca</p>
        <h1>Tu carrito.</h1>
        <p class="muted">
          {{ shop.company()?.name }} · {{ shop.branch()?.name }}. Revisa tus prendas antes de
          reservar.
        </p>
      </div>
      <a class="text-button" routerLink="/catalog">Seguir explorando →</a>
    </div>
    @if (shop.cartError()) {
      <div class="notice error" role="alert">
        {{ shop.cartError()
        }}<button class="text-button" type="button" (click)="shop.refreshCart()">Reintentar</button>
      </div>
    }
    @if (shop.cart().items.length) {
      <div class="split">
        <section class="panel">
          <h2>Tu selección</h2>
          @for (item of shop.cart().items; track item.id) {
            <article class="line-item">
              @if (item.image_url) {
                <img [src]="shop.image(item.image_url)" [alt]="item.product_name" />
              }
              <div class="line-copy">
                <h3>{{ item.product_name }}</h3>
                <p>{{ item.size_name }} · {{ item.color_name }}</p>
                <p>
                  {{ item.price | number: '1.2-2' }} Bs · {{ item.available_stock }} disponibles
                </p>
                <button
                  class="text-button"
                  type="button"
                  [disabled]="shop.busy() || submitting()"
                  (click)="shop.removeItem(item.id)"
                >
                  Eliminar
                </button>
              </div>
              <div class="quantity">
                <button
                  type="button"
                  [disabled]="item.quantity <= 1 || shop.busy() || submitting()"
                  [attr.aria-label]="'Reducir cantidad de ' + item.product_name"
                  (click)="shop.updateQuantity(item, item.quantity - 1)"
                >
                  −</button
                ><span>{{ item.quantity }}</span
                ><button
                  type="button"
                  [disabled]="
                    item.quantity >= item.available_stock ||
                    item.quantity >= 50 ||
                    shop.busy() ||
                    submitting()
                  "
                  [attr.aria-label]="'Aumentar cantidad de ' + item.product_name"
                  (click)="shop.updateQuantity(item, item.quantity + 1)"
                >
                  +
                </button>
              </div>
              <strong>{{ item.subtotal | number: '1.2-2' }} Bs</strong>
            </article>
          }
        </section>
        <form class="panel stack" (ngSubmit)="checkout()">
          <h2>Reserva tus prendas</h2>
          <p class="muted">
            <small
              >Recoge en {{ shop.branch()?.name }}, {{ shop.branch()?.city }}. El stock se confirma
              al crear la reserva.</small
            >
          </p>
          <label class="field"
            >Notas para la tienda<textarea
              name="notes"
              [(ngModel)]="notes"
              maxlength="500"
              rows="3"
              placeholder="Algo que debamos saber…"
            ></textarea></label
          ><label class="field"
            >Forma de pago<select name="payment" [(ngModel)]="payment">
              <option value="EFECTIVO">Pagar en tienda</option>
              <option value="PAYPAL">PayPal (Sandbox)</option>
            </select></label
          >
          <div class="summary-row">
            <span>{{ shop.cart().total_items }} prendas</span
            ><strong>{{ shop.cart().total_amount | number: '1.2-2' }} Bs</strong>
          </div>
          @if (invalidStock()) {
            <p class="notice error">
              Alguna prenda supera el stock disponible. Ajusta la cantidad para continuar.
            </p>
          }
          <button
            class="primary"
            type="submit"
            [disabled]="submitting() || shop.busy() || invalidStock() || !!shop.cartError()"
          >
            {{
              submitting()
                ? 'Creando reserva…'
                : payment === 'PAYPAL'
                  ? 'Reservar y continuar a PayPal'
                  : 'Confirmar reserva'
            }}
          </button>
          <p class="muted">
            <small>Tu reserva tendrá un vencimiento que podrás consultar en Mis reservas.</small>
          </p>
        </form>
      </div>
    } @else if (!shop.cartError()) {
      <div class="empty">
        <h2>Tu carrito está esperando tu estilo</h2>
        <p>Agrega una prenda del catálogo para comenzar.</p>
        <a routerLink="/catalog" class="primary">Descubrir prendas</a>
      </div>
    }
  `,
})
export class CarritoTiendaComponent {
  readonly shop = inject(TiendaService);
  readonly destroyRef = inject(DestroyRef);
  readonly submitting = signal(false);
  readonly invalidStock = computed(() =>
    this.shop.cart().items.some((i) => i.quantity > i.available_stock || i.quantity > 50),
  );
  notes = '';
  payment = 'EFECTIVO';
  checkout() {
    if (
      this.submitting() ||
      this.shop.busy() ||
      !this.shop.requireCustomer('/cart') ||
      this.invalidStock() ||
      !this.shop.cart().items.length ||
      this.shop.cartError()
    )
      return;
    this.submitting.set(true);
    this.shop.error.set('');
    const scope = this.shop.scope();
    const payload = {
      branch_id: this.shop.selection()!.branch_id,
      items: this.shop
        .cart()
        .items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
      customer_notes: this.notes.trim(),
      payment_method: this.payment,
    };
    this.shop.http
      .post<Reservation & { sync_status?: string }>(`${this.shop.api}/reservations`, payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        next: (reservation) => {
          if (scope !== this.shop.scope()) return;
          const pending =
            reservation.sync_status === 'PENDING' || reservation.id.startsWith('local-');
          this.shop.message.set(
            pending
              ? 'Reserva guardada en este dispositivo, pendiente de confirmar al recuperar conexión. No la repitas; revisa su estado en Mis reservas.'
              : `Reserva ${reservation.reservation_code} creada. Puedes verla en Mis reservas.`,
          );
          if (pending) this.shop.cart.set({ items: [], total_items: 0, total_amount: 0 });
          else this.shop.refreshCart();
          this.shop.router.navigate(['/my-reservations'], {
            queryParams: this.payment === 'PAYPAL' && !pending ? { pay: reservation.id } : {},
          });
        },
        error: (e) => this.shop.fail(e),
      });
  }
}
