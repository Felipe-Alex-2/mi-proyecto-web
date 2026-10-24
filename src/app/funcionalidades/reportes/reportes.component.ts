import { SaasService } from '../../nucleo/servicios/saas.service';
import { Component, DestroyRef, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReportRequest, ReportResponse } from '../../nucleo/modelos/reporte.model';
import { ReporteService } from '../../nucleo/servicios/reporte.service';
import { SelectorSucursalComponent } from '../../nucleo/componentes/selector-sucursal.component';
import { SucursalService } from '../../nucleo/servicios/sucursal.service';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { Branch } from '../../nucleo/modelos/sucursal.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SelectorSucursalComponent],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.css'],
})
export class ReportesComponent implements OnInit, OnDestroy {
  private saas = inject(SaasService);
  aiAvailable = signal(false);
  reportTypes = [
    { value: 'inventory_by_branch', label: 'Stock disponible por sucursal' },
    { value: 'sales_by_branch', label: 'Ventas cobradas por sucursal' },
    { value: 'products_by_category', label: 'Productos por categoría' },
    { value: 'products_by_season', label: 'Productos por temporada' },
    { value: 'low_stock', label: 'Alertas de stock bajo' },
    { value: 'reservations_status', label: 'Estado de reservas' },
    { value: 'reservations_by_branch', label: 'Reservas por sucursal' },
    { value: 'products_by_supplier', label: 'Catálogo por proveedor' },
    { value: 'registered_customers', label: 'Clientes registrados' },
  ];
  reportType = 'inventory_by_branch';
  status = '';
  search = '';
  threshold = 5;
  transcript = '';
  branches = signal<Branch[]>([]);
  branchId = '';
  dateFrom = '';
  dateTo = '';
  readonly labels: Record<string, string> = {
    branch: 'Sucursal', city: 'Ciudad', units: 'Unidades', variants_in_stock: 'Variantes con stock',
    branches: 'Sucursales', total_units: 'Unidades totales', most_stock_branch: 'Mayor inventario',
    sales: 'Cobros realizados', amount: 'Importe cobrado', currency: 'Moneda', scope: 'Sucursal consultada',
    category: 'Categoría', categories: 'Categorías', products: 'Prendas', season: 'Temporada', seasons: 'Temporadas',
    product: 'Prenda', sku: 'SKU', quantity: 'Cantidad', threshold: 'Umbral', alerts: 'Alertas',
    status: 'Estado', reservations: 'Reservas', total: 'Total', supplier: 'Proveedor', suppliers: 'Proveedores',
    product_names: 'Prendas', customer: 'Cliente', customers: 'Clientes', email: 'Correo', registered_at: 'Fecha de registro',
  };
  report = signal<ReportResponse | null>(null);
  loading = signal(false);
  listening = signal(false);
  error = signal('');
  private recognition: any;
  private request?: Subscription;
  private readonly destroyRef = inject(DestroyRef);

  constructor(private reportService: ReporteService, private branchService: SucursalService, public auth: AutenticacionService) {}

  ngOnInit(): void {
    this.saas.subscription().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:sub=>this.aiAvailable.set(sub.ai_reports),error:()=>this.aiAvailable.set(false)});
    this.branchId = this.auth.currentUser()?.role === 'ADMIN' ? '' : this.auth.currentUser()?.branch_id || '';
    this.branchService.getBranches().subscribe({ next: branches => this.branches.set(branches), error: () => this.error.set('No se pudieron cargar las sucursales.') });
  }

  changeBranch(value: string): void {
    this.request?.unsubscribe();
    this.loading.set(false);
    this.branchId = value;
    this.report.set(null);
    this.error.set('');
  }

  label(key: string): string {
    if (key.startsWith('leader_')) return `Mayor venta (${key.substring(7)})`;
    if (key.startsWith('total_') && !this.labels[key]) return `Total (${key.substring(6)})`;
    return this.labels[key] || key;
  }

  generateManual(): void {
    this.request?.unsubscribe();
    this.report.set(null);
    this.loading.set(true);
    this.error.set('');
    const request: ReportRequest = {
      report_type: this.reportType,
      status: this.status || undefined,
      search: this.search.trim() || undefined,
      low_stock_threshold: this.threshold,
      branch_id: this.branchId || undefined,
      date_from: this.reportType === 'sales_by_branch' ? this.dateFrom || undefined : undefined,
      date_to: this.reportType === 'sales_by_branch' ? this.dateTo || undefined : undefined,
    };
    this.request = this.reportService.generate(request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.report.set(response);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.detail || 'No se pudo generar el reporte.');
        this.loading.set(false);
      },
    });
  }

  startVoice(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.error.set('Tu navegador no admite dictado por voz. Usa Chrome o Edge.');
      return;
    }
    this.error.set('');
    this.listening.set(true);
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'es-ES';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
    this.recognition.onresult = (event: any) => {
      this.transcript = event.results[0][0].transcript;
      this.sendVoiceReport();
    };
    this.recognition.onerror = () => {
      this.error.set('No se pudo capturar la voz. Revisa el permiso del micrófono.');
      this.listening.set(false);
    };
    this.recognition.onend = () => this.listening.set(false);
    this.recognition.start();
  }

  stopVoice(): void {
    this.recognition?.stop();
    this.listening.set(false);
  }

  sendVoiceReport(): void {
    if (!this.transcript.trim()) return;
    this.request?.unsubscribe();
    this.report.set(null);
    this.loading.set(true);
    this.error.set('');
    this.request = this.reportService.generateFromVoice(this.transcript.trim(), this.branchId || undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.report.set(response.report);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.detail || 'Gemini no pudo interpretar la consulta.');
        this.loading.set(false);
      },
    });
  }

  exportCsv(): void {
    const current = this.report();
    if (!current) return;
    const lines = [current.columns.map(column => this.csvValue(this.label(column))).join(','), ...current.rows.map((row) => current.columns.map((column) => this.csvValue(row[column])).join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${current.report_type}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  csvValue(value: string | number | null | undefined): string {
    const text = String(value ?? '');
    return `"${(/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  }

  ngOnDestroy(): void {
    this.recognition?.stop();
  }
}
