import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CatalogFilterOptions,
  CatalogProduct,
  CatalogProductListResponse,
} from '../models/catalog.model';

export interface CatalogProductFilters {
  search?: string;
  categoryId?: string;
  sizeId?: string;
  colorId?: string;
  seasonId?: string;
  gender?: string;
  minPrice?: number;
  maxPrice?: number;
  branchId?: string;
  sortBy?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private readonly baseUrl = `${environment.apiUrl}/catalog`;

  constructor(private http: HttpClient) {}

  getFilterOptions(): Observable<CatalogFilterOptions> {
    return this.http.get<CatalogFilterOptions>(`${this.baseUrl}/filters`);
  }

  getProducts(filters: CatalogProductFilters = {}): Observable<CatalogProductListResponse> {
    let params = new HttpParams();
    const values: Record<string, string | number | undefined> = {
      search: filters.search,
      category_id: filters.categoryId,
      size_id: filters.sizeId,
      color_id: filters.colorId,
      season_id: filters.seasonId,
      gender: filters.gender,
      min_price: filters.minPrice,
      max_price: filters.maxPrice,
      branch_id: filters.branchId,
      sort_by: filters.sortBy,
      page: filters.page,
      page_size: filters.pageSize,
    };

    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value.toString());
      }
    });

    return this.http.get<CatalogProductListResponse>(`${this.baseUrl}/products`, { params });
  }

  getProduct(id: string): Observable<CatalogProduct> {
    return this.http.get<CatalogProduct>(`${this.baseUrl}/products/${id}`);
  }
}
