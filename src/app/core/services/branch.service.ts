import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Branch,
  BranchCreate,
  BranchUpdate,
  AssignStaffRequest,
} from '../models/branch.model';

@Injectable({
  providedIn: 'root',
})
export class BranchService {
  private readonly baseUrl = `${environment.apiUrl}/branches`;

  constructor(private http: HttpClient) {}

  getBranches(city?: string, is_active?: boolean): Observable<Branch[]> {
    let params = new HttpParams();
    if (city) {
      params = params.set('city', city);
    }
    if (is_active !== undefined && is_active !== null) {
      params = params.set('is_active', is_active.toString());
    }
    return this.http.get<Branch[]>(this.baseUrl, { params });
  }

  getBranchById(id: string): Observable<Branch> {
    return this.http.get<Branch>(`${this.baseUrl}/${id}`);
  }

  createBranch(payload: BranchCreate): Observable<Branch> {
    return this.http.post<Branch>(this.baseUrl, payload);
  }

  updateBranch(id: string, payload: BranchUpdate): Observable<Branch> {
    return this.http.put<Branch>(`${this.baseUrl}/${id}`, payload);
  }

  toggleBranchStatus(id: string): Observable<Branch> {
    return this.http.patch<Branch>(`${this.baseUrl}/${id}/toggle-status`, {});
  }

  assignStaff(branchId: string, userIds: string[]): Observable<Branch> {
    const payload: AssignStaffRequest = { user_ids: userIds };
    return this.http.post<Branch>(`${this.baseUrl}/${branchId}/staff`, payload);
  }

  removeStaff(branchId: string, userId: string): Observable<Branch> {
    return this.http.delete<Branch>(`${this.baseUrl}/${branchId}/staff/${userId}`);
  }
}
