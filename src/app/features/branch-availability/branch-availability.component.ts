import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InventoryService } from '../../core/services/inventory.service';
import { BranchService } from '../../core/services/branch.service';
import { Branch } from '../../core/models/branch.model';
import { AvailabilityMatrixRow, BranchInventorySummary } from '../../core/models/inventory.model';

@Component({
  selector: 'app-branch-availability',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './branch-availability.component.html',
  styleUrls: ['./branch-availability.component.css'],
})
export class BranchAvailabilityComponent implements OnInit {
  branches = signal<Branch[]>([]);
  matrixRows = signal<AvailabilityMatrixRow[]>([]);
  branchSummaries = signal<Record<string, BranchInventorySummary>>({});
  isLoading = signal<boolean>(false);
  searchTerm = signal<string>('');

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
    private inventoryService: InventoryService,
    private branchService: BranchService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.branchService.getBranches(undefined, true).subscribe({
      next: (branchesList) => {
        this.branches.set(branchesList);

        // Load summary for each branch
        for (const b of branchesList) {
          this.inventoryService.getBranchSummary(b.id).subscribe({
            next: (sum) => {
              this.branchSummaries.update((prev) => ({ ...prev, [b.id]: sum }));
            },
          });
        }

        // Load matrix
        this.inventoryService.getAvailabilityMatrix().subscribe({
          next: (matrix) => {
            this.matrixRows.set(matrix);
            this.isLoading.set(false);
          },
          error: () => this.isLoading.set(false),
        });
      },
      error: () => this.isLoading.set(false),
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
