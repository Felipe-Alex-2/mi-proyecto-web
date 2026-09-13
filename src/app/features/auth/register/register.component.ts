import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { noWhitespaceValidator, passwordStrengthValidator } from '../../../core/validators/custom-validators';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
})
export class RegisterComponent {
  registerForm: FormGroup;
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  showPassword = signal<boolean>(false);

  constructor(
    private fb: FormBuilder,
    public authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(2), noWhitespaceValidator()]],
      email: ['', [Validators.required, Validators.email, noWhitespaceValidator()]],
      password: ['', [Validators.required, passwordStrengthValidator()]],
      confirmPassword: ['', [Validators.required]],
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null
      : { mismatch: true };
  }

  togglePassword(): void {
    this.showPassword.update((val) => !val);
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    const { email, password, full_name } = this.registerForm.value;

    this.authService.register({
      email: (email || '').trim(),
      password: password,
      full_name: (full_name || '').trim(),
    }).subscribe({
      next: () => {
        this.successMessage.set('¡Cuenta creada exitosamente! Iniciando sesión...');
        // Auto login
        this.authService.login({ email: (email || '').trim(), password }).subscribe({
          next: () => {
            setTimeout(() => this.router.navigate(['/dashboard']), 800);
          },
          error: () => {
            this.router.navigate(['/login']);
          }
        });
      },
      error: (err) => {
        if (err.status === 0) {
          this.errorMessage.set('No se pudo conectar con el servidor. Verifica tu conexión o el estado del backend.');
          return;
        }
        const detail = err?.error?.detail;
        if (typeof detail === 'string') {
          this.errorMessage.set(detail);
        } else if (Array.isArray(err?.error?.errors)) {
          this.errorMessage.set(err.error.errors[0]?.message || 'Datos inválidos');
        } else {
          this.errorMessage.set('Error al registrar usuario. Intenta nuevamente.');
        }
      },
    });
  }
}
