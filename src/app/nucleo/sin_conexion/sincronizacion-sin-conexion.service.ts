import { Injectable, inject, signal, isDevMode } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AlmacenSinConexion } from './almacen-sin-conexion.service';
import { ContextoSesion } from '../servicios/contexto-sesion.service';

@Injectable({ providedIn: 'root' })
export class SincronizacionSinConexion {
  private readonly session = inject(ContextoSesion);
  readonly store = inject(AlmacenSinConexion);
  private http = inject(HttpClient);
  readonly syncing = signal(false);
  readonly shellReady = signal(false);
  readonly installPrompt = signal<any>(null);
  async install() {
    const prompt = this.installPrompt();
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      this.installPrompt.set(null);
    }
  }
  private started = false;
  start(): void {
    if (this.started) return;
    this.started = true;
    if (!isDevMode() && 'serviceWorker' in navigator)
      void navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then(() => navigator.serviceWorker.ready)
        .then(() => this.shellReady.set(true))
        .catch(() =>
          this.store.message.set('No se pudo instalar la copia offline de la aplicación.'),
        );
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.installPrompt.set(event);
    });
    const refresh = () => void this.store.refresh().catch(() => {});
    window.addEventListener('online', () => {
      this.store.setOnline(true);
      void this.sync();
    });
    window.addEventListener('offline', () => this.store.setOnline(false));
    window.addEventListener('storage', () => {
      this.store.operations.set([]);
      refresh();
    });
    window.addEventListener('vesta-session-changed', () => {
      this.store.operations.set([]);
      refresh();
    });
    window.addEventListener('focus', () => {
      refresh();
      void this.sync();
    });
    setInterval(() => {
      refresh();
      void this.sync();
    }, 10000);
    refresh();
    void this.sync();
  }
  async sync(): Promise<void> {
    if (this.syncing() || !navigator.onLine || !this.store.owner) return;
    const run = async () => {
      if (this.syncing()) return;
      this.syncing.set(true);
      try {
        await this.store.refresh();
        if (!this.store.online()) {
          try {
            await firstValueFrom(
              this.http.get(environment.apiUrl + '/sync/status').pipe(timeout(15000)),
            );
            this.store.setOnline(true);
          } catch {
            return;
          }
        }
        const owner = this.store.owner;
        for (const row of this.store.operations().filter((row) => row.state === 'PENDING')) {
          if (this.store.owner !== owner) break;
          try {
            const result = await firstValueFrom(
              this.http
                .post(
                  environment.apiUrl + '/sync/operations',
                  {
                    operation_id: row.id,
                    account_id: owner,
                    tenant_id: row.tenant_id,
                    branch_id: row.branch_id,
                    method: row.method,
                    path: row.path,
                    body: await this.store.commandBody(row),
                  },
                  { headers: { 'X-Vesta-Tenant': row.tenant_id, 'X-Vesta-Branch': row.branch_id } },
                )
                .pipe(timeout(15000)),
            );
            try {
              await this.store.update({
                ...row,
                state: 'SYNCED',
                attempts: row.attempts + 1,
                result,
                conflict: undefined,
                message: 'Confirmada por el servidor.',
              });
            } catch {
              this.store.message.set(
                'El servidor confirmó la operación. Se verificará su copia local sin repetir el cobro.',
              );
              break;
            }
            this.store.setOnline(true);
          } catch (error: any) {
            if (error.status > 0) this.store.setOnline(true);
            const transient =
              error.status === 0 ||
              error.status >= 500 ||
              error.status === 429 ||
              error.status === 401 || error.status === 424 ||
              error.name === 'TimeoutError';
            await this.store.update({
              ...row,
              state: transient ? 'PENDING' : 'CONFLICT',
              attempts: row.attempts + 1,
              conflict: !transient && typeof error.error?.detail === 'object' ? error.error.detail : undefined,
              message:
                typeof error.error?.detail === 'string'
                  ? error.error.detail
                  : typeof error.error?.detail?.message === 'string'
                    ? error.error.detail.message
                  : transient
                    ? 'No se pudo conectar. Se reintentará sin duplicar.'
                    : 'Operación rechazada. Revisa los datos y el inventario.',
            });
            if (transient && error.status !== 424) {
              if (error.status === 0 || error.name === 'TimeoutError') this.store.setOnline(false);
              break;
            }
          }
        }
      } catch {
        this.store.message.set(
          'No se pudo acceder a la cola local. Comprueba el almacenamiento del navegador.',
        );
      } finally {
        this.syncing.set(false);
      }
    };
    // Coordinate windows sharing the same queue; web and PWA have separate queues.
    if (navigator.locks)
      await navigator.locks.request(this.session.key('vesta-sync'), { ifAvailable: true }, async (lock) => {
        if (lock) await run();
      });
    else await run();
  }
}
