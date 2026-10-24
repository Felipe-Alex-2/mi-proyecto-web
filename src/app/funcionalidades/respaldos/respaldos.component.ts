import { Component, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { SaasService, CompanySubscription } from '../../nucleo/servicios/saas.service';
import { environment } from '../../../environments/environment';
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './respaldos.component.html',
  styleUrl: './respaldos.component.css',
})
export class RespaldosComponent {
  readonly auth = inject(AutenticacionService);
  private http = inject(HttpClient);
  private saas = inject(SaasService);
  private destroy = inject(DestroyRef);
  companies = signal<CompanySubscription[]>([]);
  backups = signal<any[]>([]);
  busy = signal(false);
  error = signal('');
  success = signal('');
  companyId = '';
  selectedFile = signal<File | null>(null);
  review = signal<any>(null);
  dragging = signal(false);
  private selectionVersion = 0;
  readonly tableLabels: Record<string, string> = {
    branches: 'Sucursales', categories: 'Categorías', sizes: 'Tallas', colors: 'Colores', seasons: 'Temporadas',
    suppliers: 'Proveedores', promotions: 'Promociones', products: 'Prendas', product_variants: 'Variantes de prendas',
    stocks: 'Stock por sucursal', inventory_movements: 'Movimientos', reservations: 'Reservas', reservation_items: 'Detalle de reservas',
    payments: 'Pagos', cart_items: 'Carritos', activity_logs: 'Bitácora', size_guides: 'Guías de tallas',
    users: 'Datos básicos de cuentas', tenants: 'Datos de la empresa', saas_plans: 'Plan', saas_subscriptions: 'Suscripción',
    saas_subscription_payments: 'Pagos de suscripción', saas_customer_companies: 'Relaciones de clientes',
  };
  changeCompany() {
    this.selectionVersion++;
    this.selectedFile.set(null);
    this.review.set(null);
    this.success.set('');
    void this.load();
  }
  drop(event: DragEvent) {
    event.preventDefault(); this.dragging.set(false);
    if (!this.busy() && event.dataTransfer?.files.length === 1) void this.inspectFile(event.dataTransfer.files[0]);
  }
  chooseFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) void this.inspectFile(input.files[0]);
    input.value = '';
  }
  async inspectFile(file: File) {
    if (this.busy()) return;
    this.review.set(null); this.selectedFile.set(null); this.error.set(''); this.success.set('');
    if (file.size > 32 * 1024 * 1024 || !/\.json(?:\.gz)?$/i.test(file.name)) {
      this.error.set('Selecciona un respaldo .json de VESTA (máximo 32 MB). También se admiten copias anteriores .json.gz.'); return;
    }
    const version = ++this.selectionVersion, company = this.companyId;
    this.selectedFile.set(file); this.busy.set(true);
    try {
      const result = await firstValueFrom(this.http.post<any>(environment.apiUrl + '/backups/preview', file, { params: { tenant_id: company } }));
      if (version === this.selectionVersion && company === this.companyId) this.review.set(result);
    } catch (error: any) {
      if (version === this.selectionVersion) this.error.set(typeof error.error?.detail === 'string' ? error.error.detail : 'No se pudo analizar el respaldo. Comprueba la conexión y el archivo.');
    } finally { this.busy.set(false); }
  }
  async restore() {
    const file = this.selectedFile(), review = this.review();
    if (this.busy() || !file || !review?.review_token || !review.missing || review.company_id !== this.companyId) return;
    this.busy.set(true); this.error.set(''); this.success.set('');
    try {
      const result = await firstValueFrom(this.http.post<any>(environment.apiUrl + '/backups/restore', file, {
        params: { tenant_id: this.companyId }, headers: { 'X-Vesta-Backup-Review': review.review_token },
      }));
      this.success.set(`Recuperación completada: ${result.restored} registros añadidos. Los datos que ya existían se conservaron.`);
      this.review.set(null); this.selectedFile.set(null);
    } catch (error: any) {
      this.review.set(null);
      this.error.set(typeof error.error?.detail === 'string' ? error.error.detail : 'No se pudo restaurar. Analiza el archivo de nuevo antes de reintentar.');
    } finally { this.busy.set(false); }
  }
  constructor() {
    this.companyId = this.auth.currentUser()?.tenant_id || '';
    void this.load();
    if (this.auth.currentUser()?.is_saas_admin)
      this.saas
        .companies()
        .subscribe({ next: (rows) => this.companies.set(rows), error: () => {} });
    const timer = setInterval(() => void this.load(false), 60000);
    this.destroy.onDestroy(() => clearInterval(timer));
  }
  private url() {
    return environment.apiUrl + '/backups?tenant_id=' + encodeURIComponent(this.companyId);
  }
  async load(clear = true) {
    if (!this.companyId) return;
    if (clear) {
      this.error.set('');
      this.backups.set([]);
    }
    const company = this.companyId;
    try {
      const result: any = await firstValueFrom(this.http.get(this.url()));
      if (company === this.companyId) this.backups.set(result.backups);
    } catch (error: any) {
      if (clear)
        this.error.set(error.error?.detail || 'Los respaldos del servidor necesitan conexión.');
    }
  }
  async create() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    try {
      const row: any = await firstValueFrom(this.http.post(this.url(), {}));
      await this.downloadFile(row);
      this.success.set('Copia creada en el servidor y descarga JSON preparada.');
      await this.load(false);
    } catch (error: any) {
      this.error.set(error.error?.detail || 'No se pudo crear la copia de seguridad.');
    } finally {
      this.busy.set(false);
    }
  }
  async download(row: any) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.downloadFile(row);
    } catch {
      this.error.set('No se pudo descargar o verificar el respaldo.');
    } finally {
      this.busy.set(false);
    }
  }
  private async downloadFile(row: any) {
      const file = await firstValueFrom(
        this.http.get(environment.apiUrl + '/backups/' + row.id + '/download', {
          params: { tenant_id: this.companyId },
          responseType: 'blob',
        }),
      );
      const url = URL.createObjectURL(file),
        link = document.createElement('a');
      link.href = url;
      link.download = 'vesta-backup-' + row.created_at.slice(0, 10) + '-' + row.id + '.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
