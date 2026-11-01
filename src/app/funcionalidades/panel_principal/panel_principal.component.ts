import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { PanelService, DashboardSummary } from '../../nucleo/servicios/panel.service';
import { SucursalService } from '../../nucleo/servicios/sucursal.service';
import { Branch } from '../../nucleo/modelos/sucursal.model';
import { SelectorSucursalComponent } from '../../nucleo/componentes/selector-sucursal.component';
import { RouterLink } from '@angular/router';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { AvatarUsuarioComponent } from '../../nucleo/componentes/avatar-usuario.component';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, AvatarUsuarioComponent, SelectorSucursalComponent],
  templateUrl: './panel_principal.component.html',
  styleUrl: './panel_principal.component.css',
})
export class PanelPrincipalComponent implements OnInit {
  readonly authService = inject(AutenticacionService);
  private panel = inject(PanelService);
  private branchService = inject(SucursalService);
  private destroyRef = inject(DestroyRef);
  private request?: Subscription;
  readonly periods = [
    { value: 1, label: 'Este mes' },
    { value: 3, label: '3 meses' },
    { value: 12, label: 'Anual' },
  ];
  months = signal(1);
  branches = signal<Branch[]>([]);
  branchId = '';
  data = signal<DashboardSummary | null>(null);
  loading = signal(false);
  error = signal('');
  branchError = signal('');
  maxSales = computed(() => Math.max(1, ...(this.data()?.series.map((row) => row.sales) || [])));

  ngOnInit(): void {
    this.branchId =
      this.authService.currentUser()?.role === 'ADMIN'
        ? ''
        : this.authService.currentUser()?.branch_id || '';
    this.branchService
      .getBranches()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => this.branches.set(rows),
        error: () =>
          this.branchError.set(
            'No se pudieron cargar las sucursales. Actualiza la página para reintentar.',
          ),
      });
    this.load();
  }
  changePeriod(months: number): void {
    this.months.set(months);
    this.load();
  }
  changeBranch(branch: string): void {
    this.branchId = branch;
    this.load();
  }
  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.data.set(null);
    this.request = this.panel
      .summary(this.months(), this.branchId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.data.set(data);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(
            error?.error?.detail ||
              'No se pudo cargar el resumen. Revisa tu conexión y vuelve a intentar.',
          );
          this.loading.set(false);
        },
      });
  }
  periodLabel(value: string): string {
    const date = new Date(`${value.length === 7 ? value + '-01' : value}T12:00:00`);
    return date.toLocaleDateString(
      'es-BO',
      value.length === 7 ? { month: 'short', year: '2-digit' } : { day: 'numeric' },
    );
  }
}
