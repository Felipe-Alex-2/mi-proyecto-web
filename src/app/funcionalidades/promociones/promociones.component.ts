import { EstadoLocalComponent } from '../../nucleo/componentes/estado-local.component';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DialogoTiendaDirective } from '../tienda/dialogo-tienda.directive';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PromocionService } from '../../nucleo/servicios/promocion.service';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { Promotion, DiscountSuggestion } from '../../nucleo/modelos/promocion.model';

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [
    EstadoLocalComponent,
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    DialogoTiendaDirective,
  ],
  templateUrl: './promociones.component.html',
  styleUrls: ['./promociones.component.css'],
})
export class PromocionesComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute, {optional:true});
  suggestions = signal<DiscountSuggestion[]>([]);
  showSuggestions = signal(false);
  suggesting = signal(false);
  suggestionError = signal('');
  draft = signal<DiscountSuggestion | null>(null);
  promotions = signal<Promotion[]>([]);
  filteredPromotions = signal<Promotion[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  searchTerm = signal<string>('');

  // Modal
  isModalOpen = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  editingId = signal<string | null>(null);
  isSaving = signal<boolean>(false);
  modalError = signal<string | null>(null);

  promotionForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private promotionService: PromocionService,
    public authService: AutenticacionService,
  ) {
    this.promotionForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      discount_percent: [null, [Validators.required, Validators.min(1), Validators.max(100)]],
      description: [''],
      start_date: ['', [Validators.required]],
      end_date: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.loadPromotions();
    const productId = this.route?.snapshot.queryParamMap.get('suggestion');
    if (productId && this.authService.currentUser()?.role === 'ADMIN') {
      this.promotionService.suggestDiscounts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: rows => {
          const suggestion = rows.find(row => row.product_id === productId);
          if (suggestion) this.useSuggestion(suggestion);
          else this.errorMessage.set('La sugerencia ya no está disponible. Actualiza los descuentos sugeridos.');
        },
        error: () => this.errorMessage.set('No se pudo preparar la sugerencia. Vuelve a Descuentos sugeridos e inténtalo de nuevo.'),
      });
    }
  }

  loadPromotions(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.promotionService.getPromotions().subscribe({
      next: (data) => {
        this.promotions.set(data);
        this.applyFilter();
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.error?.detail || 'Error al cargar las promociones');
      },
    });
  }

  onSearchChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value || '';
    this.searchTerm.set(val);
    this.applyFilter();
  }

  applyFilter(): void {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) {
      this.filteredPromotions.set(this.promotions());
      return;
    }
    const filtered = this.promotions().filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.description && p.description.toLowerCase().includes(term)),
    );
    this.filteredPromotions.set(filtered);
  }

  openCreateModal(): void {
    this.draft.set(null);
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.modalError.set(null);
    this.promotionForm.reset({
      name: '',
      discount_percent: null,
      description: '',
      start_date: '',
      end_date: '',
    });
    this.isModalOpen.set(true);
  }

  openEditModal(promotion: Promotion): void {
    this.draft.set(null);
    this.isEditMode.set(true);
    this.editingId.set(promotion.id);
    this.modalError.set(null);
    this.promotionForm.patchValue({
      name: promotion.name,
      discount_percent: promotion.discount_percent,
      description: promotion.description || '',
      start_date: promotion.start_date,
      end_date: promotion.end_date,
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    if (this.isSaving()) return;
    this.isModalOpen.set(false);
    this.modalError.set(null);
  }

  suggestDiscounts(): void {
    if (this.suggesting()) return;
    this.showSuggestions.set(true);
    this.suggesting.set(true);
    this.suggestionError.set('');
    this.suggestions.set([]);
    this.promotionService
      .suggestDiscounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.suggestions.set(rows);
          this.suggesting.set(false);
        },
        error: (err) => {
          this.suggestionError.set(
            err?.error?.detail ||
              'No se pudieron calcular los descuentos. Conéctate y vuelve a intentar.',
          );
          this.suggesting.set(false);
        },
      });
  }

  useSuggestion(suggestion: DiscountSuggestion): void {
    this.openCreateModal();
    this.draft.set(suggestion);
    this.promotionForm.patchValue({
      name: suggestion.name,
      description: suggestion.description,
      discount_percent: suggestion.discount_percent,
      start_date: suggestion.start_date,
      end_date: suggestion.end_date,
    });
  }

  save(): void {
    if (this.isSaving()) return;
    if (this.promotionForm.invalid) {
      this.promotionForm.markAllAsTouched();
      const invalidFields: string[] = [];
      const c = this.promotionForm.controls;
      if (c['name'].invalid) invalidFields.push('Nombre de la Promoción (requerido)');
      if (c['discount_percent'].invalid)
        invalidFields.push('Porcentaje de Descuento (debe ser de 1 a 100%)');
      if (c['start_date'].invalid) invalidFields.push('Fecha de Inicio (requerida)');
      if (c['end_date'].invalid) invalidFields.push('Fecha de Fin (requerida)');
      this.modalError.set(
        `No se puede guardar: Corrige los siguientes campos obligatorios:\n• ${invalidFields.join('\n• ')}`,
      );
      return;
    }

    const val = { ...this.promotionForm.value };
    if (this.draft() && !this.isEditMode()) val.product_ids = [this.draft()!.product_id];
    const cleanName = (val.name || '').trim();

    if (!cleanName) {
      this.modalError.set(
        'El nombre de la promoción no puede estar en blanco ni contener solo espacios.',
      );
      return;
    }

    // Validación de duplicados en cliente
    const isDuplicate = this.promotions().some(
      (p) => p.name.toLowerCase() === cleanName.toLowerCase() && p.id !== this.editingId(),
    );
    if (isDuplicate) {
      this.modalError.set(
        `Ya existe una promoción registrada con el nombre "${cleanName}". Por favor ingresa otro nombre.`,
      );
      return;
    }

    // Validación de porcentaje
    const discount = Number(val.discount_percent);
    if (isNaN(discount) || discount <= 0 || discount > 100) {
      this.modalError.set('El porcentaje de descuento debe ser un valor numérico entre 1% y 100%.');
      return;
    }
    val.discount_percent = discount;

    // Validación de fechas
    if (val.end_date < val.start_date) {
      this.modalError.set(
        'La fecha de fin no puede ser anterior a la fecha de inicio de la promoción.',
      );
      return;
    }

    if (!val.description || !val.description.trim()) {
      delete val.description;
    } else {
      val.description = val.description.trim();
    }

    this.isSaving.set(true);
    this.modalError.set(null);
    this.errorMessage.set(null);

    if (this.isEditMode()) {
      this.promotionService.updatePromotion(this.editingId()!, val).subscribe({
        next: () => {
          this.isSaving.set(false);
          try {
            this.closeModal();
            this.showSuccess('Promoción actualizada correctamente');
            this.loadPromotions();
          } catch (e) {
            console.error('Error al actualizar lista de promociones:', e);
          }
        },
        error: (err) => {
          this.isSaving.set(false);
          this.modalError.set(err?.error?.detail || 'Error al actualizar la promoción');
        },
      });
    } else {
      this.promotionService.createPromotion(val).subscribe({
        next: () => {
          this.isSaving.set(false);
          try {
            this.closeModal();
            this.showSuccess(
              this.draft()
                ? 'Promoción guardada para la prenda seleccionada. Si no hay conexión, su aplicación queda pendiente de sincronizar.'
                : 'Promoción creada exitosamente',
            );
            if (this.showSuggestions()) this.suggestDiscounts();
            this.loadPromotions();
          } catch (e) {
            console.error('Error al actualizar lista de promociones:', e);
          }
        },
        error: (err) => {
          this.isSaving.set(false);
          this.modalError.set(err?.error?.detail || 'Error al crear la promoción');
        },
      });
    }
  }

  togglePromotionStatus(promotion: Promotion): void {
    const action = promotion.is_active ? 'desactivar' : 'activar';
    if (!confirm(`¿Deseas ${action} la promoción "${promotion.name}"?`)) return;

    this.errorMessage.set(null);
    this.promotionService.togglePromotionStatus(promotion.id).subscribe({
      next: (updated) => {
        try {
          this.showSuccess(
            `Promoción "${updated.name}" ${updated.is_active ? 'activada' : 'desactivada'}`,
          );
          this.loadPromotions();
        } catch (e) {
          console.error('Error en recarga tras cambio de estado:', e);
        }
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Error al cambiar el estado');
      },
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-BO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  getDaysRemaining(endDate: string): number {
    const end = new Date(endDate + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 4000);
  }
}
