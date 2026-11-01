import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, Subscription, timer } from 'rxjs';
import {
  AnaliticaService,
  ModelRun,
  SyntheticDataset,
} from '../../nucleo/servicios/analitica.service';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { CompanySubscription, SaasService } from '../../nucleo/servicios/saas.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './modelos.component.html',
  styleUrl: './modelos.component.css',
})
export class ModelosComponent implements OnInit {
  readonly auth = inject(AutenticacionService);
  private api = inject(AnaliticaService);
  private saas = inject(SaasService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  readonly platform = !!this.auth.currentUser()?.is_saas_admin;
  tenantId = '';
  companies = signal<CompanySubscription[]>([]);
  datasets = signal<SyntheticDataset[]>([]);
  runs = signal<ModelRun[]>([]);
  selected = signal<ModelRun | null>(null);
  datasetId = '';
  clusters = 3;
  loading = signal(false);
  training = signal(false);
  downloading = signal(false);
  detailLoading = signal(false);
  error = signal('');
  detailError = signal('');
  success = signal('');
  private loadRequest?: Subscription;
  private detailRequest?: Subscription;
  private trainRequest?: Subscription;
  private attempt: { request_id: string; dataset_id: string; clusters: number } | null = null;

  ngOnInit() {
    if (this.platform)
      this.saas
        .companies()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (rows) => this.companies.set(rows),
          error: () => this.error.set('No se pudo cargar la lista de empresas.'),
        });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.loadRequest?.unsubscribe();
      this.detailRequest?.unsubscribe();
      this.trainRequest?.unsubscribe();
      this.tenantId = params.get('tenant_id') || this.auth.currentUser()?.tenant_id || '';
      this.datasetId = '';
      this.datasets.set([]);
      this.runs.set([]);
      this.selected.set(null);
      this.attempt = null;
      this.training.set(false);
      this.detailLoading.set(false);
      this.detailError.set('');
      this.success.set('');
      this.load();
    });
    timer(5000, 5000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.training() && this.runs().some((row) => row.status === 'TRAINING'))
          this.load(true);
      });
  }
  changeCompany(id: string) {
    if (!this.training())
      this.router.navigate([], { relativeTo: this.route, queryParams: { tenant_id: id } });
  }
  companyName() {
    return (
      this.companies().find((row) => row.id === this.tenantId)?.name ||
      this.auth.currentUser()?.company_name ||
      'Tu empresa'
    );
  }
  dataset() {
    return this.datasets().find((row) => row.id === this.datasetId);
  }
  datasetName(id: string) {
    return this.datasets().find((row) => row.id === id)?.name || id.slice(0, 8);
  }
  load(quiet = false) {
    this.loadRequest?.unsubscribe();
    if (!quiet) this.loading.set(true);
    if (!quiet) this.error.set('');
    this.loadRequest = forkJoin({
      datasets: this.api.datasets(this.tenantId),
      runs: this.api.runs(this.tenantId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.datasets.set(data.datasets);
          this.runs.set(data.runs);
          this.loading.set(false);
          if (!this.datasetId || !data.datasets.some((row) => row.id === this.datasetId))
            this.datasetId = data.datasets[0]?.id || '';
          const selectedId = this.selected()?.id;
          const row = data.runs.find((row) => row.id === selectedId) || data.runs[0];
          if (row) this.openRun(row);
        },
        error: (error) => {
          this.loading.set(false);
          this.error.set(
            error?.error?.detail ||
              'No se pudo cargar la información. Revisa tu conexión y pulsa Actualizar.',
          );
        },
      });
  }
  train() {
    if (this.training()) return;
    this.error.set('');
    this.success.set('');
    if (
      !this.dataset() ||
      !Number.isInteger(this.clusters) ||
      this.clusters < 2 ||
      this.clusters > 6
    ) {
      this.error.set('Selecciona un conjunto y entre 2 y 6 grupos de clientes.');
      return;
    }
    if (
      !this.attempt ||
      this.attempt.dataset_id !== this.datasetId ||
      this.attempt.clusters !== this.clusters
    ) {
      this.attempt = {
        request_id: crypto.randomUUID(),
        dataset_id: this.datasetId,
        clusters: this.clusters,
      };
    }
    this.training.set(true);
    this.trainRequest = this.api
      .train(this.tenantId, this.attempt)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (row) => {
          this.training.set(false);
          this.selected.set(row);
          this.success.set(
            row.status === 'COMPLETED'
              ? 'Modelos entrenados, evaluados y guardados.'
              : row.status === 'TRAINING'
                ? 'Entrenamiento en curso. El historial se actualizará automáticamente.'
                : 'La ejecución finalizó con un error. Revisa el historial.',
          );
          if (row.status !== 'TRAINING') this.attempt = null;
          this.load();
        },
        error: (error) => {
          this.training.set(false);
          this.error.set(
            error?.error?.detail ||
              'No se pudo confirmar el resultado. Actualiza el historial; el proceso puede seguir en el servidor. Reintentar los mismos parámetros conserva la solicitud.',
          );
          this.load(true);
        },
      });
  }
  openRun(row: ModelRun) {
    this.detailRequest?.unsubscribe();
    this.selected.set(row);
    this.detailError.set('');
    this.detailLoading.set(true);
    this.detailRequest = this.api
      .detail(row.id, this.tenantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.selected.set(detail);
          this.detailLoading.set(false);
        },
        error: (error) => {
          this.detailError.set(
            error?.error?.detail ||
              'No se pudo cargar el resultado. Selecciona de nuevo la ejecución.',
          );
          this.detailLoading.set(false);
        },
      });
  }
  download() {
    if (!this.datasetId || this.downloading()) return;
    this.downloading.set(true);
    this.error.set('');
    const datasetId = this.datasetId;
    this.api
      .download(datasetId, this.tenantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob),
            anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `vesta-sinteticos-${datasetId}.json`;
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          this.downloading.set(false);
        },
        error: () => {
          this.downloading.set(false);
          this.error.set('No se pudo descargar el conjunto. Vuelve a intentar con conexión.');
        },
      });
  }
  status(value: string) {
    return (
      (
        { COMPLETED: 'Completado', TRAINING: 'Entrenando', FAILED: 'Fallido' } as Record<
          string,
          string
        >
      )[value] || value
    );
  }
  metric(value: number | null | undefined) {
    return value == null
      ? 'No disponible'
      : value.toLocaleString('es-BO', { maximumFractionDigits: 3 });
  }
}
