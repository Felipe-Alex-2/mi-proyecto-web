import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ActivityLogListResponse,
} from '../modelos/bitacora.model';

@Injectable({ providedIn: 'root' })
export class BitacoraService {
  private readonly baseUrl = `${environment.apiUrl}/activity-logs`;

  constructor(private http: HttpClient) {}

  list(filters: {
    page?: number;
    pageSize?: number;
    action?: string;
    category?: string;
    search?: string;
    branchId?: string;
  } = {}): Observable<ActivityLogListResponse> {
    let params = new HttpParams();
    if (filters.page) params = params.set('page', filters.page);
    if (filters.pageSize) params = params.set('page_size', filters.pageSize);
    if (filters.action) params = params.set('action', filters.action);
    if (filters.category) params = params.set('category', filters.category);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.branchId) params = params.set('branch_id', filters.branchId);
    return this.http.get<ActivityLogListResponse>(this.baseUrl, { params });
  }
}
