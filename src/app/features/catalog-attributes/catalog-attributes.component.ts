import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CatalogAttributeService } from '../../core/services/catalog-attribute.service';
import { AuthService } from '../../core/services/auth.service';
import {
  Category,
  Size,
  Color,
} from '../../core/models/catalog-attribute.model';

type ActiveTab = 'categories' | 'sizes' | 'colors';

@Component({
  selector: 'app-catalog-attributes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './catalog-attributes.component.html',
  styleUrls: ['./catalog-attributes.component.css'],
})
export class CatalogAttributesComponent implements OnInit {
  activeTab = signal<ActiveTab>('categories');

  // Categories
  categories = signal<Category[]>([]);
  // Sizes
  sizes = signal<Size[]>([]);
  // Colors
  colors = signal<Color[]>([]);

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Modal
  isModalOpen = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  editingId = signal<string | null>(null);
  isSaving = signal<boolean>(false);
  modalError = signal<string | null>(null);

  categoryForm: FormGroup;
  sizeForm: FormGroup;
  colorForm: FormGroup;

  readonly categoryTypes = [
    'Ropa Superior',
    'Ropa Inferior',
    'Calzado',
    'Accesorios',
    'General',
  ];

  constructor(
    private fb: FormBuilder,
    private catalogService: CatalogAttributeService,
    public authService: AuthService
  ) {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
    });

    this.sizeForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1)]],
      code: ['', [Validators.required, Validators.minLength(1)]],
      category_type: [''],
    });

    this.colorForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      hex_code: ['#000000', [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]],
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  switchTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    switch (this.activeTab()) {
      case 'categories':
        this.catalogService.getCategories().subscribe({
          next: (data) => {
            this.categories.set(data);
            this.isLoading.set(false);
          },
          error: (err) => {
            this.isLoading.set(false);
            this.errorMessage.set(err?.error?.detail || 'Error al cargar categorías');
          },
        });
        break;
      case 'sizes':
        this.catalogService.getSizes().subscribe({
          next: (data) => {
            this.sizes.set(data);
            this.isLoading.set(false);
          },
          error: (err) => {
            this.isLoading.set(false);
            this.errorMessage.set(err?.error?.detail || 'Error al cargar tallas');
          },
        });
        break;
      case 'colors':
        this.catalogService.getColors().subscribe({
          next: (data) => {
            this.colors.set(data);
            this.isLoading.set(false);
          },
          error: (err) => {
            this.isLoading.set(false);
            this.errorMessage.set(err?.error?.detail || 'Error al cargar colores');
          },
        });
        break;
    }
  }

  // --- Modal Management ---
  openCreateModal(): void {
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.modalError.set(null);

    if (this.activeTab() === 'categories') {
      this.categoryForm.reset({ name: '', description: '' });
    } else if (this.activeTab() === 'sizes') {
      this.sizeForm.reset({ name: '', code: '', category_type: '' });
    } else {
      this.colorForm.reset({ name: '', hex_code: '#000000' });
    }
    this.isModalOpen.set(true);
  }

  openEditCategory(cat: Category): void {
    this.activeTab.set('categories');
    this.isEditMode.set(true);
    this.editingId.set(cat.id);
    this.modalError.set(null);
    this.categoryForm.patchValue({ name: cat.name, description: cat.description || '' });
    this.isModalOpen.set(true);
  }

  openEditSize(size: Size): void {
    this.activeTab.set('sizes');
    this.isEditMode.set(true);
    this.editingId.set(size.id);
    this.modalError.set(null);
    this.sizeForm.patchValue({
      name: size.name,
      code: size.code,
      category_type: size.category_type || '',
    });
    this.isModalOpen.set(true);
  }

  openEditColor(color: Color): void {
    this.activeTab.set('colors');
    this.isEditMode.set(true);
    this.editingId.set(color.id);
    this.modalError.set(null);
    this.colorForm.patchValue({ name: color.name, hex_code: color.hex_code });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.modalError.set(null);
  }

  // --- Save ---
  save(): void {
    this.isSaving.set(true);
    this.modalError.set(null);

    if (this.activeTab() === 'categories') {
      this.saveCategory();
    } else if (this.activeTab() === 'sizes') {
      this.saveSize();
    } else {
      this.saveColor();
    }
  }

  private saveCategory(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      this.isSaving.set(false);
      return;
    }
    const val = this.categoryForm.value;

    if (this.isEditMode()) {
      this.catalogService.updateCategory(this.editingId()!, val).subscribe({
        next: () => this.onSaveSuccess('Categoría actualizada correctamente'),
        error: (err) => this.onSaveError(err),
      });
    } else {
      this.catalogService.createCategory(val).subscribe({
        next: () => this.onSaveSuccess('Categoría creada exitosamente'),
        error: (err) => this.onSaveError(err),
      });
    }
  }

  private saveSize(): void {
    if (this.sizeForm.invalid) {
      this.sizeForm.markAllAsTouched();
      this.isSaving.set(false);
      return;
    }
    const val = this.sizeForm.value;
    if (!val.category_type) {
      delete val.category_type;
    }

    if (this.isEditMode()) {
      this.catalogService.updateSize(this.editingId()!, val).subscribe({
        next: () => this.onSaveSuccess('Talla actualizada correctamente'),
        error: (err) => this.onSaveError(err),
      });
    } else {
      this.catalogService.createSize(val).subscribe({
        next: () => this.onSaveSuccess('Talla creada exitosamente'),
        error: (err) => this.onSaveError(err),
      });
    }
  }

  private saveColor(): void {
    if (this.colorForm.invalid) {
      this.colorForm.markAllAsTouched();
      this.isSaving.set(false);
      return;
    }
    const val = this.colorForm.value;

    if (this.isEditMode()) {
      this.catalogService.updateColor(this.editingId()!, val).subscribe({
        next: () => this.onSaveSuccess('Color actualizado correctamente'),
        error: (err) => this.onSaveError(err),
      });
    } else {
      this.catalogService.createColor(val).subscribe({
        next: () => this.onSaveSuccess('Color creado exitosamente'),
        error: (err) => this.onSaveError(err),
      });
    }
  }

  private onSaveSuccess(msg: string): void {
    this.isSaving.set(false);
    this.closeModal();
    this.showSuccess(msg);
    this.loadData();
  }

  private onSaveError(err: any): void {
    this.isSaving.set(false);
    this.modalError.set(err?.error?.detail || 'Error al guardar');
  }

  // --- Toggle Status ---
  toggleCategoryStatus(cat: Category): void {
    const action = cat.is_active ? 'desactivar' : 'activar';
    if (!confirm(`¿Deseas ${action} la categoría "${cat.name}"?`)) return;
    this.catalogService.toggleCategoryStatus(cat.id).subscribe({
      next: () => {
        this.showSuccess(`Categoría "${cat.name}" ${cat.is_active ? 'desactivada' : 'activada'}`);
        this.loadData();
      },
      error: (err) => this.errorMessage.set(err?.error?.detail || 'Error al cambiar estado'),
    });
  }

  toggleSizeStatus(size: Size): void {
    const action = size.is_active ? 'desactivar' : 'activar';
    if (!confirm(`¿Deseas ${action} la talla "${size.name}"?`)) return;
    this.catalogService.toggleSizeStatus(size.id).subscribe({
      next: () => {
        this.showSuccess(`Talla "${size.name}" ${size.is_active ? 'desactivada' : 'activada'}`);
        this.loadData();
      },
      error: (err) => this.errorMessage.set(err?.error?.detail || 'Error al cambiar estado'),
    });
  }

  toggleColorStatus(color: Color): void {
    const action = color.is_active ? 'desactivar' : 'activar';
    if (!confirm(`¿Deseas ${action} el color "${color.name}"?`)) return;
    this.catalogService.toggleColorStatus(color.id).subscribe({
      next: () => {
        this.showSuccess(`Color "${color.name}" ${color.is_active ? 'desactivado' : 'activado'}`);
        this.loadData();
      },
      error: (err) => this.errorMessage.set(err?.error?.detail || 'Error al cambiar estado'),
    });
  }

  getModalTitle(): string {
    const prefix = this.isEditMode() ? 'Editar' : 'Nueva';
    switch (this.activeTab()) {
      case 'categories':
        return `${prefix} Categoría`;
      case 'sizes':
        return `${prefix} Talla`;
      case 'colors':
        return `${this.isEditMode() ? 'Editar' : 'Nuevo'} Color`;
    }
  }

  showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 4000);
  }
}
