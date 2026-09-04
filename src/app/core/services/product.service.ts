import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Product,
  ProductCreate,
  ProductUpdate,
} from '../models/product.model';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private readonly baseUrl = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient) {}

  getProducts(filters?: {
    categoryId?: string;
    seasonId?: string;
    supplierId?: string;
    search?: string;
    isActive?: boolean;
  }): Observable<Product[]> {
    let params = new HttpParams();
    if (filters?.categoryId) {
      params = params.set('category_id', filters.categoryId);
    }
    if (filters?.seasonId) {
      params = params.set('season_id', filters.seasonId);
    }
    if (filters?.supplierId) {
      params = params.set('supplier_id', filters.supplierId);
    }
    if (filters?.search) {
      params = params.set('search', filters.search);
    }
    if (filters?.isActive !== undefined && filters?.isActive !== null) {
      params = params.set('is_active', filters.isActive.toString());
    }

    return this.http.get<Product[]>(this.baseUrl, { params });
  }

  getProductById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }

  createProduct(payload: ProductCreate): Observable<Product> {
    return this.http.post<Product>(this.baseUrl, payload);
  }

  updateProduct(id: string, payload: ProductUpdate): Observable<Product> {
    return this.http.put<Product>(`${this.baseUrl}/${id}`, payload);
  }

  toggleProductStatus(id: string): Observable<Product> {
    return this.http.patch<Product>(`${this.baseUrl}/${id}/toggle-status`, {});
  }
}
