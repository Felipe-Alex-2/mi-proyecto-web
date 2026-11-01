import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Revenue {
  currency: string;
  amount: number;
}
export interface DashboardSummary {
  months: number;
  date_from: string;
  date_to: string;
  scope: string;
  sales: number;
  customers: number;
  revenue: Revenue[];
  series: { period: string; sales: number; customers: number; revenue: Revenue[] }[];
}

@Injectable({ providedIn: 'root' })
export class PanelService {
  private http = inject(HttpClient);
  summary(months: number, branchId: string) {
    let params = new HttpParams().set('months', months);
    if (branchId) params = params.set('branch_id', branchId);
    return this.http.get<DashboardSummary>(`${environment.apiUrl}/reports/dashboard`, { params });
  }
}
