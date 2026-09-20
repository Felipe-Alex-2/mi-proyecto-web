import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  CatalogFilterOptions,
  CatalogProduct,
} from '../../core/models/catalog.model';
import { CatalogProductFilters, CatalogService } from '../../core/services/catalog.service';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './catalog.component.html',
  styleUrls: ['./catalog.component.css'],
})
export class CatalogComponent implements OnInit {
  filters = signal<CatalogFilterOptions | null>(null);
  products = signal<CatalogProduct[]>([]);
  selectedProduct = signal<CatalogProduct | null>(null);
  loading = signal(true);
  error = signal('');
  search = '';
  categoryId = '';
  sizeId = '';
  colorId = '';
  seasonId = '';
  gender = '';
  branchId = '';
  sortBy = 'newest';
  page = 1;
  pageSize = 12;
  total = signal(0);

  constructor(
    private catalogService: CatalogService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.catalogService.getFilterOptions().subscribe({
      next: (options) => this.filters.set(options),
      error: () => this.error.set('No se pudieron cargar los filtros del catálogo.'),
    });
    this.route.queryParamMap.subscribe((params) => {
      const productId = params.get('product');
      if (productId) {
        this.catalogService.getProduct(productId).subscribe({
          next: (product) => this.selectedProduct.set(product),
          error: () => this.error.set('No se pudo cargar el detalle de la recomendación.'),
        });
      }
    });
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading.set(true);
    this.error.set('');
    const request: CatalogProductFilters = {
      search: this.search.trim() || undefined,
      categoryId: this.categoryId || undefined,
      sizeId: this.sizeId || undefined,
      colorId: this.colorId || undefined,
      seasonId: this.seasonId || undefined,
      gender: this.gender || undefined,
      branchId: this.branchId || undefined,
      sortBy: this.sortBy,
      page: this.page,
      pageSize: this.pageSize,
    };

    this.catalogService.getProducts(request).subscribe({
      next: (response) => {
        this.products.set(response.items);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el catálogo. Verifica tu sesión e inténtalo de nuevo.');
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadProducts();
  }

  clearFilters(): void {
    this.search = '';
    this.categoryId = '';
    this.sizeId = '';
    this.colorId = '';
    this.seasonId = '';
    this.gender = '';
    this.branchId = '';
    this.sortBy = 'newest';
    this.applyFilters();
  }

  openProduct(product: CatalogProduct): void {
    this.catalogService.getProduct(product.id).subscribe({
      next: (detail) => this.selectedProduct.set(detail),
      error: () => this.error.set('No se pudo cargar el detalle de la prenda.'),
    });
  }

  closeProduct(): void {
    this.selectedProduct.set(null);
  }

  previousPage(): void {
    if (this.page > 1) {
      this.page -= 1;
      this.loadProducts();
    }
  }

  nextPage(): void {
    if (this.page < this.pageCount) {
      this.page += 1;
      this.loadProducts();
    }
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  stockLabel(stock: number): string {
    return stock > 0 ? `${stock} disponibles` : 'Agotado';
  }
}
