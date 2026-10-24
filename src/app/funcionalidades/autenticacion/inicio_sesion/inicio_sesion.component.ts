import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AutenticacionService } from '../../../nucleo/servicios/autenticacion.service';
import { sinEspaciosVaciosValidator } from '../../../nucleo/validadores/validadores-personalizados';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './inicio_sesion.component.html',
  styleUrls: ['./inicio_sesion.component.css', '../campos-autenticacion.css'],
})
export class InicioSesionComponent {
  loginForm: FormGroup;
  errorMessage = signal<string | null>(null);
  showPassword = signal<boolean>(false);

  constructor(
    private fb: FormBuilder,
    public authService: AutenticacionService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, sinEspaciosVaciosValidator()]],
      password: ['', [Validators.required, sinEspaciosVaciosValidator()]],
    });
  }

  togglePassword(): void {
    this.showPassword.update((val) => !val);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    const { email, password } = this.loginForm.value;

    this.authService.login({ email: (email || '').trim(), password: (password || '').trim() }).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
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
          this.errorMessage.set('Error de autenticación. Verifica tus credenciales.');
        }
      },
    });
  }
}
