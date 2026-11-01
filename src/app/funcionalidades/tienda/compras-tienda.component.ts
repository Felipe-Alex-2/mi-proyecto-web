import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TiendaService } from './tienda.service';
interface Purchase {
  id: string;
  payment_code: string;
  company_name: string;
  branch_name: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}
@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  styleUrl: './tienda.css',
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Tu historia con VESTA</p>
        <h1>Mis compras.</h1>
        <p class="muted">
          Tu historial de compras en caja y sus comprobantes, incluso al cambiar de empresa.
        </p>
      </div>
      <a class="secondary" routerLink="/my-reservations">Ver mis reservas</a>
    </div>
    @if (error()) {
      <p class="notice error" role="alert">{{ error() }}</p>
    }
    @if (loading()) {
      <div class="empty" role="status">Cargando tus compras…</div>
    } @else {
      <div class="stack">
        @for (p of rows(); track p.id) {
          <article class="panel">
            <div class="row">
              <div>
                <p class="eyebrow">{{ p.company_name }} · {{ p.branch_name }}</p>
                <h2>{{ p.payment_code }}</h2>
              </div>
              <span class="status">{{
                p.status === 'PAID' ? 'Pagado' : p.status === 'PENDING' ? 'Pendiente' : p.status
              }}</span>
            </div>
            <div class="row section-space">
              <p class="muted">{{ shop.date(p.created_at) | date: 'dd/MM/yyyy HH:mm' }}</p>
              <strong>{{ p.amount | number: '1.2-2' }} {{ p.currency }}</strong>
            </div>
            <button
              class="secondary section-space"
              type="button"
              [disabled]="p.status !== 'PAID' || downloading()"
              (click)="invoice(p)"
            >
              Descargar comprobante PDF
            </button>
          </article>
        } @empty {
          <div class="empty">
            <h2>Tus compras aparecerán aquí</h2>
            <p>Cuando se registre una compra a tu cuenta, podrás consultar su comprobante.</p>
            <a class="primary" routerLink="/catalog">Explorar prendas</a>
          </div>
        }
      </div>
    }
  `,
})
export class ComprasTiendaComponent {
  readonly shop = inject(TiendaService);
  readonly destroyRef = inject(DestroyRef);
  readonly rows = signal<Purchase[]>([]);
  readonly loading = signal(true);
  readonly downloading = signal(false);
  readonly error = signal('');
  constructor() {
    this.shop.http
      .get<Purchase[]>(`${this.shop.api}/saas/history`)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(e?.error?.detail || 'No se pudo cargar tu historial.');
          this.loading.set(false);
        },
      });
  }
  invoice(p: Purchase) {
    if (this.downloading()) return;
    this.downloading.set(true);
    this.shop.http
      .get(`${this.shop.api}/saas/history/${p.id}/invoice`, { responseType: 'blob' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.downloading.set(false);
          const url = URL.createObjectURL(blob),
            link = document.createElement('a');
          link.href = url;
          link.download = `${p.payment_code}.pdf`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: (e) => {
          this.downloading.set(false);
          this.error.set(e?.error?.detail || 'No se pudo descargar el comprobante.');
        },
      });
  }
}
