import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { User, UserRole, UserFilters } from '../../core/models/user.model';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css'],
})
export class UsersComponent implements OnInit {
  users = signal<User[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Filters
  searchTerm = signal<string>('');
  selectedRole = signal<string>('');
  selectedStatus = signal<string>('');

  // Modal
  isModalOpen = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  editingUserId = signal<string | null>(null);
  isSaving = signal<boolean>(false);
  modalError = signal<string | null>(null);

  userForm: FormGroup;

  readonly rolesList: { value: UserRole; label: string }[] = [
    { value: 'ADMIN', label: 'Administrador General' },
    { value: 'STORE_MANAGER', label: 'Encargado de Sucursal' },
    { value: 'CASHIER', label: 'Cajero' },
    { value: 'CUSTOMER', label: 'Cliente' },
  ];

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    public authService: AuthService
  ) {
    this.userForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      role: ['CASHIER', [Validators.required]],
      password: ['', [Validators.minLength(8)]],
    });
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const filters: UserFilters = {};
    if (this.searchTerm().trim()) {
      filters.search = this.searchTerm().trim();
    }
    if (this.selectedRole()) {
      filters.role = this.selectedRole();
    }
    if (this.selectedStatus() !== '') {
      filters.is_active = this.selectedStatus() === 'true';
    }

    this.userService.getUsers(filters).subscribe({
      next: (data) => {
        this.users.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err?.error?.detail || 'Error al cargar el listado de usuarios'
        );
      },
    });
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
    this.loadUsers();
  }

  onRoleChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedRole.set(select.value);
    this.loadUsers();
  }

  onStatusChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedStatus.set(select.value);
    this.loadUsers();
  }

  openCreateModal(): void {
    this.isEditMode.set(false);
    this.editingUserId.set(null);
    this.modalError.set(null);
    this.userForm.reset({
      full_name: '',
      email: '',
      phone: '',
      role: 'CASHIER',
      password: '',
    });
    this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
    this.userForm.get('password')?.updateValueAndValidity();
    this.isModalOpen.set(true);
  }

  openEditModal(user: User): void {
    this.isEditMode.set(true);
    this.editingUserId.set(user.id);
    this.modalError.set(null);
    this.userForm.patchValue({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      password: '',
    });
    // In edit mode password is optional
    this.userForm.get('password')?.setValidators([Validators.minLength(8)]);
    this.userForm.get('password')?.updateValueAndValidity();
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.modalError.set(null);
  }

  onSubmitModal(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.modalError.set(null);
    const formVal = this.userForm.value;

    if (this.isEditMode()) {
      const userId = this.editingUserId()!;
      const payload: any = {
        full_name: formVal.full_name.trim(),
        email: formVal.email.trim(),
        role: formVal.role,
        phone: formVal.phone ? formVal.phone.trim() : null,
      };
      if (formVal.password) {
        payload.password = formVal.password;
      }

      this.userService.updateUser(userId, payload).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeModal();
          this.showSuccess('Usuario actualizado correctamente');
          this.loadUsers();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.modalError.set(err?.error?.detail || 'Error al actualizar usuario');
        },
      });
    } else {
      const payload = {
        full_name: formVal.full_name.trim(),
        email: formVal.email.trim(),
        password: formVal.password,
        role: formVal.role,
        phone: formVal.phone ? formVal.phone.trim() : undefined,
      };

      this.userService.createUser(payload).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeModal();
          this.showSuccess('Nuevo usuario creado exitosamente');
          this.loadUsers();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.modalError.set(err?.error?.detail || 'Error al crear usuario');
        },
      });
    }
  }

  toggleStatus(user: User): void {
    const action = user.is_active ? 'desactivar' : 'activar';
    if (!confirm(`¿Estás seguro de que deseas ${action} la cuenta de "${user.full_name}"?`)) {
      return;
    }

    this.userService.toggleUserStatus(user.id).subscribe({
      next: (updated) => {
        this.showSuccess(
          `Cuenta de "${updated.full_name}" ${updated.is_active ? 'activada' : 'desactivada'} correctamente`
        );
        this.loadUsers();
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'No se pudo cambiar el estado');
      },
    });
  }

  showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => {
      this.successMessage.set(null);
    }, 4000);
  }

  getRoleLabel(role: string): string {
    const found = this.rolesList.find((r) => r.value === role);
    return found ? found.label : role;
  }

  getRoleClass(role: string): string {
    switch (role) {
      case 'ADMIN':
        return 'badge-admin';
      case 'STORE_MANAGER':
        return 'badge-manager';
      case 'CASHIER':
        return 'badge-cashier';
      default:
        return 'badge-customer';
    }
  }
}
