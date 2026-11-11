import { SaasService } from '../../nucleo/servicios/saas.service';
import { Component, DestroyRef, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReportRequest, ReportResponse } from '../../nucleo/modelos/reporte.model';
import { ReporteService } from '../../nucleo/servicios/reporte.service';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { Branch } from '../../nucleo/modelos/sucursal.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.css'],
})
export class ReportesComponent implements OnInit, OnDestroy {
  private saas = inject(SaasService);
  aiAvailable = signal(false);
  reportTypes = [
    {value:'products_detail',label:'Detalle de prendas en stock'},
    {value:'companies_list',label:'Empresas existentes'},
    {value:'branches_list',label:'Sucursales de todas las empresas'},
    {value:'payments_detail',label:'Detalle de pagos'},
    {value:'wallet_topups',label:'Recargas de wallet'},
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
  allCompanies = true;
  emailTo = '';
  sendingEmail = signal(false);
  speaking = signal(false);
  get platform() {return !!this.auth.currentUser()?.is_saas_admin;}
  changeScope() {this.changeBranch('');if(!this.allCompanies&&this.reportType==='sales_by_company')this.reportType='sales_by_branch';}
  readReport() {
    const current=this.report();if(!current)return;
    if(!('speechSynthesis' in window)){this.error.set('Este navegador no permite lectura de voz.');return;}
    window.speechSynthesis.cancel();
    const text=current.narration||current.title+'. '+Object.entries(current.summary).map(([k,v])=>this.label(k)+': '+v).join('. ');
    const speech=new SpeechSynthesisUtterance(text);speech.lang='es-ES';
    speech.onend=()=>this.speaking.set(false);speech.onerror=()=>{this.speaking.set(false);this.error.set('No se pudo leer el reporte en voz alta.');};
    this.speaking.set(true);window.speechSynthesis.speak(speech);
  }
  stopReading() {if('speechSynthesis' in window)window.speechSynthesis.cancel();this.speaking.set(false);}
  sendPdf() {
    const id=this.report()?.report_id;if(!id||!this.emailTo.trim()||this.sendingEmail())return;
    this.sendingEmail.set(true);
    this.reportService.email(id,this.emailTo.trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:r=>{this.report.set(r);this.sendingEmail.set(false);},error:e=>{this.error.set(e.error?.detail||'No se pudo enviar el PDF.');this.sendingEmail.set(false);}});
  }
  downloadPdf() {const current=this.report();if(!current?.report_id)return;this.reportService.pdf(current.report_id).subscribe({next:blob=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='reporte-vesta.pdf';a.click();URL.revokeObjectURL(url);},error:()=>this.error.set('No se pudo descargar el PDF.')});}
  reportType = 'inventory_by_branch';
  status = '';
  search = '';
  threshold = 5;
  transcript = '';
  branches = signal<(Branch & {company_name?:string})[]>([]);
  branchId = '';
  dateFrom = '';
  dateTo = '';
  readonly labels: Record<string, string> = {
    interpretation_source:'Interpretación',unit_price:'Precio unitario neto',current_value:'Valor de venta del stock',day:'Día',week:'Semana',month:'Mes',year:'Año',movement_type:'Tipo de movimiento',previous_stock:'Stock anterior',new_stock:'Stock nuevo',reason:'Motivo',courier:'Repartidor',fee:'Envío cotizado (USD)',distance_km:'Distancia (km)',estimated_minutes:'Minutos estimados',points:'Puntos',description:'Descripción',role:'Rol',active:'Activo',estimated_amount:'Importe estimado',payment_status:'Estado de pago',reservation_code:'Código de reserva',created_at:'Fecha de registro',unitemized_sales:'Cobros sin detalle de prendas',unpriced_sales:'Ventas sin desglose histórico de importes',records_shown:'Filas mostradas',limit_scope:'Límite aplicado',
    comparison_sales:'Cobros de todo el ámbito',comparison_units:'Unidades de todo el ámbito',least_stock_branch:'Menor inventario',period:'Periodo consultado',ranking_criterion:'Criterio de comparación',matching_records:'Registros encontrados',company:'Empresa',companies:'Empresas',records:'Registros', branch: 'Sucursal', city: 'Ciudad', units: 'Unidades', variants_in_stock: 'Variantes con stock',
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

  constructor(private reportService: ReporteService, public auth: AutenticacionService) {}

  ngOnInit(): void {
    this.emailTo = this.auth.currentUser()?.email || '';
    this.saas.subscription().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:sub=>this.aiAvailable.set(sub.ai_reports||this.platform),error:()=>this.aiAvailable.set(this.platform)});
    this.allCompanies=true;
    this.reportTypes.push({value:'sales_by_company',label:'Ventas cobradas por empresa'});
    this.branchId = '';
    this.reportService.branches().subscribe({ next: branches => this.branches.set(branches), error: () => this.error.set('No se pudieron cargar las sucursales.') });
  }

  changeBranch(value: string): void {
    this.stopReading();
    this.request?.unsubscribe();
    this.loading.set(false);
    this.branchId = value;
    this.report.set(null);
    this.error.set('');
  }

  label(key: string): string {
    if (this.labels[key]) return this.labels[key];
    const operations:Record<string,string>={sum_:'Total de ',avg_:'Promedio de ',count_:'Cantidad de ',distinct_:'Valores distintos de ',min_:'Mínimo de ',max_:'Máximo de '};
    for(const [prefix,title] of Object.entries(operations)){if(key.startsWith(prefix))return title+this.label(key.substring(prefix.length));}
    if (key.startsWith('comparison_total_')) return `Total de todo el ámbito (${key.substring(17)})`;
    if (key.startsWith('lowest_')) return `Menor venta (${key.substring(7)})`;
    if (key.startsWith('leader_')) return `Mayor venta (${key.substring(7)})`;
    if (key.startsWith('total_') && !this.labels[key]) return `Total (${key.substring(6)})`;
    return this.labels[key] || key;
  }

  generateManual(): void {
    this.stopReading();
    this.request?.unsubscribe();
    this.report.set(null);
    this.loading.set(true);
    this.error.set('');
    const request: ReportRequest = {
      report_type: this.reportType,
      all_companies:this.allCompanies,
      email_to:this.emailTo.trim()||undefined,
      status: this.status || undefined,
      search: this.search.trim() || undefined,
      low_stock_threshold: this.threshold,
      branch_id: this.branchId || undefined,
      date_from: ['sales_by_branch','sales_by_company'].includes(this.reportType) ? this.dateFrom || undefined : undefined,
      date_to: ['sales_by_branch','sales_by_company'].includes(this.reportType) ? this.dateTo || undefined : undefined,
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
    this.stopReading();
    if (!this.transcript.trim()) return;
    this.request?.unsubscribe();
    this.report.set(null);
    this.loading.set(true);
    this.error.set('');
    this.request = this.reportService.generateFromVoice(this.transcript.trim(), this.branchId || undefined, this.allCompanies,this.emailTo.trim()||undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    this.stopReading();
    this.recognition?.stop();
  }
}
