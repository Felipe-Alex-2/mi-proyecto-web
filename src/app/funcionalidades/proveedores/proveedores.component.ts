import { EstadoLocalComponent } from '../../nucleo/componentes/estado-local.component';
import { sinEspaciosVaciosValidator, longitudMinimaSinEspacios } from '../../nucleo/validadores/validadores-personalizados';
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProveedorService } from '../../nucleo/servicios/proveedor.service';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { Supplier } from '../../nucleo/modelos/proveedor.model';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [EstadoLocalComponent, CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './proveedores.component.html',
  styleUrls: ['./proveedores.component.css'],
})
export class ProveedoresComponent implements OnInit {
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
    private supplierService: ProveedorService,
    public authService: AutenticacionService
  ) {
    this.supplierForm = this.fb.group({
      company_name: ['', [Validators.required, longitudMinimaSinEspacios(2), sinEspaciosVaciosValidator(), Validators.maxLength(150)]],
      contact_name: ['', [Validators.required, longitudMinimaSinEspacios(2), sinEspaciosVaciosValidator(), Validators.maxLength(150)]],
      tax_id: ['', [Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      phone: ['', [Validators.required, longitudMinimaSinEspacios(5), sinEspaciosVaciosValidator(), Validators.maxLength(50)]],
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
      const labels: Record<string, string> = {
        company_name: 'Razón social (mínimo 2 caracteres)', contact_name: 'Persona de contacto (mínimo 2 caracteres)',
        email: 'Correo electrónico válido', phone: 'Teléfono (mínimo 5 caracteres)',
        tax_id: 'NIT (máximo 50 caracteres)', address: 'Dirección (máximo 255 caracteres)',
      };
      const invalid = Object.entries(this.supplierForm.controls).filter(([, control]) => control.invalid).map(([name]) => labels[name]);
      this.modalError.set(`Revisa los siguientes campos: ${invalid.join(', ')}.`);
      return;
    }

    this.isSaving.set(true);
    this.modalError.set(null);
    this.errorMessage.set(null);

    const formVal = this.supplierForm.value;
    const payload = {
      company_name: formVal.company_name.trim(),
      contact_name: formVal.contact_name?.trim() || undefined,
      tax_id: formVal.tax_id?.trim() || '',
      email: formVal.email?.trim() || undefined,
      phone: formVal.phone?.trim() || undefined,
      address: formVal.address?.trim() || '',
    };

    if (this.isEditMode() && this.editingId()) {
      this.supplierService.updateSupplier(this.editingId()!, payload).subscribe({
        next: (updated) => {
          this.isSaving.set(false);
          try {
            this.suppliers.update((list) =>
              list.map((s) => (s.id === updated.id ? updated : s))
            );
            this.filterSuppliers(this.searchQuery());
            this.closeModal();
            this.showSuccess('Proveedor actualizado correctamente');
          } catch (e) {
            console.error('Error procesando actualización de proveedor:', e);
            this.closeModal();
            this.loadSuppliers();
          }
        },
        error: (err) => {
          this.modalError.set(err.error?.detail || 'Error al actualizar el proveedor');
          this.isSaving.set(false);
        },
      });
    } else {
      this.supplierService.createSupplier(payload).subscribe({
        next: (created) => {
          this.isSaving.set(false);
          try {
            this.suppliers.update((list) => [created, ...list]);
            this.filterSuppliers(this.searchQuery());
            this.closeModal();
            this.showSuccess('Proveedor registrado exitosamente');
          } catch (e) {
            console.error('Error procesando creación de proveedor:', e);
            this.closeModal();
            this.loadSuppliers();
          }
        },
        error: (err) => {
          this.modalError.set(err.error?.detail || 'Error al crear el proveedor');
          this.isSaving.set(false);
        },
      });
    }
  }

  toggleSupplierStatus(supplier: Supplier): void {
    this.errorMessage.set(null);
    this.supplierService.toggleSupplierStatus(supplier.id).subscribe({
      next: (updated) => {
        try {
          this.suppliers.update((list) =>
            list.map((s) => (s.id === updated.id ? updated : s))
          );
          this.filterSuppliers(this.searchQuery());
          this.showSuccess(
            `Proveedor "${updated.company_name}" ${
              updated.is_active ? 'activado' : 'desactivado'
            } correctamente`
          );
        } catch (e) {
          console.error('Error tras toggle proveedor:', e);
          this.loadSuppliers();
        }
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
