import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css'],
})
export class ForgotPasswordComponent {
  forgotForm: FormGroup;
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  emailSent = signal<boolean>(false);
  sentEmail = signal<string>('');

  constructor(
    private fb: FormBuilder,
    public authService: AuthService,
    private router: Router
  ) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  onSubmit(): void {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    const email = this.forgotForm.value.email.trim();

    this.authService.forgotPassword(email).subscribe({
      next: (res) => {
        this.sentEmail.set(email);
        this.emailSent.set(true);
        this.successMessage.set(
          res.message || 'Si el correo está registrado, recibirás un código de 6 dígitos en tu bandeja de entrada.'
        );
      },
      error: (err) => {
        if (err.status === 0) {
          this.errorMessage.set('No se pudo conectar con el servidor. Verifica tu conexión.');
          return;
        }
        const detail = err?.error?.detail;
        if (typeof detail === 'string') {
          this.errorMessage.set(detail);
        } else {
          this.errorMessage.set('Ocurrió un error al procesar la solicitud. Intenta nuevamente.');
        }
      },
    });
  }

  goToResetPassword(): void {
    this.router.navigate(['/reset-password'], {
      queryParams: { email: this.sentEmail() },
    });
  }
}
