import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InventoryService } from '../../core/services/inventory.service';
import { BranchService } from '../../core/services/branch.service';
import { ProductService } from '../../core/services/product.service';
import { AuthService } from '../../core/services/auth.service';
import { InventoryMovement, MovementType } from '../../core/models/inventory.model';
import { Branch } from '../../core/models/branch.model';
import { Product, ProductVariant } from '../../core/models/product.model';

@Component({
  selector: 'app-inventory-movements',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './inventory-movements.component.html',
  styleUrls: ['./inventory-movements.component.css'],
})
export class InventoryMovementsComponent implements OnInit {
  movements = signal<InventoryMovement[]>([]);
  branches = signal<Branch[]>([]);
  products = signal<Product[]>([]);
  isLoading = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  isModalOpen = signal<boolean>(false);
  isEditModalOpen = signal<boolean>(false);
  editingMovement = signal<InventoryMovement | null>(null);
  isDeleteModalOpen = signal<boolean>(false);
  deletingMovement = signal<InventoryMovement | null>(null);

  selectedBranchFilter = signal<string>('');
  selectedTypeFilter = signal<string>('');
  
  movementForm: FormGroup;
  editForm: FormGroup;
  currentStock = signal<number | null>(null);
  feedbackMessage = signal<string>('');
  feedbackType = signal<'success' | 'error'>('success');

  // Computed flat variants for selector
  allVariants = computed(() => {
    const list: { id: string; label: string; product: Product; variant: ProductVariant }[] = [];
    for (const p of this.products()) {
      if (!p.is_active || !p.variants) continue;
      for (const v of p.variants) {
        const size = v.size_name || v.size_code || 'Única';
        const color = v.color_name || 'Estándar';
        list.push({
          id: v.id,
          label: `${p.name} - Talla ${size} / ${color} (${v.sku})`,
          product: p,
          variant: v,
        });
      }
    }
    return list;
  });

