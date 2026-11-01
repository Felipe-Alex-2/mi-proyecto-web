import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TiendaService } from './tienda.service';
import { RecommendationResponse } from '../../nucleo/modelos/recomendacion.model';
import { PrendasTiendaComponent } from './prendas-tienda.component';

@Component({
  selector: 'app-shop-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PrendasTiendaComponent],
  styleUrls: ['./tienda.css', './asistente-tienda.component.css'],
  template: `
    @if (embedded()) {
      <div class="page-heading">
        <div>
          <p class="eyebrow">Un poco de inspiración</p>
          <h1>Para ti.</h1>
          <p class="muted">Cuéntale a Carlitos qué buscas y descubre prendas de tu tienda.</p>
        </div>
      </div>
    }
    @if (embedded() || open()) {
      <section
        [class.floating-chat]="!embedded()"
        [class.panel]="embedded()"
        aria-label="Asistente Carlitos"
      >
        <header class="chat-header">
          <div>
            <strong>Carlitos / tu asistente</strong>
            <p>Estilo, prendas y ayuda para reservar</p>
          </div>
          @if (!embedded()) {
            <button type="button" aria-label="Cerrar asistente" (click)="open.set(false)">×</button>
          }
        </header>
        <div class="chat-body" aria-live="polite">
          <p class="bubble">
            Hola, {{ shop.auth.currentUser()?.full_name?.split(' ')?.[0] || 'bienvenido' }}. ¿Qué te
            gustaría encontrar? Puedo ayudarte con prendas, tallas y el proceso de reserva.
          </p>
          <div class="suggestions">
            @for (suggestion of suggestions; track suggestion) {
              <button
                class="secondary"
                type="button"
                [disabled]="loading()"
                (click)="ask(suggestion)"
              >
                {{ suggestion }}
              </button>
            }
          </div>
          @if (question()) {
            <p class="bubble user">{{ question() }}</p>
          }
          @if (loading()) {
            <p class="bubble" role="status">Buscando opciones para ti…</p>
          }
          @if (error()) {
            <p class="notice error" role="alert">{{ error() }}</p>
          }
          @if (help()) {
            <p class="bubble">{{ help() }}</p>
            <div class="actions">
              <a routerLink="/catalog" class="text-button">Catálogo</a
              ><a routerLink="/my-reservations" class="text-button">Mis reservas</a>
            </div>
          }
          @if (response(); as result) {
            <p class="bubble">{{ result.message }}</p>
            @if (!embedded()) {
              @for (product of result.recommendations; track product.id) {
                <a
                  class="chat-product"
                  routerLink="/catalog"
                  [queryParams]="{ product: product.id }"
                  (click)="open.set(false)"
                  >{{ product.name }} <span>Ver prenda ↗</span></a
                >
              }
            }
          }
        </div>
        <form class="chat-form" (ngSubmit)="ask(text)">
          <label for="assistant-input-{{ embedded() ? 'page' : 'float' }}" class="sr-only"
            >Mensaje para Carlitos</label
          ><input
            id="assistant-input-{{ embedded() ? 'page' : 'float' }}"
            name="message"
            [(ngModel)]="text"
            maxlength="1000"
            placeholder="Busco una camisa para…"
            [disabled]="loading()"
          /><button class="primary" type="submit" [disabled]="loading() || !text.trim()">
            Enviar
          </button>
        </form>
      </section>
      @if (embedded() && response()?.recommendations?.length) {
        <div class="section-space">
          <app-shop-products [products]="response()!.recommendations" />
        </div>
      }
    }
    @if (!embedded()) {
      <button
        class="chat-toggle"
        type="button"
        [attr.aria-expanded]="open()"
        aria-label="Abrir asistente Carlitos"
        (click)="open.set(!open())"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path
            d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H5l-3 2V11.5A8.5 8.5 0 0 1 10.5 3h2a8.5 8.5 0 0 1 8.5 8.5Z"
          />
          <path d="M7 10h10M7 14h6" />
        </svg>
      </button>
    }
  `,
})
export class AsistenteTiendaComponent {
  readonly shop = inject(TiendaService);
  readonly destroyRef = inject(DestroyRef);
  readonly embedded = input(false);
  readonly open = signal(false);
  readonly loading = signal(false);
  readonly question = signal('');
  readonly help = signal('');
  readonly error = signal('');
  readonly response = signal<RecommendationResponse | null>(null);
  readonly suggestions = ['Busco una polera', 'Cómo reservar', 'Mi talla', 'Pagos y recogida'];
  text = '';
  constructor() {
    effect(() => {
      this.shop.scope();
      this.question.set('');
      this.help.set('');
      this.error.set('');
      this.response.set(null);
      this.text = '';
    });
  }
  ask(message: string) {
    if (!message.trim() || this.loading() || !this.shop.requireCustomer('/for-you')) return;
    this.question.set(message.trim());
    this.help.set('');
    this.error.set('');
    this.response.set(null);
    this.text = '';
    const text = message.toLowerCase();
    if (/cómo reservar|como reservar/.test(text)) {
      this.help.set(
        'Elige tu talla y color en el catálogo, agrega las prendas al carrito y confirma tu reserva. Puedes pagar en tienda o continuar con PayPal. En Mis reservas verás el estado, la sucursal y la fecha de vencimiento.',
      );
      return;
    }
    if (/mi talla|vestidor|medidas/.test(text)) {
      this.help.set(
        'En Vestidor virtual guarda tus medidas y elige una prenda para obtener una recomendación de talla. También puedes cargar una foto o usar tu cámara para probarte una prenda.',
      );
      return;
    }
    if (/pagos y recogida|delivery|envío/.test(text)) {
      this.help.set(
        'Tus reservas se recogen en la sucursal seleccionada. Puedes pagar allí o usar PayPal (actualmente en modo de prueba). Consulta el detalle y vencimiento en Mis reservas.',
      );
      return;
    }
    this.loading.set(true);
    const scope = this.shop.scope();
    this.shop.http
      .post<RecommendationResponse>(`${this.shop.api}/recommendations/chat`, {
        message: message.trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loading.set(false);
          if (scope === this.shop.scope()) this.response.set(result);
        },
        error: (e) => {
          this.loading.set(false);
          this.error.set(
            e?.error?.detail || 'No pude consultar las recomendaciones. Intenta de nuevo.',
          );
        },
      });
  }
}
