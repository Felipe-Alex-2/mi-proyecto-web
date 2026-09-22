import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PromotionService } from '../../core/services/promotion.service';
import { AuthService } from '../../core/services/auth.service';
import { Promotion } from '../../core/models/promotion.model';

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './promotions.component.html',
  styleUrls: ['./promotions.component.css'],
})
export class PromotionsComponent implements OnInit {
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
    private promotionService: PromotionService,
    public authService: AuthService
  ) {
    this.promotionForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      discount_percent: [
        null,
        [Validators.required, Validators.min(1), Validators.max(100)],
      ],
      description: [''],
      start_date: ['', [Validators.required]],
      end_date: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.loadPromotions();
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
        (p.description && p.description.toLowerCase().includes(term))
    );
    this.filteredPromotions.set(filtered);
  }

  openCreateModal(): void {
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
    this.isModalOpen.set(false);
    this.modalError.set(null);
  }

  save(): void {
    if (this.promotionForm.invalid) {
      this.promotionForm.markAllAsTouched();
      this.modalError.set('Por favor completa todos los campos requeridos con datos válidos.');
      return;
    }

    const val = { ...this.promotionForm.value };
    const cleanName = (val.name || '').trim();

    if (!cleanName) {
      this.modalError.set('El nombre de la promoción no puede estar en blanco.');
      return;
    }

    // Validación de duplicados en cliente
    const isDuplicate = this.promotions().some(
      (p) =>
        p.name.toLowerCase() === cleanName.toLowerCase() &&
        p.id !== this.editingId()
    );
    if (isDuplicate) {
      this.modalError.set(`Ya existe una promoción con el nombre "${cleanName}".`);
      return;
    }

    // Validación de porcentaje
    const discount = Number(val.discount_percent);
    if (isNaN(discount) || discount <= 0 || discount > 100) {
      this.modalError.set('El porcentaje de descuento debe ser un número entre 1 y 100.');
      return;
    }
    val.discount_percent = discount;

    // Validación de fechas
    if (val.end_date < val.start_date) {
      this.modalError.set('La fecha de fin no puede ser anterior a la fecha de inicio.');
      return;
    }

    if (!val.description || !val.description.trim()) {
      delete val.description;
    } else {
      val.description = val.description.trim();
    }

    this.isSaving.set(true);
    this.modalError.set(null);

    if (this.isEditMode()) {
      this.promotionService.updatePromotion(this.editingId()!, val).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeModal();
          this.showSuccess('Promoción actualizada correctamente');
          this.loadPromotions();
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
          this.closeModal();
          this.showSuccess('Promoción creada exitosamente');
          this.loadPromotions();
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

    this.promotionService.togglePromotionStatus(promotion.id).subscribe({
      next: (updated) => {
        this.showSuccess(
          `Promoción "${updated.name}" ${updated.is_active ? 'activada' : 'desactivada'}`
        );
        this.loadPromotions();
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
