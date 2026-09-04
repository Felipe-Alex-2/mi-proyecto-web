import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  isEditing = signal<boolean>(false);
  editForm: FormGroup;
  updateSuccess = signal<string | null>(null);
  updateError = signal<string | null>(null);

  module1Expanded = signal<boolean>(true);
  module2Expanded = signal<boolean>(false);

  constructor(
    private fb: FormBuilder,
    public authService: AuthService
  ) {
    this.editForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
    });
  }

  ngOnInit(): void {
    // Re-fetch current user from backend to ensure latest role from DB
    this.authService.loadCurrentUser().subscribe((user) => {
      if (user) {
        this.populateForm(user);
      }
    });
  }

  toggleModule1(): void {
    this.module1Expanded.update((v) => !v);
  }

  toggleModule2(): void {
    this.module2Expanded.update((v) => !v);
  }

  populateForm(user: User): void {
    this.editForm.patchValue({
      full_name: user.full_name,
      email: user.email,
    });
  }

  toggleEdit(): void {
    this.isEditing.update((val) => !val);
    if (this.isEditing()) {
      const user = this.authService.currentUser();
      if (user) this.populateForm(user);
    }
    this.updateSuccess.set(null);
    this.updateError.set(null);
  }

  onSaveProfile(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.updateSuccess.set(null);
    this.updateError.set(null);

    this.authService.updateProfile(this.editForm.value).subscribe({
      next: () => {
        this.updateSuccess.set('¡Perfil actualizado correctamente!');
        this.isEditing.set(false);
      },
      error: (err) => {
        const detail = err?.error?.detail;
        this.updateError.set(typeof detail === 'string' ? detail : 'Error al actualizar el perfil');
      },
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
