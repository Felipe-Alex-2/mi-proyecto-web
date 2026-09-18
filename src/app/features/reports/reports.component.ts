import { Component, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReportRequest, ReportResponse } from '../../core/models/report.model';
import { ReportService } from '../../core/services/report.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css'],
})
export class ReportsComponent implements OnDestroy {
  reportTypes = [
    { value: 'inventory_by_branch', label: 'Stock disponible por sucursal' },
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
  report = signal<ReportResponse | null>(null);
  loading = signal(false);
  listening = signal(false);
  error = signal('');
  private recognition: any;

  constructor(private reportService: ReportService) {}

  generateManual(): void {
    this.loading.set(true);
    this.error.set('');
    const request: ReportRequest = {
      report_type: this.reportType,
      status: this.status || undefined,
      search: this.search.trim() || undefined,
      low_stock_threshold: this.threshold,
    };
    this.reportService.generate(request).subscribe({
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
    this.loading.set(true);
    this.error.set('');
    this.reportService.generateFromVoice(this.transcript.trim()).subscribe({
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
    const lines = [current.columns.join(','), ...current.rows.map((row) => current.columns.map((column) => this.csvValue(row[column])).join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${current.report_type}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  csvValue(value: string | number | null | undefined): string {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  ngOnDestroy(): void {
    this.recognition?.stop();
  }
}
