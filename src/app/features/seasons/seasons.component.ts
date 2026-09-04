import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SeasonService } from '../../core/services/season.service';
import { AuthService } from '../../core/services/auth.service';
import { Season } from '../../core/models/season.model';

@Component({
  selector: 'app-seasons',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './seasons.component.html',
  styleUrls: ['./seasons.component.css'],
})
export class SeasonsComponent implements OnInit {
  seasons = signal<Season[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Modal
  isModalOpen = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  editingId = signal<string | null>(null);
  isSaving = signal<boolean>(false);
  modalError = signal<string | null>(null);

  seasonForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private seasonService: SeasonService,
    public authService: AuthService
  ) {
    this.seasonForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      start_date: ['', [Validators.required]],
      end_date: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.loadSeasons();
  }

  loadSeasons(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.seasonService.getSeasons().subscribe({
      next: (data) => {
        this.seasons.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.error?.detail || 'Error al cargar las temporadas');
      },
    });
  }

  openCreateModal(): void {
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.modalError.set(null);
    this.seasonForm.reset({ name: '', description: '', start_date: '', end_date: '' });
    this.isModalOpen.set(true);
  }

  openEditModal(season: Season): void {
    this.isEditMode.set(true);
    this.editingId.set(season.id);
    this.modalError.set(null);
    this.seasonForm.patchValue({
      name: season.name,
      description: season.description || '',
      start_date: season.start_date,
      end_date: season.end_date,
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.modalError.set(null);
  }

  save(): void {
    if (this.seasonForm.invalid) {
      this.seasonForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.modalError.set(null);

    const val = this.seasonForm.value;
    if (!val.description) {
      delete val.description;
    }

    if (this.isEditMode()) {
      this.seasonService.updateSeason(this.editingId()!, val).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeModal();
          this.showSuccess('Temporada actualizada correctamente');
          this.loadSeasons();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.modalError.set(err?.error?.detail || 'Error al actualizar');
        },
      });
    } else {
      this.seasonService.createSeason(val).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeModal();
          this.showSuccess('Temporada creada exitosamente');
          this.loadSeasons();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.modalError.set(err?.error?.detail || 'Error al crear la temporada');
        },
      });
    }
  }

  toggleSeasonStatus(season: Season): void {
    const action = season.is_active ? 'desactivar' : 'activar';
    if (!confirm(`¿Deseas ${action} la temporada "${season.name}"?`)) return;

    this.seasonService.toggleSeasonStatus(season.id).subscribe({
      next: (updated) => {
        this.showSuccess(
          `Temporada "${updated.name}" ${updated.is_active ? 'activada' : 'desactivada'}`
        );
        this.loadSeasons();
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
