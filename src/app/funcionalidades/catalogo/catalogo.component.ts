import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  CatalogFilterOptions,
  CatalogProduct,
} from '../../nucleo/modelos/catalogo.model';
import { CatalogProductFilters, CatalogoService } from '../../nucleo/servicios/catalogo.service';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalogo.component.html',
  styleUrls: ['./catalogo.component.css'],
})
export class CatalogoComponent implements OnInit {
  readonly auth = inject(AutenticacionService);
  private readonly http = inject(HttpClient);
  readonly reserving = signal(false);
  readonly reservationMessage = signal('');
  reservationVariant = '';
  reservationQuantity = 1;
  reserve(): void {
    const user = this.auth.currentUser(), product = this.selectedProduct();
    if (this.reserving() || user?.role !== 'CUSTOMER' || !product || !user.branch_id) return;
    const variant = product.variants.find(v => v.id === this.reservationVariant);
    const available = variant?.branch_availability.find(b => b.branch_id === user.branch_id)?.quantity || 0;
    if (!variant || !Number.isInteger(this.reservationQuantity) || this.reservationQuantity < 1 || this.reservationQuantity > available) {
      this.reservationMessage.set('Selecciona una variante y una cantidad disponible en tu sucursal.');
      return;
    }
    this.reserving.set(true);
    this.http.post<any>(environment.apiUrl + '/reservations', { branch_id: user.branch_id, items: [{ variant_id: variant.id, quantity: this.reservationQuantity }] })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => {
          this.reserving.set(false);
          this.reservationMessage.set(result.sync_status === 'PENDING' ? 'Reserva guardada en este dispositivo. Pendiente de confirmar disponibilidad al recuperar conexión.' : 'Reserva confirmada por el servidor.');
          this.loadProducts();
          this.loadProductDetail(product.id);
        },
        error: error => { this.reserving.set(false); this.reservationMessage.set(error.error?.detail || 'No se pudo guardar la reserva.'); },
      });
  }
  private readonly destroyRef = inject(DestroyRef);
  private productsRequest?: Subscription;
  private detailRequest?: Subscription;
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
    private catalogService: CatalogoService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.catalogService.getFilterOptions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (options) => this.filters.set(options),
      error: () => this.error.set('No se pudieron cargar los filtros del catálogo.'),
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const productId = params.get('product');
      if (productId) {
        this.loadProductDetail(productId);
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

    this.productsRequest?.unsubscribe();
    this.productsRequest = this.catalogService.getProducts(request)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    this.reservationVariant = '';
    this.reservationQuantity = 1;
    this.reservationMessage.set('');
    this.loadProductDetail(product.id);
  }

  private loadProductDetail(id: string): void {
    this.detailRequest?.unsubscribe();
    this.detailRequest = this.catalogService.getProduct(id)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (detail) => this.selectedProduct.set(detail),
      error: () => this.error.set('No se pudo cargar el detalle de la prenda.'),
    });
  }

  closeProduct(): void {
    this.detailRequest?.unsubscribe();
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
