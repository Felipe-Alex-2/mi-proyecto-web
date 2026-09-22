import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Promotion, PromotionCreate, PromotionUpdate } from '../models/promotion.model';

@Injectable({
  providedIn: 'root',
})
export class PromotionService {
  private readonly baseUrl = `${environment.apiUrl}/promotions`;

  constructor(private http: HttpClient) {}

  getPromotions(isActive?: boolean, search?: string): Observable<Promotion[]> {
    let params = new HttpParams();
    if (isActive !== undefined && isActive !== null) {
      params = params.set('is_active', isActive.toString());
    }
    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }
    return this.http.get<Promotion[]>(this.baseUrl, { params });
  }

  getPromotionById(id: string): Observable<Promotion> {
    return this.http.get<Promotion>(`${this.baseUrl}/${id}`);
  }

  createPromotion(payload: PromotionCreate): Observable<Promotion> {
    return this.http.post<Promotion>(this.baseUrl, payload);
  }

  updatePromotion(id: string, payload: PromotionUpdate): Observable<Promotion> {
    return this.http.put<Promotion>(`${this.baseUrl}/${id}`, payload);
  }

  togglePromotionStatus(id: string): Observable<Promotion> {
    return this.http.patch<Promotion>(`${this.baseUrl}/${id}/toggle-status`, {});
  }
}
