import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { CatalogAttributeService } from '../../core/services/catalog-attribute.service';
import { SeasonService } from '../../core/services/season.service';
import { SupplierService } from '../../core/services/supplier.service';
import { BranchService } from '../../core/services/branch.service';
import { StockService } from '../../core/services/stock.service';
import { AuthService } from '../../core/services/auth.service';
import { Product, ProductCreate, ProductUpdate, VariantCreate } from '../../core/models/product.model';
import { Category, Color, Size } from '../../core/models/catalog-attribute.model';
import { Season } from '../../core/models/season.model';
import { Supplier } from '../../core/models/supplier.model';
import { Branch } from '../../core/models/branch.model';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css'],
})
export class ProductsComponent implements OnInit {
  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  sizes = signal<Size[]>([]);
  colors = signal<Color[]>([]);
  seasons = signal<Season[]>([]);
  suppliers = signal<Supplier[]>([]);
  branches = signal<Branch[]>([]);

  // Filters & State
  selectedCategory = signal<string>('');
  searchQuery = signal<string>('');
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Modal Create / Edit
  isModalOpen = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  editingId = signal<string | null>(null);
  isSaving = signal<boolean>(false);
  modalError = signal<string | null>(null);

  productForm: FormGroup;
  selectedSizeIds = signal<string[]>([]);
  selectedColorIds = signal<string[]>([]);
  initialStockMap = signal<Record<string, number>>({}); // key: `${sizeId}_${colorId}_${branchId}` -> qty

