import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ActivityLogCreate,
  ActivityLogListResponse,
} from '../models/activity-log.model';

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private readonly baseUrl = `${environment.apiUrl}/activity-logs`;

  constructor(private http: HttpClient) {}

  record(payload: ActivityLogCreate): Observable<unknown> {
    return this.http.post(this.baseUrl, payload).pipe(catchError(() => of(null)));
  }

  list(filters: {
    page?: number;
    pageSize?: number;
    action?: string;
    category?: string;
    search?: string;
  } = {}): Observable<ActivityLogListResponse> {
    let params = new HttpParams();
    if (filters.page) params = params.set('page', filters.page);
    if (filters.pageSize) params = params.set('page_size', filters.pageSize);
    if (filters.action) params = params.set('action', filters.action);
    if (filters.category) params = params.set('category', filters.category);
    if (filters.search) params = params.set('search', filters.search);
    return this.http.get<ActivityLogListResponse>(this.baseUrl, { params });
  }
}
