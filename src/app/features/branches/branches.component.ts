import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BranchService } from '../../core/services/branch.service';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { Branch } from '../../core/models/branch.model';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-branches',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './branches.component.html',
  styleUrls: ['./branches.component.css'],
})
export class BranchesComponent implements OnInit {
  branches = signal<Branch[]>([]);
  cities = signal<string[]>([]);
  selectedCity = signal<string>('');
  selectedStatus = signal<string>('');
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Branch Modal (Create / Edit)
  isBranchModalOpen = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  editingBranchId = signal<string | null>(null);
  isSaving = signal<boolean>(false);
  modalError = signal<string | null>(null);
  branchForm: FormGroup;

  // Staff Assignment Modal
  isStaffModalOpen = signal<boolean>(false);
  activeBranch = signal<Branch | null>(null);
  availableEmployees = signal<User[]>([]);
  selectedEmployeeId = signal<string>('');
  isAssigning = signal<boolean>(false);
  staffModalError = signal<string | null>(null);

  readonly popularCities = [
    'La Paz',
    'Santa Cruz',
    'Cochabamba',
    'Sucre',
    'Oruro',
    'Tarija',
    'Potosí',
    'Beni',
    'Pando',
  ];

  constructor(
    private fb: FormBuilder,
    private branchService: BranchService,
    private userService: UserService,
    public authService: AuthService
  ) {
    this.branchForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      city: ['', [Validators.required, Validators.minLength(2)]],
      address: ['', [Validators.required, Validators.minLength(5)]],
      phone: [''],
      opening_hours: ['Lun - Sáb: 09:00 - 20:00'],
    });
  }

  ngOnInit(): void {
    this.loadBranches();
  }

  loadBranches(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const cityParam = this.selectedCity() || undefined;
    const is_activeParam =
      this.selectedStatus() !== '' ? this.selectedStatus() === 'true' : undefined;

    this.branchService.getBranches(cityParam, is_activeParam).subscribe({
      next: (data) => {
        this.branches.set(data);
        this.isLoading.set(false);

        // Extract unique cities from all loaded branches
        const uniqueCities = Array.from(new Set(data.map((b) => b.city))).sort();
        this.cities.set(uniqueCities);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err?.error?.detail || 'Error al cargar las sucursales'
        );
      },
    });
  }

  onCityFilter(city: string): void {
    this.selectedCity.set(city);
    this.loadBranches();
  }

  onStatusFilter(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedStatus.set(select.value);
    this.loadBranches();
  }

  openCreateModal(): void {
    this.isEditMode.set(false);
    this.editingBranchId.set(null);
    this.modalError.set(null);
    this.branchForm.reset({
      name: '',
      city: this.selectedCity() || 'La Paz',
      address: '',
      phone: '',
      opening_hours: 'Lun - Sáb: 09:00 - 20:00',
    });
    this.isBranchModalOpen.set(true);
  }

  openEditModal(branch: Branch): void {
    this.isEditMode.set(true);
    this.editingBranchId.set(branch.id);
    this.modalError.set(null);
    this.branchForm.patchValue({
      name: branch.name,
      city: branch.city,
      address: branch.address,
      phone: branch.phone || '',
      opening_hours: branch.opening_hours || '',
    });
    this.isBranchModalOpen.set(true);
  }

  closeBranchModal(): void {
    this.isBranchModalOpen.set(false);
    this.modalError.set(null);
  }

  saveBranch(): void {
    if (this.branchForm.invalid) {
      this.branchForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.modalError.set(null);
    const formVal = this.branchForm.value;

    if (this.isEditMode()) {
      const id = this.editingBranchId()!;
      this.branchService.updateBranch(id, formVal).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeBranchModal();
          this.showSuccess('Sucursal actualizada correctamente');
          this.loadBranches();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.modalError.set(
            err?.error?.detail || 'Error al actualizar la sucursal'
          );
        },
      });
    } else {
      this.branchService.createBranch(formVal).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeBranchModal();
          this.showSuccess('Nueva sucursal registrada exitosamente');
          this.loadBranches();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.modalError.set(
            err?.error?.detail || 'Error al crear la sucursal'
          );
        },
      });
    }
  }

  toggleBranchStatus(branch: Branch): void {
    const action = branch.is_active ? 'cerrar temporalmente' : 'reabrir';
    if (!confirm(`¿Estás seguro de que deseas ${action} la sucursal "${branch.name}"?`)) {
      return;
    }

    this.branchService.toggleBranchStatus(branch.id).subscribe({
      next: (updated) => {
        this.showSuccess(
          `Sucursal "${updated.name}" ${updated.is_active ? 'abierta/activa' : 'cerrada temporalmente'}`
        );
        this.loadBranches();
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'No se pudo cambiar el estado');
      },
    });
  }

  // Staff Management
  openStaffModal(branch: Branch): void {
    this.activeBranch.set(branch);
    this.selectedEmployeeId.set('');
    this.staffModalError.set(null);
    this.isStaffModalOpen.set(true);

    // Fetch all store managers and cashiers to allow assignment / transfer
    this.userService.getUsers({ is_active: true }).subscribe({
      next: (users) => {
        const staffCandidates = users.filter(
          (u) => u.role === 'STORE_MANAGER' || u.role === 'CASHIER'
        );
        this.availableEmployees.set(staffCandidates);
      },
      error: () => {},
    });
  }

  closeStaffModal(): void {
    this.isStaffModalOpen.set(false);
    this.activeBranch.set(null);
    this.staffModalError.set(null);
  }

  onEmployeeSelectChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedEmployeeId.set(select.value);
  }

  assignStaffMember(): void {
    const empId = this.selectedEmployeeId();
    const branch = this.activeBranch();
    if (!empId || !branch) return;

    this.isAssigning.set(true);
    this.staffModalError.set(null);

    this.branchService.assignStaff(branch.id, [empId]).subscribe({
      next: (updatedBranch) => {
        this.isAssigning.set(false);
        this.activeBranch.set(updatedBranch);
        this.selectedEmployeeId.set('');
        this.showSuccess('Personal asignado/transferido exitosamente');
        this.loadBranches();
      },
      error: (err) => {
        this.isAssigning.set(false);
        this.staffModalError.set(
          err?.error?.detail || 'Error al asignar el empleado'
        );
      },
    });
  }

  removeStaffMember(userId: string): void {
    const branch = this.activeBranch();
    if (!branch) return;

    if (!confirm('¿Deseas desvincular a este empleado de la sucursal?')) {
      return;
    }

    this.branchService.removeStaff(branch.id, userId).subscribe({
      next: (updatedBranch) => {
        this.activeBranch.set(updatedBranch);
        this.showSuccess('Empleado desvinculado correctamente');
        this.loadBranches();
      },
      error: (err) => {
        this.staffModalError.set(
          err?.error?.detail || 'No se pudo desvincular al empleado'
        );
      },
    });
  }

  showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => {
      this.successMessage.set(null);
    }, 4000);
  }
}
