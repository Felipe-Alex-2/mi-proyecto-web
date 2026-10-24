import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ActivityLog } from '../../nucleo/modelos/bitacora.model';
import { BitacoraService } from '../../nucleo/servicios/bitacora.service';
import { SelectorSucursalComponent } from '../../nucleo/componentes/selector-sucursal.component';
import { SucursalService } from '../../nucleo/servicios/sucursal.service';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { Branch } from '../../nucleo/modelos/sucursal.model';

@Component({
  selector: 'app-activity-log',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SelectorSucursalComponent],
  templateUrl: './bitacora.component.html',
  styleUrls: ['./bitacora.component.css'],
})
export class BitacoraComponent implements OnInit {
  logs = signal<ActivityLog[]>([]);
  total = signal(0);
  loading = signal(true);
  error = signal('');
  page = 1;
  pageSize = 25;
  action = '';
  category = '';
  search = '';
  branches = signal<Branch[]>([]);
  branchId = '';
  private request?: Subscription;
  private readonly destroyRef = inject(DestroyRef);

  constructor(private activityLogService: BitacoraService, private branchService: SucursalService, public auth: AutenticacionService) {}

  ngOnInit(): void {
    this.branchId = this.auth.currentUser()?.role === 'ADMIN' ? '' : this.auth.currentUser()?.branch_id || '';
    this.branchService.getBranches().subscribe({ next: branches => this.branches.set(branches), error: () => this.error.set('No se pudieron cargar las sucursales.') });
    this.loadLogs();
  }

  loadLogs(): void {
    this.request?.unsubscribe();
    this.logs.set([]);
    this.loading.set(true);
    this.error.set('');
    this.request = this.activityLogService.list({
      page: this.page,
      pageSize: this.pageSize,
      action: this.action,
      category: this.category,
      search: this.search.trim(),
      branchId: this.branchId || undefined,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.logs.set(response.items);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.detail || 'No se pudo cargar la bitácora.');
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadLogs();
  }

  clearFilters(): void {
    this.action = '';
    this.category = '';
    this.search = '';
    this.applyFilters();
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  previousPage(): void {
    if (this.page > 1) {
      this.page -= 1;
      this.loadLogs();
    }
  }

  nextPage(): void {
    if (this.page < this.pageCount) {
      this.page += 1;
      this.loadLogs();
    }
  }
}
