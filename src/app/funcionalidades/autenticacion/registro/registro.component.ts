import { SelectorTiendaComponent } from '../../../nucleo/componentes/selector-tienda.component';
﻿import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { shopReturnUrl } from '../../tienda/tienda.guard';
import { guestStoreSelection } from '../../tienda/contexto-tienda';
import { AutenticacionService } from '../../../nucleo/servicios/autenticacion.service';
import { sinEspaciosVaciosValidator, seguridadContrasenaValidator , longitudMinimaSinEspacios} from '../../../nucleo/validadores/validadores-personalizados';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, SelectorTiendaComponent],
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.css', '../campos-autenticacion.css'],
})
export class RegistroComponent {
  registerForm: FormGroup;
  storeSelection: {tenant_id:string;branch_id:string}|null = guestStoreSelection();
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  showPassword = signal<boolean>(false);

  get passwordRequirements() {
    const value: string = this.registerForm.get('password')?.value || '';
    return [
      { label: 'Mínimo 8 caracteres', met: value.length >= 8 },
      { label: 'Una letra mayúscula', met: /[A-Z]/.test(value) },
      { label: 'Una letra minúscula', met: /[a-z]/.test(value) },
      { label: 'Un número', met: /[0-9]/.test(value) },
      { label: 'Un símbolo', met: /[^A-Za-z0-9\s]/.test(value) },
    ];
  }

  constructor(
    private fb: FormBuilder,
    public authService: AutenticacionService,
    private router: Router,
    public route: ActivatedRoute
  ) {
    this.registerForm = this.fb.group({
      full_name: ['', [Validators.required, longitudMinimaSinEspacios(2), Validators.maxLength(100), sinEspaciosVaciosValidator()]],
      email: ['', [Validators.required, Validators.email, sinEspaciosVaciosValidator()]],
      password: ['', [Validators.required, seguridadContrasenaValidator()]],
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

    if (!this.storeSelection) { this.errorMessage.set('Escoge una empresa y su sucursal para crear tu cuenta.'); return; }
    this.errorMessage.set(null);
    this.successMessage.set(null);
    const { email, password, full_name } = this.registerForm.value;

    this.authService.register({
      ...this.storeSelection,
      email: (email || '').trim(),
      password: password,
      full_name: (full_name || '').trim(),
    }).subscribe({
      next: () => {
        this.successMessage.set('¡Cuenta creada exitosamente! Iniciando sesión...');
        // Auto login
        this.authService.login({ email: (email || '').trim(), password }).subscribe({
          next: () => {
            setTimeout(() => this.router.navigateByUrl(shopReturnUrl(this.authService.currentUser()?.role, this.route.snapshot.queryParamMap.get('returnUrl'))), 800);
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
