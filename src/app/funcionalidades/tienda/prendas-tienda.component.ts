import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CatalogProduct } from '../../nucleo/modelos/catalogo.model';
import { TiendaService } from './tienda.service';

@Component({
  selector: 'app-shop-products',
  standalone: true,
  imports: [CommonModule, RouterLink],
  styleUrls: ['./tienda.css', './prendas-catalogo.component.css'],
  template: ` @if (catalogStyle()) {
      <div class="collection-grid">
        @for (product of products(); track product.id) {
          <article class="collection-card">
            <div class="collection-photo">
              <a
                routerLink="/catalog"
                [queryParams]="{ product: product.id }"
                [attr.aria-label]="'Ver ' + product.name"
              >
                @if (product.image_url) {
                  <img
                    [src]="shop.image(product.image_url)"
                    [alt]="product.name"
                    loading="lazy"
                    (error)="$any($event.target).hidden = true"
                  />
                } @else {
                  <span class="no-photo">Vesta</span>
                }
              </a>
              <div class="collection-tags">
                <span>{{ product.category_name || 'Colección VESTA' }}</span>
                @if (product.gender) {
                  <span>{{ product.gender }}</span>
                }
              </div>
              @if (product.discount_percent) {
                <span class="collection-discount">−{{ product.discount_percent }}% OFF</span>
              }
              <div class="collection-price" [class.discounted]="!!product.discount_percent">
                @if (product.discount_percent) {
                  <s>{{ product.min_price | number: '1.2-2' }} Bs</s>
                }
                <strong>{{ price(product) | number: '1.2-2' }} Bs</strong>
              </div>
            </div>
            <div class="collection-body">
              <div class="collection-title">
                <h3>
                  <a routerLink="/catalog" [queryParams]="{ product: product.id }">{{
                    product.name
                  }}</a>
                </h3>
                <span class="availability" [class.sold-out]="!product.total_stock">{{
                  product.total_stock ? 'Disponible' : 'Agotado'
                }}</span>
              </div>
              <p class="collection-description">
                {{ product.description || 'Descubre esta prenda de nuestra colección.' }}
              </p>
              @if (product.season_name) {
                <p class="collection-season">
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    aria-hidden="true"
                  >
                    <path d="M3 5h14v12H3zM6 3v4m8-4v4M3 9h14" /></svg
                  >{{ product.season_name }}
                </p>
              }
              <div class="collection-variants">
                <div>
                  <span>Colores:</span>
                  <div class="color-list">
                    @for (color of product.colors; track color.name) {
                      <span
                        class="color-dot"
                        [style.background-color]="color.hex || '#e9e1d9'"
                        [title]="color.name"
                        role="img"
                        [attr.aria-label]="color.name"
                      ></span>
                    } @empty {
                      <small>Consultar</small>
                    }
                  </div>
                </div>
                <div>
                  <span>Tallas:</span>
                  <div class="size-list">
                    @for (size of product.sizes; track size.name) {
                      <span>{{ size.code || size.name }}</span>
                    } @empty {
                      <small>Consultar</small>
                    }
                  </div>
                </div>
              </div>
              <div class="collection-stock">
                <span>Disponibilidad en {{ shop.branch()?.name || 'tu sucursal' }}:</span
                ><strong [class.empty-stock]="!product.total_stock"
                  >{{ product.total_stock }} unid. disponibles</strong
                >
              </div>
            </div>
            <footer class="collection-actions">
              <a class="secondary" routerLink="/catalog" [queryParams]="{ product: product.id }"
                >Ver prenda <span aria-hidden="true">↗</span></a
              ><button
                type="button"
                class="collection-favorite"
                [class.saved]="shop.isFavorite(product.id)"
                [disabled]="shop.busy()"
                [attr.aria-label]="
                  (shop.isFavorite(product.id)
                    ? 'Quitar de favoritos: '
                    : 'Guardar en favoritos: ') + product.name
                "
                [attr.aria-pressed]="shop.isFavorite(product.id)"
                (click)="shop.toggleFavorite(product)"
              >
                {{ shop.isFavorite(product.id) ? '♥' : '♡' }}
              </button>
            </footer>
          </article>
        }
      </div>
    } @else {
      <div class="product-grid">
        @for (product of products(); track product.id) {
          <article class="product-card">
            <a
              class="product-photo"
              routerLink="/catalog"
              [queryParams]="{ product: product.id }"
              [attr.aria-label]="'Ver ' + product.name"
            >
              @if (product.image_url) {
                <img
                  [src]="shop.image(product.image_url)"
                  [alt]="product.name"
                  loading="lazy"
                  (error)="$any($event.target).hidden = true"
                />
              } @else {
                <span class="no-photo">Vesta</span>
              }
            </a>
            <button
              class="favorite-button"
              [class.saved]="shop.isFavorite(product.id)"
              type="button"
              [disabled]="shop.busy()"
              [attr.aria-label]="
                (shop.isFavorite(product.id) ? 'Quitar de favoritos: ' : 'Guardar en favoritos: ') +
                product.name
              "
              [attr.aria-pressed]="shop.isFavorite(product.id)"
              (click)="shop.toggleFavorite(product)"
            >
              {{ shop.isFavorite(product.id) ? '♥' : '♡' }}
            </button>
            <div class="product-body">
              <span class="tag">{{ product.category_name || 'Colección VESTA' }}</span>
              <h3>
                <a routerLink="/catalog" [queryParams]="{ product: product.id }">{{
                  product.name
                }}</a>
              </h3>
              <p class="muted">
                <small
                  >{{ product.sizes.length ? 'Tallas: ' : '' }}
                  @for (size of product.sizes; track size.name) {
                    {{ size.code || size.name }}
                  }
                </small>
              </p>
              <div class="product-price">
                <strong>{{ price(product) | number: '1.2-2' }} Bs</strong
                ><small class="muted">{{
                  product.total_stock > 0 ? product.total_stock + ' disponibles' : 'Sin stock'
                }}</small>
              </div>
              @if (product.discount_percent) {
                <p>
                  <small class="muted"
                    ><s>{{ product.min_price | number: '1.2-2' }} Bs</s> ·
                    {{ product.discount_percent }}% de descuento</small
                  >
                </p>
              }
              <a
                class="secondary card-link"
                routerLink="/catalog"
                [queryParams]="{ product: product.id }"
                >Descubrir prenda <span aria-hidden="true">↗</span></a
              >
            </div>
          </article>
        }
      </div>
    }`,
})
export class PrendasTiendaComponent {
  readonly shop = inject(TiendaService);
  readonly products = input<CatalogProduct[]>([]);
  readonly catalogStyle = input(false);
  price(product: CatalogProduct) {
    return product.min_price * (1 - (product.discount_percent || 0) / 100);
  }
}