  constructor(
    private fb: FormBuilder,
    private inventoryService: InventoryService,
    private branchService: BranchService,
    private productService: ProductService,
    public authService: AuthService
  ) {
    this.movementForm = this.fb.group({
      branch_id: ['', Validators.required],
      variant_id: ['', Validators.required],
      type: ['ENTRY', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      reason: ['', [Validators.required, Validators.minLength(5)]],
      reference_number: [''],
      payment_method: [''],
      payment_status: ['PENDING'],
    });

    this.editForm = this.fb.group({
      reason: ['', [Validators.required, Validators.minLength(5)]],
      reference_number: [''],
      payment_method: [''],
      payment_status: ['PENDING'],
    });
  }

  ngOnInit(): void {
    this.loadBranches();
    this.loadProducts();
    this.loadMovements();

    // Listen to changes to calculate live stock preview
    this.movementForm.get('variant_id')?.valueChanges.subscribe(() => this.updateLiveStock());
    this.movementForm.get('branch_id')?.valueChanges.subscribe(() => this.updateLiveStock());
  }

  loadBranches(): void {
    this.branchService.getBranches(undefined, true).subscribe({
      next: (b) => {
        this.branches.set(b);
        const currentUser = this.authService.currentUser();
        if (currentUser?.branch_id) {
          this.movementForm.patchValue({ branch_id: currentUser.branch_id });
          this.selectedBranchFilter.set(currentUser.branch_id);
        }
      },
    });
  }

  loadProducts(): void {
    this.productService.getProducts({ isActive: true }).subscribe({
      next: (p) => this.products.set(p),
    });
  }

  loadMovements(): void {
    this.isLoading.set(true);
    this.inventoryService
      .getMovements({
        branch_id: this.selectedBranchFilter() || undefined,
        type: this.selectedTypeFilter() || undefined,
        limit: 100,
      })
      .subscribe({
        next: (data) => {
          this.movements.set(data);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  onFilterChange(): void {
    this.loadMovements();
  }

  openRegisterModal(): void {
    this.movementForm.reset({
      type: 'ENTRY',
      quantity: 1,
      reason: '',
      reference_number: '',
      branch_id: this.authService.currentUser()?.branch_id || (this.branches().length > 0 ? this.branches()[0].id : ''),
      variant_id: '',
      payment_method: '',
      payment_status: 'PENDING',
    });
    this.currentStock.set(null);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  updateLiveStock(): void {
    const vId = this.movementForm.get('variant_id')?.value;
    const bId = this.movementForm.get('branch_id')?.value;
    if (!vId || !bId) {
      this.currentStock.set(null);
      return;
    }

    this.inventoryService.getVariantAvailability(vId).subscribe({
      next: (availList) => {
        const item = availList.find((a) => a.branch_id === bId);
        this.currentStock.set(item ? item.quantity : 0);
      },
      error: () => this.currentStock.set(0),
    });
  }

  get calculatedNewStock(): number | null {
    const cur = this.currentStock();
    if (cur === null) return null;
    const qty = Number(this.movementForm.get('quantity')?.value) || 0;
    const type = this.movementForm.get('type')?.value;

    if (type === 'ENTRY' || type === 'RETURN') {
      return cur + qty;
    } else if (type === 'EXIT') {
      return cur - qty;
    } else if (type === 'ADJUSTMENT') {
      return qty;
    }
    return cur;
  }

  onSubmitMovement(): void {
    if (this.movementForm.invalid) {
      this.movementForm.markAllAsTouched();
      return;
    }

    const val = this.movementForm.value;
    if (val.type === 'EXIT' && this.currentStock() !== null && val.quantity > this.currentStock()!) {
      this.showToast('Stock insuficiente para realizar esta salida', 'error');
      return;
    }

    this.isSubmitting.set(true);
    this.feedbackMessage.set('');
    this.inventoryService
      .createMovement({
        branch_id: val.branch_id,
        variant_id: val.variant_id,
        type: val.type as MovementType,
        quantity: val.quantity,
        reason: val.reason.trim(),
        reference_number: val.reference_number?.trim() || undefined,
        payment_method: val.payment_method || undefined,
        payment_status: val.payment_status || 'PENDING',
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          try {
            this.closeModal();
            this.showToast('Movimiento de inventario registrado con éxito', 'success');
            this.loadMovements();
          } catch (e) {
            console.error('Error al recargar movimientos:', e);
          }
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const msg = err.error?.detail || 'Error al registrar el movimiento';
          this.showToast(msg, 'error');
        },
      });
  }

  // Edit & Delete Methods
  openEditModal(m: InventoryMovement): void {
    this.editingMovement.set(m);
    this.editForm.patchValue({
      reason: m.reason || '',
      reference_number: m.reference_number || '',
      payment_method: m.payment_method || '',
      payment_status: m.payment_status || 'PENDING',
    });
    this.isEditModalOpen.set(true);
  }

  closeEditModal(): void {
    this.isEditModalOpen.set(false);
    this.editingMovement.set(null);
  }

  onSubmitEdit(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const m = this.editingMovement();
    if (!m) return;

    this.isSubmitting.set(true);
    this.feedbackMessage.set('');
    const val = this.editForm.value;
    this.inventoryService
      .updateMovement(m.id, {
        reason: val.reason.trim(),
        reference_number: val.reference_number?.trim() || undefined,
        payment_method: val.payment_method || undefined,
        payment_status: val.payment_status || undefined,
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          try {
            this.closeEditModal();
            this.showToast('Movimiento actualizado con éxito', 'success');
            this.loadMovements();
          } catch (e) {
            console.error('Error al recargar movimientos:', e);
          }
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const msg = err.error?.detail || 'Error al actualizar el movimiento';
          this.showToast(msg, 'error');
        },
      });
  }

  openDeleteModal(m: InventoryMovement): void {
    this.deletingMovement.set(m);
    this.isDeleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.isDeleteModalOpen.set(false);
    this.deletingMovement.set(null);
  }

  onConfirmDelete(): void {
    const m = this.deletingMovement();
    if (!m) return;

    this.isSubmitting.set(true);
    this.feedbackMessage.set('');
    this.inventoryService.deleteMovement(m.id).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        try {
          this.closeDeleteModal();
          this.showToast('Movimiento eliminado y stock revertido correctamente', 'success');
          this.loadMovements();
        } catch (e) {
          console.error('Error al recargar tras eliminar movimiento:', e);
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg = err.error?.detail || 'Error al eliminar el movimiento';
        this.showToast(msg, 'error');
      },
    });
  }

  showToast(message: string, type: 'success' | 'error'): void {
    this.feedbackMessage.set(message);
    this.feedbackType.set(type);
    setTimeout(() => this.feedbackMessage.set(''), 4500);
  }

  getTypeBadgeClass(type: string): string {
    switch (type) {
      case 'ENTRY':
        return 'badge-entry';
      case 'EXIT':
        return 'badge-exit';
      case 'ADJUSTMENT':
        return 'badge-adjustment';
      case 'RETURN':
        return 'badge-return';
      default:
        return '';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'ENTRY':
        return '↑ Entrada';
      case 'EXIT':
        return '↓ Salida';
      case 'ADJUSTMENT':
        return '⚙ Ajuste Físico';
      case 'RETURN':
        return '↩ Devolución';
      default:
        return type;
    }
  }

  getPaymentBadgeClass(paymentStatus?: string): string {
    return paymentStatus === 'PAID' ? 'badge-paid' : 'badge-pending-pay';
  }

  getPaymentLabel(m: InventoryMovement): string {
    if (!m.payment_method) return '-';
    const method = m.payment_method === 'PAYPAL' ? 'PayPal' : 'Efectivo';
    return m.payment_status === 'PAID' ? `✓ Pagado (${method})` : `⏳ Pendiente (${method})`;
  }
}

