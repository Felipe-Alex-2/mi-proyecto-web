import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Category,
  CategoryCreate,
  CategoryUpdate,
  Size,
  SizeCreate,
  SizeUpdate,
  Color,
  ColorCreate,
  ColorUpdate,
} from '../models/catalog-attribute.model';

@Injectable({
  providedIn: 'root',
})
export class CatalogAttributeService {
  private readonly baseUrl = `${environment.apiUrl}/attributes`;

  constructor(private http: HttpClient) {}

  // --- Categories ---
  getCategories(isActive?: boolean): Observable<Category[]> {
    let params = new HttpParams();
    if (isActive !== undefined && isActive !== null) {
      params = params.set('is_active', isActive.toString());
    }
    return this.http.get<Category[]>(`${this.baseUrl}/categories`, { params });
  }

  createCategory(payload: CategoryCreate): Observable<Category> {
    return this.http.post<Category>(`${this.baseUrl}/categories`, payload);
  }

  updateCategory(id: string, payload: CategoryUpdate): Observable<Category> {
    return this.http.put<Category>(`${this.baseUrl}/categories/${id}`, payload);
  }

  toggleCategoryStatus(id: string): Observable<Category> {
    return this.http.patch<Category>(`${this.baseUrl}/categories/${id}/toggle-status`, {});
  }

  // --- Sizes ---
  getSizes(categoryType?: string, isActive?: boolean): Observable<Size[]> {
    let params = new HttpParams();
    if (categoryType) {
      params = params.set('category_type', categoryType);
    }
    if (isActive !== undefined && isActive !== null) {
      params = params.set('is_active', isActive.toString());
    }
    return this.http.get<Size[]>(`${this.baseUrl}/sizes`, { params });
  }

  createSize(payload: SizeCreate): Observable<Size> {
    return this.http.post<Size>(`${this.baseUrl}/sizes`, payload);
  }

  updateSize(id: string, payload: SizeUpdate): Observable<Size> {
    return this.http.put<Size>(`${this.baseUrl}/sizes/${id}`, payload);
  }

  toggleSizeStatus(id: string): Observable<Size> {
    return this.http.patch<Size>(`${this.baseUrl}/sizes/${id}/toggle-status`, {});
  }

  // --- Colors ---
  getColors(isActive?: boolean): Observable<Color[]> {
    let params = new HttpParams();
    if (isActive !== undefined && isActive !== null) {
      params = params.set('is_active', isActive.toString());
    }
    return this.http.get<Color[]>(`${this.baseUrl}/colors`, { params });
  }

  createColor(payload: ColorCreate): Observable<Color> {
    return this.http.post<Color>(`${this.baseUrl}/colors`, payload);
  }

  updateColor(id: string, payload: ColorUpdate): Observable<Color> {
    return this.http.put<Color>(`${this.baseUrl}/colors/${id}`, payload);
  }

  toggleColorStatus(id: string): Observable<Color> {
    return this.http.patch<Color>(`${this.baseUrl}/colors/${id}/toggle-status`, {});
  }
}
