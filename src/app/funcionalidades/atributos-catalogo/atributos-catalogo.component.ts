import { EstadoLocalComponent } from '../../nucleo/componentes/estado-local.component';
import { catchError, forkJoin, of, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { sinEspaciosVaciosValidator, longitudMinimaSinEspacios } from '../../nucleo/validadores/validadores-personalizados';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AtributoCatalogoService } from '../../nucleo/servicios/atributo-catalogo.service';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import {
  Category,
  Size,
  Color,
} from '../../nucleo/modelos/atributo-catalogo.model';

type ActiveTab = 'categories' | 'sizes' | 'colors';

@Component({
  selector: 'app-catalog-attributes',
  standalone: true,
  imports: [EstadoLocalComponent, CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './atributos-catalogo.component.html',
  styleUrls: ['./atributos-catalogo.component.css'],
})
export class AtributosCatalogoComponent implements OnInit {
  activeTab = signal<ActiveTab>('categories');
  private readonly destroyRef = inject(DestroyRef);
  private dataRequest?: Subscription;
  loaded = signal<Record<ActiveTab, boolean>>({ categories: false, sizes: false, colors: false });
  loadErrors = signal<Record<ActiveTab, string>>({ categories: '', sizes: '', colors: '' });

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
    private catalogService: AtributoCatalogoService,
    public authService: AutenticacionService
  ) {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, longitudMinimaSinEspacios(2), sinEspaciosVaciosValidator()]],
      description: [''],
    });

    this.sizeForm = this.fb.group({
      name: ['', [Validators.required, longitudMinimaSinEspacios(1), sinEspaciosVaciosValidator()]],
      code: ['', [Validators.required, longitudMinimaSinEspacios(1), sinEspaciosVaciosValidator()]],
      category_type: [''],
    });

    this.colorForm = this.fb.group({
      name: ['', [Validators.required, longitudMinimaSinEspacios(2), sinEspaciosVaciosValidator()]],
      hex_code: ['#000000', [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]],
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  switchTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    this.errorMessage.set(this.loadErrors()[tab] || null);
  }

  countLabel(tab: ActiveTab): number | string {
    if (!this.loaded()[tab]) return this.loadErrors()[tab] ? '—' : '…';
    return { categories: this.categories(), sizes: this.sizes(), colors: this.colors() }[tab].length;
  }

  loadData(): void {
    this.dataRequest?.unsubscribe();
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.loadErrors.set({ categories: '', sizes: '', colors: '' });
    const handleError = (tab: ActiveTab, message: string) => (err: any) => {
      this.loadErrors.update(errors => ({ ...errors, [tab]: err?.error?.detail || message }));
      return of(null);
    };
    this.dataRequest = forkJoin({
      categories: this.catalogService.getCategories().pipe(catchError(handleError('categories', 'Error al cargar categorías'))),
      sizes: this.catalogService.getSizes().pipe(catchError(handleError('sizes', 'Error al cargar tallas'))),
      colors: this.catalogService.getColors().pipe(catchError(handleError('colors', 'Error al cargar colores'))),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      if (data.categories !== null) this.categories.set(data.categories);
      if (data.sizes !== null) this.sizes.set(data.sizes);
      if (data.colors !== null) this.colors.set(data.colors);
      this.loaded.set({ categories: data.categories !== null, sizes: data.sizes !== null, colors: data.colors !== null });
      this.errorMessage.set(this.loadErrors()[this.activeTab()] || null);
      this.isLoading.set(false);
    });
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
    this.errorMessage.set(null);

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
      this.modalError.set('No se puede guardar: El nombre de la categoría es obligatorio.');
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
      const missing: string[] = [];
      if (this.sizeForm.controls['name'].invalid) missing.push('Nombre de la Talla');
      if (this.sizeForm.controls['code'].invalid) missing.push('Código/Abreviatura');
      this.modalError.set(`No se puede guardar: Completa los campos obligatorios (${missing.join(', ')}).`);
      this.isSaving.set(false);
      return;
    }
    const val = this.sizeForm.value;

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
      const missing: string[] = [];
      if (this.colorForm.controls['name'].invalid) missing.push('Nombre del Color');
      if (this.colorForm.controls['hex_code'].invalid) missing.push('Código Hexadecimal (ej. #FFFFFF)');
      this.modalError.set(`No se puede guardar: Completa los campos obligatorios (${missing.join(', ')}).`);
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
    try {
      this.closeModal();
      this.showSuccess(msg);
      this.loadData();
    } catch (e) {
      console.error('Error al recargar catálogo tras guardar:', e);
    }
  }

  private onSaveError(err: any): void {
    this.isSaving.set(false);
    this.modalError.set(err?.error?.detail || 'Error al guardar');
  }

  // --- Toggle Status ---
  toggleCategoryStatus(cat: Category): void {
    const action = cat.is_active ? 'desactivar' : 'activar';
    if (!confirm(`¿Deseas ${action} la categoría "${cat.name}"?`)) return;
    this.errorMessage.set(null);
    this.catalogService.toggleCategoryStatus(cat.id).subscribe({
      next: () => {
        try {
          this.showSuccess(`Categoría "${cat.name}" ${cat.is_active ? 'desactivada' : 'activada'}`);
          this.loadData();
        } catch (e) {
          console.error(e);
        }
      },
      error: (err) => this.errorMessage.set(err?.error?.detail || 'Error al cambiar estado'),
    });
  }

  toggleSizeStatus(size: Size): void {
    const action = size.is_active ? 'desactivar' : 'activar';
    if (!confirm(`¿Deseas ${action} la talla "${size.name}"?`)) return;
    this.errorMessage.set(null);
    this.catalogService.toggleSizeStatus(size.id).subscribe({
      next: () => {
        try {
          this.showSuccess(`Talla "${size.name}" ${size.is_active ? 'desactivada' : 'activada'}`);
          this.loadData();
        } catch (e) {
          console.error(e);
        }
      },
      error: (err) => this.errorMessage.set(err?.error?.detail || 'Error al cambiar estado'),
    });
  }

  toggleColorStatus(color: Color): void {
    const action = color.is_active ? 'desactivar' : 'activar';
    if (!confirm(`¿Deseas ${action} el color "${color.name}"?`)) return;
    this.errorMessage.set(null);
    this.catalogService.toggleColorStatus(color.id).subscribe({
      next: () => {
        try {
          this.showSuccess(`Color "${color.name}" ${color.is_active ? 'desactivado' : 'activado'}`);
          this.loadData();
        } catch (e) {
          console.error(e);
        }
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
