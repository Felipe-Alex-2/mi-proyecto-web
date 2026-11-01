import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { TiendaService, ShopNotification } from './tienda.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  styleUrl: './tienda.css',
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Al día contigo</p>
        <h1>Notificaciones.</h1>
        <p class="muted">Avisos sobre tus reservas y operaciones.</p>
      </div>
      <button
        class="secondary"
        type="button"
        [disabled]="busy() || !shop.unread()"
        (click)="readAll()"
      >
        Marcar todas como leídas
      </button>
    </div>
    @if (shop.notificationsError()) {
      <p class="notice error" role="alert">{{ shop.notificationsError() }}</p>
    }
    <div class="stack">
      @for (n of shop.notifications(); track n.id) {
        <article class="panel">
          <div class="row">
            <h3>{{ n.title }}</h3>
            @if (!n.is_read) {
              <span class="tag">Nueva</span>
            }
          </div>
          <p class="muted section-space">{{ n.message }}</p>
          <div class="row section-space">
            <small class="muted">{{ shop.date(n.created_at) | date: 'dd/MM/yyyy HH:mm' }}</small>
            <div class="actions">
              @if (n.reservation_id) {
                <a class="text-button" routerLink="/my-reservations">Ver mis reservas</a>
              }
              @if (!n.is_read) {
                <button class="text-button" type="button" [disabled]="busy()" (click)="read(n)">
                  Marcar como leída
                </button>
              }
            </div>
          </div>
        </article>
      } @empty {
        <div class="empty">
          <h2>Todo tranquilo por aquí</h2>
          <p>Tus nuevos avisos aparecerán en este espacio.</p>
        </div>
      }
    </div>
  `,
})
export class NotificacionesTiendaComponent {
  readonly shop = inject(TiendaService);
  readonly destroyRef = inject(DestroyRef);
  readonly busy = signal(false);
  read(n: ShopNotification) {
    this.mark(`${this.shop.api}/notifications/${n.id}/read`, n.id);
  }
  readAll() {
    this.mark(`${this.shop.api}/notifications/read-all`);
  }
  private mark(url: string, id?: string) {
    if (this.busy()) return;
    this.busy.set(true);
    const scope = this.shop.scope();
    this.shop.http
      .patch(url, {})
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          if (scope === this.shop.scope())
            this.shop.notifications.update((rows) =>
              rows.map((n) => (!id || n.id === id ? { ...n, is_read: true } : n)),
            );
        },
        error: (e) => this.shop.fail(e),
      });
  }
}