  // Modal Stock Management
  isStockModalOpen = signal<boolean>(false);
  selectedProductForStock = signal<Product | null>(null);
  selectedBranchForStock = signal<string>('');
  stockUpdateMap = signal<Record<string, number>>({}); // variantId -> qty
  isUpdatingStock = signal<boolean>(false);
  stockModalError = signal<string | null>(null);

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private catalogService: CatalogAttributeService,
    private seasonService: SeasonService,
    private supplierService: SupplierService,
    private branchService: BranchService,
    private stockService: StockService,
    public authService: AuthService
  ) {
    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
      description: [''],
      price: [null, [Validators.required, Validators.min(0.01)]],
      category_id: ['', Validators.required],
      season_id: [''],
      supplier_id: [''],
      image_url: [''],
      gender: ['UNISEX', Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadCatalogMasters();
    this.loadProducts();
  }

  loadCatalogMasters(): void {
    this.catalogService.getCategories().subscribe({
      next: (data) => this.categories.set(data.filter((c) => c.is_active)),
    });
    this.catalogService.getSizes().subscribe({
      next: (data) => this.sizes.set(data.filter((s) => s.is_active)),
    });
    this.catalogService.getColors().subscribe({
      next: (data) => this.colors.set(data.filter((c) => c.is_active)),
    });
    this.seasonService.getSeasons().subscribe({
      next: (data) => this.seasons.set(data.filter((s) => s.is_active)),
    });
    this.supplierService.getSuppliers().subscribe({
      next: (data) => this.suppliers.set(data.filter((s) => s.is_active)),
    });
    this.branchService.getBranches().subscribe({
      next: (data) => {
        const activeBranches = data.filter((b) => b.is_active);
        this.branches.set(activeBranches);
        if (activeBranches.length > 0 && !this.selectedBranchForStock()) {
          this.selectedBranchForStock.set(activeBranches[0].id);
        }
      },
    });
  }

  loadProducts(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const filters: any = {};
    if (this.selectedCategory()) {
      filters.categoryId = this.selectedCategory();
    }
    if (this.searchQuery().trim()) {
      filters.search = this.searchQuery().trim();
    }

    this.productService.getProducts(filters).subscribe({
      next: (data) => {
        this.products.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Error al cargar las prendas del catálogo');
        this.isLoading.set(false);
      },
    });
  }

  onCategoryFilter(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedCategory.set(val);
    this.loadProducts();
  }

  onSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchQuery.set(val);
    this.loadProducts();
  }

  // Variant helpers
  toggleSize(sizeId: string): void {
    const current = this.selectedSizeIds();
    if (current.includes(sizeId)) {
      this.selectedSizeIds.set(current.filter((id) => id !== sizeId));
    } else {
      this.selectedSizeIds.set([...current, sizeId]);
    }
  }

  toggleColor(colorId: string): void {
    const current = this.selectedColorIds();
    if (current.includes(colorId)) {
      this.selectedColorIds.set(current.filter((id) => id !== colorId));
    } else {
      this.selectedColorIds.set([...current, colorId]);
    }
  }

  getSizeName(sizeId: string): string {
    const s = this.sizes().find((item) => item.id === sizeId);
    return s ? `${s.name} (${s.code})` : sizeId;
  }

  getColorObj(colorId: string): Color | undefined {
    return this.colors().find((item) => item.id === colorId);
  }

  setInitialStock(sizeId: string, colorId: string, branchId: string, event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10) || 0;
    const key = `${sizeId}_${colorId}_${branchId}`;
    const map = { ...this.initialStockMap() };
    map[key] = val;
    this.initialStockMap.set(map);
  }

  getInitialStockVal(sizeId: string, colorId: string, branchId: string): number {
    const key = `${sizeId}_${colorId}_${branchId}`;
    return this.initialStockMap()[key] || 0;
  }

  // Modals
  openCreateModal(): void {
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.modalError.set(null);
    this.productForm.reset({ gender: 'UNISEX' });
    this.selectedSizeIds.set([]);
    this.selectedColorIds.set([]);
    this.initialStockMap.set({});
    this.isModalOpen.set(true);
  }

  openEditModal(product: Product): void {
    this.isEditMode.set(true);
    this.editingId.set(product.id);
    this.modalError.set(null);
    this.productForm.patchValue({
      name: product.name,
      description: product.description || '',
      price: product.price,
      category_id: product.category_id,
      season_id: product.season_id || '',
      supplier_id: product.supplier_id || '',
      image_url: product.image_url || '',
      gender: product.gender,
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.modalError.set(null);
    this.productForm.reset();
  }

  saveProduct(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    if (!this.isEditMode()) {
      if (this.selectedSizeIds().length === 0 || this.selectedColorIds().length === 0) {
        this.modalError.set('Debes seleccionar al menos una Talla y un Color para generar variantes');
        return;
      }
    }

    this.isSaving.set(true);
    this.modalError.set(null);

    const f = this.productForm.value;

    if (this.isEditMode() && this.editingId()) {
      const updatePayload: ProductUpdate = {
        name: f.name.trim(),
        description: f.description?.trim() || undefined,
        price: Number(f.price),
        category_id: f.category_id,
        season_id: f.season_id || undefined,
        supplier_id: f.supplier_id || undefined,
        image_url: f.image_url?.trim() || undefined,
        gender: f.gender,
      };

      this.productService.updateProduct(this.editingId()!, updatePayload).subscribe({
        next: (updated) => {
          this.products.update((list) =>
            list.map((p) => (p.id === updated.id ? updated : p))
          );
          this.isSaving.set(false);
          this.closeModal();
          this.showSuccess(`Prenda "${updated.name}" actualizada con éxito`);
        },
        error: (err) => {
          this.modalError.set(err.error?.detail || 'Error al actualizar prenda');
          this.isSaving.set(false);
        },
      });
    } else {
      // Build variants matrix
      const variants: VariantCreate[] = [];
      for (const sId of this.selectedSizeIds()) {
        for (const cId of this.selectedColorIds()) {
          const initialStock: Record<string, number> = {};
          for (const b of this.branches()) {
            const key = `${sId}_${cId}_${b.id}`;
            const qty = this.initialStockMap()[key] || 0;
            if (qty > 0) {
              initialStock[b.id] = qty;
            }
          }
          variants.push({
            size_id: sId,
            color_id: cId,
            initial_stock: initialStock,
          });
        }
      }

      const createPayload: ProductCreate = {
        name: f.name.trim(),
        description: f.description?.trim() || undefined,
        price: Number(f.price),
        category_id: f.category_id,
        season_id: f.season_id || undefined,
        supplier_id: f.supplier_id || undefined,
        image_url: f.image_url?.trim() || undefined,
        gender: f.gender,
        variants: variants,
      };

      this.productService.createProduct(createPayload).subscribe({
        next: (created) => {
          this.products.update((list) => [created, ...list]);
          this.isSaving.set(false);
          this.closeModal();
          this.showSuccess(`Prenda "${created.name}" creada con ${created.variants.length} variantes y stock inicial`);
        },
        error: (err) => {
          this.modalError.set(err.error?.detail || 'Error al crear la prenda');
          this.isSaving.set(false);
        },
      });
    }
  }

  toggleProductStatus(product: Product): void {
    this.productService.toggleProductStatus(product.id).subscribe({
      next: (updated) => {
        this.products.update((list) =>
          list.map((p) => (p.id === updated.id ? updated : p))
        );
        this.showSuccess(
          `Prenda "${updated.name}" ${updated.is_active ? 'activada' : 'desactivada'} con éxito`
        );
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Error al cambiar estado de la prenda');
      },
    });
  }

  // Stock Modal
  openStockModal(product: Product): void {
    this.selectedProductForStock.set(product);
    this.stockModalError.set(null);
    if (this.branches().length > 0 && !this.selectedBranchForStock()) {
      this.selectedBranchForStock.set(this.branches()[0].id);
    }
    this.syncStockMapWithProduct(product, this.selectedBranchForStock());
    this.isStockModalOpen.set(true);
  }

  closeStockModal(): void {
    this.isStockModalOpen.set(false);
    this.selectedProductForStock.set(null);
  }

  onStockBranchChange(branchId: string): void {
    this.selectedBranchForStock.set(branchId);
    if (this.selectedProductForStock()) {
      this.syncStockMapWithProduct(this.selectedProductForStock()!, branchId);
    }
  }

  syncStockMapWithProduct(product: Product, branchId: string): void {
    const map: Record<string, number> = {};
    for (const v of product.variants) {
      const stockItem = v.stocks.find((s) => s.branch_id === branchId);
      map[v.id] = stockItem ? stockItem.quantity : 0;
    }
    this.stockUpdateMap.set(map);
  }

  onStockQtyInput(variantId: string, event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10) || 0;
    const map = { ...this.stockUpdateMap() };
    map[variantId] = Math.max(0, val);
    this.stockUpdateMap.set(map);
  }

  saveBranchStock(): void {
    const product = this.selectedProductForStock();
    const branchId = this.selectedBranchForStock();
    if (!product || !branchId) return;

    this.isUpdatingStock.set(true);
    this.stockModalError.set(null);

    const updates = Object.entries(this.stockUpdateMap()).map(([variantId, qty]) =>
      this.stockService.adjustStock({
        variant_id: variantId,
        branch_id: branchId,
        quantity: qty,
      })
    );

    // Run sequentially or via forkJoin; since RxJS is available:
    let completed = 0;
    let hasError = false;

    if (updates.length === 0) {
      this.isUpdatingStock.set(false);
      this.closeStockModal();
      return;
    }

    updates.forEach((obs) => {
      obs.subscribe({
        next: () => {
          completed++;
          if (completed === updates.length && !hasError) {
            this.isUpdatingStock.set(false);
            this.closeStockModal();
            this.loadProducts(); // refresh products with updated totals
            this.showSuccess(`Stock actualizado correctamente para la sucursal`);
          }
        },
        error: (err) => {
          hasError = true;
          this.isUpdatingStock.set(false);
          this.stockModalError.set(err.error?.detail || 'Error al ajustar stock');
        },
      });
    });
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => {
      this.successMessage.set(null);
    }, 4500);
  }
}
