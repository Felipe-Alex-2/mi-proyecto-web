import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InventarioService } from '../../nucleo/servicios/inventario.service';
import { SucursalService } from '../../nucleo/servicios/sucursal.service';
import { Branch } from '../../nucleo/modelos/sucursal.model';
import { AvailabilityMatrixRow, BranchInventorySummary } from '../../nucleo/modelos/inventario.model';
import { SelectorSucursalComponent } from '../../nucleo/componentes/selector-sucursal.component';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { Subscription } from 'rxjs';
import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-branch-availability',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SelectorSucursalComponent],
  templateUrl: './disponibilidad-sucursal.component.html',
  styleUrls: ['./disponibilidad-sucursal.component.css'],
})
export class DisponibilidadSucursalComponent implements OnInit {
  branches = signal<Branch[]>([]);
  matrixRows = signal<AvailabilityMatrixRow[]>([]);
  branchSummaries = signal<Record<string, BranchInventorySummary>>({});
  isLoading = signal<boolean>(false);
  searchTerm = signal<string>('');
  selectedBranchId = signal('');
  error = signal('');
  visibleBranches = computed(() => this.branches().filter(b => !this.selectedBranchId() || b.id === this.selectedBranchId()));
  private matrixRequest?: Subscription;
  private readonly destroyRef = inject(DestroyRef);

  filteredRows = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.matrixRows();
    return this.matrixRows().filter(
      (r) =>
        r.product_name.toLowerCase().includes(term) ||
        r.sku.toLowerCase().includes(term) ||
        r.size_name.toLowerCase().includes(term) ||
        r.color_name.toLowerCase().includes(term)
    );
  });

  totalInventoryUnits = computed(() => {
    return this.matrixRows().reduce((sum, r) => sum + r.total_quantity, 0);
  });

  constructor(
    private inventoryService: InventarioService,
    private branchService: SucursalService,
    public auth: AutenticacionService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.branchService.getBranches(undefined, true).subscribe({
      next: (branchesList) => {
        this.branches.set(branchesList);
        if (this.auth.currentUser()?.role !== 'ADMIN') this.selectedBranchId.set(this.auth.currentUser()?.branch_id || '');

        // Load summary for each branch
        for (const b of branchesList) {
          this.inventoryService.getBranchSummary(b.id).subscribe({
            next: (sum) => {
              this.branchSummaries.update((prev) => ({ ...prev, [b.id]: sum }));
            },
          });
        }

        // Load matrix
        this.loadMatrix();
      },
      error: () => { this.error.set('No se pudieron cargar las sucursales.'); this.isLoading.set(false); },
    });
  }

  changeBranch(id: string): void {
    this.selectedBranchId.set(id);
    this.loadMatrix();
  }

  loadMatrix(): void {
    this.isLoading.set(true);
    this.error.set('');
    this.matrixRows.set([]);
    this.matrixRequest?.unsubscribe();
    this.matrixRequest = this.inventoryService.getAvailabilityMatrix(undefined, this.selectedBranchId() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: matrix => { this.matrixRows.set(matrix); this.isLoading.set(false); },
        error: err => { this.error.set(err?.error?.detail || 'No se pudo consultar el stock.'); this.isLoading.set(false); },
      });
  }

  getStockBadgeClass(qty: number): string {
    if (qty <= 0) return 'badge-out';
    if (qty <= 5) return 'badge-low';
    return 'badge-in';
  }

  getStockLabel(qty: number): string {
    if (qty <= 0) return '0 (Agotado)';
    if (qty <= 5) return `${qty} (Pocas)`;
    return `${qty} uds.`;
  }
}
