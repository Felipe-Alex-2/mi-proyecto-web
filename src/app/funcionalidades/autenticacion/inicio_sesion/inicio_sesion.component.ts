import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { shopReturnUrl } from '../../tienda/tienda.guard';
import { guestStoreSelection } from '../../tienda/contexto-tienda';
import { AutenticacionService } from '../../../nucleo/servicios/autenticacion.service';
import { sinEspaciosVaciosValidator } from '../../../nucleo/validadores/validadores-personalizados';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './inicio_sesion.component.html',
  styleUrls: ['../campos-autenticacion.css', './inicio_sesion.component.css'],
})
export class InicioSesionComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private carouselTimer?: ReturnType<typeof setInterval>;
  readonly activeSlide = signal(0);
  readonly carouselPaused = signal(false);
  readonly year = new Date().getFullYear();
  readonly slides = [
    {
      crop: '43 116 294 432',
      alt: 'Colección de prendas en tonos neutros sobre perchas de madera',
      badge: 'Encuentra tu estilo',
      eyebrow: 'COLECCIÓN VESTA',
      title: 'Tu estilo empieza aquí.',
      description: 'Explora el catálogo de tu tienda y descubre las prendas que van contigo.',
    },
    {
      crop: '365 116 293 432',
      alt: 'Vehículo VESTA frente a una tienda de ropa',
      badge: 'Tus prendas, en tu sucursal',
      eyebrow: 'TUS RESERVAS',
      title: 'Tus favoritas, más cerca.',
      description: 'Elige tus prendas y reserva para recogerlas en la sucursal seleccionada.',
    },
    {
      crop: '688 116 292 432',
      alt: 'Un teléfono mostrando una experiencia de vestidor virtual',
      badge: 'Tu vestidor virtual',
      eyebrow: 'A TU MEDIDA',
      title: 'Descubre tu próxima versión.',
      description: 'Guarda tus medidas y explora tu vestidor virtual desde la web o el móvil.',
    },
  ];
  loginForm: FormGroup;
  errorMessage = signal<string | null>(null);
  showPassword = signal<boolean>(false);

  constructor(
    private fb: FormBuilder,
    public authService: AutenticacionService,
    private router: Router,
    public route: ActivatedRoute,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, sinEspaciosVaciosValidator()]],
      password: ['', [Validators.required, sinEspaciosVaciosValidator()]],
    });
    this.destroyRef.onDestroy(() => clearInterval(this.carouselTimer));
  }

  ngOnInit(): void {
    this.startCarousel();
  }

  private startCarousel(): void {
    clearInterval(this.carouselTimer);
    this.carouselTimer = setInterval(() => {
      if (!this.carouselPaused())
        this.activeSlide.update((index) => (index + 1) % this.slides.length);
    }, 10000);
  }

  selectSlide(index: number): void {
    if (index < 0 || index >= this.slides.length) return;
    this.activeSlide.set(index);
    this.startCarousel();
  }

  toggleCarousel(): void {
    this.carouselPaused.update((paused) => !paused);
    this.startCarousel();
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

    this.authService
      .login({ email: (email || '').trim(), password: (password || '').trim() })
      .subscribe({
        next: () => {
          const destination = shopReturnUrl(
            this.authService.currentUser()?.role,
            this.route.snapshot.queryParamMap.get('returnUrl'),
          );
          const selection = guestStoreSelection();
          const user = this.authService.currentUser();
          if (
            user?.role === 'CUSTOMER' &&
            selection &&
            this.route.snapshot.queryParamMap.get('returnUrl') &&
            (user.selected_tenant_id !== selection.tenant_id ||
              user.branch_id !== selection.branch_id)
          ) {
            this.authService
              .selectStore(selection)
              .subscribe({
                next: () => this.router.navigateByUrl(destination),
                error: () => this.router.navigate(['/home']),
              });
          } else this.router.navigateByUrl(destination);
        },
        error: (err) => {
          if (err.status === 0) {
            this.errorMessage.set(
              'No se pudo conectar con el servidor. Verifica tu conexión o el estado del backend.',
            );
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
