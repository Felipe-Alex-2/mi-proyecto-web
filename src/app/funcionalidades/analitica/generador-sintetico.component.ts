import { Component, DestroyRef, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AnaliticaService, SyntheticDataset } from '../../nucleo/servicios/analitica.service';
import { DialogoTiendaDirective } from '../tienda/dialogo-tienda.directive';

@Component({
  selector: 'app-synthetic-generator',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DialogoTiendaDirective],
  template: ` <div class="generator-backdrop" (keydown.escape)="close()" (click)="close()">
    <section
      class="generator"
      role="dialog"
      aria-modal="true"
      aria-labelledby="generator-title"
      appShopDialog
      (click)="$event.stopPropagation()"
    >
      <header>
        <div>
          <p class="eyebrow">DATOS PARA APRENDER</p>
          <h2 id="generator-title">Generar datos sintéticos</h2>
          <p>{{ company.name }}</p>
        </div>
        <button type="button" class="secondary" (click)="close()" [disabled]="busy()">
          Cerrar
        </button>
      </header>
      <p class="notice">
        Esta simulación se guarda en un conjunto independiente de esta empresa. No genera ventas
        reales, cuentas, cobros ni movimientos de stock.
      </p>
      @if (error()) {
        <div class="error" role="alert">{{ error() }}</div>
      }
      @if (result(); as data) {
        <div class="success" role="status">
          <strong>Conjunto preparado para entrenar</strong>
          <p>
            {{ data.name }} · {{ data.summary.sales | number }} ventas ·
            {{ data.summary.returns | number }} devoluciones
          </p>
        </div>
        <p>
          {{ data.summary.customers }} clientes · {{ data.summary.products }} prendas ·
          {{ data.summary.injected_anomalies }} anomalías insertadas.
        </p>
        <p class="helper">{{ data.summary.preprocessing }}</p>
        <a
          class="primary-link"
          routerLink="/models"
          [queryParams]="{ tenant_id: company.id }"
          (click)="closed.emit()"
          >Ir a Modelos y entrenamiento →</a
        >
      } @else {
        <form [formGroup]="form" (ngSubmit)="generate()" novalidate>
          <fieldset [disabled]="busy()">
            <div class="fields">
              <label class="wide"
                >Nombre del conjunto<input formControlName="name" maxlength="120"
              /></label>
              <label>Desde<input type="date" formControlName="date_from" /></label
              ><label>Hasta<input type="date" formControlName="date_to" /></label>
              <label
                >Clientes<input
                  type="number"
                  formControlName="customers"
                  min="20"
                  max="2000"
                  step="1"
              /></label>
              <label
                >Prendas<input type="number" formControlName="products" min="10" max="200" step="1"
              /></label>
              <label
                >Ventas<input type="number" formControlName="sales" min="500" max="20000" step="1"
              /></label>
              <label
                >Semilla reproducible<input
                  type="number"
                  formControlName="seed"
                  min="0"
                  max="2147483647"
                  step="1"
              /></label>
            </div>
          </fieldset>
          <p class="helper">
            Periodo de 90 a 731 días. Incluye estacionalidad, fines de semana, Black Friday, Navidad
            y clientes con distintas frecuencias de compra. Las categorías son simuladas; se usan
            hasta 5 sucursales de la empresa, o 2 ficticias si aún no tiene sucursales.
          </p>
          @if (form.invalid && form.touched) {
            <p class="error" role="alert">
              Revisa las fechas, el nombre y los límites de cada cantidad. Utiliza números enteros.
            </p>
          }
          @if (busy()) {
            <p role="status" class="helper">
              Generando y preparando variables… Mantén esta ventana abierta.
            </p>
          }
          <footer>
            <button type="button" class="secondary" (click)="close()" [disabled]="busy()">
              Cancelar</button
            ><button type="submit" [disabled]="busy()">
              {{ busy() ? 'Generando…' : 'Generar conjunto' }}
            </button>
          </footer>
        </form>
      }
    </section>
  </div>`,
  styleUrl: './generador-sintetico.component.css',
})
export class GeneradorSinteticoComponent {
  @Input({ required: true }) company!: { id: string; name: string };
  @Output() closed = new EventEmitter<void>();
  private api = inject(AnaliticaService);
  private destroyRef = inject(DestroyRef);
  private fb = inject(FormBuilder);
  private requestId = crypto.randomUUID();
  busy = signal(false);
  error = signal('');
  result = signal<SyntheticDataset | null>(null);
  private today = new Date();
  private end = new Date(this.today.getFullYear(), this.today.getMonth(), 0);
  private start = new Date(this.end.getFullYear() - 1, this.end.getMonth(), this.end.getDate() + 1);
  private iso(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  private integer(min: number, max: number) {
    return [
      Validators.required,
      Validators.min(min),
      Validators.max(max),
      Validators.pattern(/^\d+$/),
    ];
  }
  form = this.fb.nonNullable.group({
    name: [
      'Simulación comercial',
      [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    ],
    date_from: [this.iso(this.start), Validators.required],
    date_to: [this.iso(this.end), Validators.required],
    customers: [200, this.integer(20, 2000)],
    products: [50, this.integer(10, 200)],
    sales: [5000, this.integer(500, 20000)],
    seed: [42, this.integer(0, 2147483647)],
  });
  close() {
    if (!this.busy()) this.closed.emit();
  }
  generate() {
    if (this.busy() || this.result()) return;
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const days = (Date.parse(value.date_to) - Date.parse(value.date_from)) / 86400000;
    if (!Number.isFinite(days) || days < 89 || days > 730) {
      this.error.set('El periodo debe tener entre 90 y 731 días.');
      return;
    }
    this.busy.set(true);
    this.api
      .generate(this.company.id, { ...value, request_id: this.requestId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (row) => {
          this.result.set(row);
          this.busy.set(false);
        },
        error: (error) => {
          this.error.set(
            error?.error?.detail ||
              'No se pudo confirmar la generación. Reintenta con los mismos parámetros; no se duplicará la solicitud.',
          );
          this.busy.set(false);
        },
      });
  }
}
