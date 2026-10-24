import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlmacenSinConexion } from './almacen-sin-conexion.service';
import { SincronizacionSinConexion } from './sincronizacion-sin-conexion.service';
@Component({
  selector: 'app-offline-banner',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (!store.online() || pending() || conflicts()) {
    <aside [class.offline]="!store.online()" aria-live="polite">
      <span
        >{{store.online() ? 'Online · Sincronización' : '◌ Modo offline'}} · {{ pending() }} pendiente(s)
        @if (conflicts()) {
          · {{ conflicts() }} conflicto(s)
        }</span
      ><a routerLink="/profile" fragment="pending">Ver pendientes en mi perfil</a>
      @if (!store.online() && sync.shellReady()) {
        <span>✓ Aplicación preparada sin conexión</span>
      }
      @if (sync.installPrompt()) {
        <button (click)="sync.install()">Instalar VESTA</button>
      }
    </aside>
    }
    @if (store.message()) {
      <p class="message" role="status">{{ store.message() }}</p>
    }
  `,
  styles: [
    `
      aside {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 16px;
        padding: 9px 24px;
        background: #edf3eb;
        color: #3e5c47;
        font-size: 0.78rem;
        border-bottom: 1px solid #dfded4;
      }
      aside.offline {
        background: #f4e8ca;
        color: #6c5731;
      }
      a {
        color: inherit;
        text-decoration: underline;
      }
      button {
        border: 1px solid currentColor;
        border-radius: 8px;
        background: transparent;
        color: inherit;
        padding: 5px 12px;
        cursor: pointer;
      }
      .message {
        font-size: 0.76rem;
        color: #786a5f;
        background: #faf7f2;
        padding: 8px 24px;
        margin: 0;
      }
    `,
  ],
})
export class AvisoSinConexionComponent {
  store = inject(AlmacenSinConexion);
  sync = inject(SincronizacionSinConexion);
  pending = computed(() => this.store.operations().filter((row) => row.state === 'PENDING').length);
  conflicts = computed(
    () => this.store.operations().filter((row) => row.state === 'CONFLICT').length,
  );
}
