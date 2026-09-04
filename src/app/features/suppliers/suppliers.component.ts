import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupplierService } from '../../core/services/supplier.service';
import { AuthService } from '../../core/services/auth.service';
import { Supplier } from '../../core/models/supplier.model';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './suppliers.component.html',
  styleUrls: ['./suppliers.component.css'],
})
export class SuppliersComponent implements OnInit {
  suppliers = signal<Supplier[]>([]);
  filteredSuppliers = signal<Supplier[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  searchQuery = signal<string>('');

  // Modal
  isModalOpen = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  editingId = signal<string | null>(null);
  isSaving = signal<boolean>(false);
  modalError = signal<string | null>(null);

  supplierForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private supplierService: SupplierService,
    public authService: AuthService
  ) {
    this.supplierForm = this.fb.group({
      company_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
      contact_name: ['', [Validators.maxLength(150)]],
      tax_id: ['', [Validators.maxLength(50)]],
      email: ['', [Validators.email, Validators.maxLength(255)]],
      phone: ['', [Validators.maxLength(50)]],
      address: ['', [Validators.maxLength(255)]],
    });
  }

  ngOnInit(): void {
    this.loadSuppliers();
  }

  loadSuppliers(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.supplierService.getSuppliers().subscribe({
      next: (data) => {
        this.suppliers.set(data);
        this.filterSuppliers(this.searchQuery());
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Error al cargar los proveedores');
        this.isLoading.set(false);
      },
    });
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.filterSuppliers(value);
  }

  filterSuppliers(query: string): void {
    const term = query.toLowerCase().trim();
    if (!term) {
      this.filteredSuppliers.set(this.suppliers());
      return;
    }
    const filtered = this.suppliers().filter(
      (s) =>
        s.company_name.toLowerCase().includes(term) ||
        (s.contact_name && s.contact_name.toLowerCase().includes(term)) ||
        (s.tax_id && s.tax_id.toLowerCase().includes(term)) ||
        (s.email && s.email.toLowerCase().includes(term)) ||
        (s.phone && s.phone.toLowerCase().includes(term))
    );
    this.filteredSuppliers.set(filtered);
  }

  openCreateModal(): void {
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.modalError.set(null);
    this.supplierForm.reset();
    this.isModalOpen.set(true);
  }

  openEditModal(supplier: Supplier): void {
    this.isEditMode.set(true);
    this.editingId.set(supplier.id);
    this.modalError.set(null);
    this.supplierForm.patchValue({
      company_name: supplier.company_name,
      contact_name: supplier.contact_name || '',
      tax_id: supplier.tax_id || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.modalError.set(null);
    this.supplierForm.reset();
  }

  save(): void {
    if (this.supplierForm.invalid) {
      this.supplierForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.modalError.set(null);

    const formVal = this.supplierForm.value;
    const payload = {
      company_name: formVal.company_name.trim(),
      contact_name: formVal.contact_name?.trim() || undefined,
      tax_id: formVal.tax_id?.trim() || undefined,
      email: formVal.email?.trim() || undefined,
      phone: formVal.phone?.trim() || undefined,
      address: formVal.address?.trim() || undefined,
    };

    if (this.isEditMode() && this.editingId()) {
      this.supplierService.updateSupplier(this.editingId()!, payload).subscribe({
        next: (updated) => {
          this.suppliers.update((list) =>
            list.map((s) => (s.id === updated.id ? updated : s))
          );
          this.filterSuppliers(this.searchQuery());
          this.isSaving.set(false);
          this.closeModal();
          this.showSuccess('Proveedor actualizado correctamente');
        },
        error: (err) => {
          this.modalError.set(err.error?.detail || 'Error al actualizar el proveedor');
          this.isSaving.set(false);
        },
      });
    } else {
      this.supplierService.createSupplier(payload).subscribe({
        next: (created) => {
          this.suppliers.update((list) => [created, ...list]);
          this.filterSuppliers(this.searchQuery());
          this.isSaving.set(false);
          this.closeModal();
          this.showSuccess('Proveedor registrado exitosamente');
        },
        error: (err) => {
          this.modalError.set(err.error?.detail || 'Error al crear el proveedor');
          this.isSaving.set(false);
        },
      });
    }
  }

  toggleSupplierStatus(supplier: Supplier): void {
    this.supplierService.toggleSupplierStatus(supplier.id).subscribe({
      next: (updated) => {
        this.suppliers.update((list) =>
          list.map((s) => (s.id === updated.id ? updated : s))
        );
        this.filterSuppliers(this.searchQuery());
        this.showSuccess(
          `Proveedor "${updated.company_name}" ${
            updated.is_active ? 'activado' : 'desactivado'
          } correctamente`
        );
      },
      error: (err) => {
        this.errorMessage.set(
          err.error?.detail || 'Error al cambiar estado del proveedor'
        );
      },
    });
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => {
      this.successMessage.set(null);
    }, 4000);
  }
}
