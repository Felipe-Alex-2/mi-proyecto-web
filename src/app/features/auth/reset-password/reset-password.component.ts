import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

export const passwordMatchValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const newPassword = control.get('newPassword');
  const confirmPassword = control.get('confirmPassword');

  if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
    return { passwordMismatch: true };
  }
  return null;
};

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css'],
})
export class ResetPasswordComponent implements OnInit {
  resetForm: FormGroup;
  errorMessage = signal<string | null>(null);
  isSuccess = signal<boolean>(false);
  showPassword = signal<boolean>(false);
  showConfirmPassword = signal<boolean>(false);

  constructor(
    private fb: FormBuilder,
    public authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.resetForm = this.fb.group(
      {
        email: ['', [Validators.required, Validators.email]],
        token: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
        newPassword: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: passwordMatchValidator }
    );
  }

  ngOnInit(): void {
    const emailParam = this.route.snapshot.queryParamMap.get('email');
    if (emailParam) {
      this.resetForm.patchValue({ email: emailParam });
    }
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  onSubmit(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    const { email, token, newPassword } = this.resetForm.value;

    this.authService
      .resetPassword({
        email: email.trim(),
        token: token.trim(),
        new_password: newPassword,
      })
      .subscribe({
        next: () => {
          this.isSuccess.set(true);
        },
        error: (err) => {
          if (err.status === 0) {
            this.errorMessage.set('No se pudo conectar con el servidor.');
            return;
          }
          const detail = err?.error?.detail;
          if (typeof detail === 'string') {
            this.errorMessage.set(detail);
          } else if (Array.isArray(err?.error?.errors)) {
            this.errorMessage.set(err.error.errors[0]?.message || 'Datos inválidos');
          } else {
            this.errorMessage.set('Código inválido o expirado. Por favor solicita uno nuevo.');
          }
        },
      });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
