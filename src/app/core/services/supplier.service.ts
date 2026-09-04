import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Supplier, SupplierCreate, SupplierUpdate } from '../models/supplier.model';

@Injectable({
  providedIn: 'root',
})
export class SupplierService {
  private readonly baseUrl = `${environment.apiUrl}/suppliers`;

  constructor(private http: HttpClient) {}

  getSuppliers(search?: string, isActive?: boolean): Observable<Supplier[]> {
    let params = new HttpParams();
    if (search) {
      params = params.set('search', search);
    }
    if (isActive !== undefined && isActive !== null) {
      params = params.set('is_active', isActive.toString());
    }
    return this.http.get<Supplier[]>(this.baseUrl, { params });
  }

  getSupplierById(id: string): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.baseUrl}/${id}`);
  }

  createSupplier(payload: SupplierCreate): Observable<Supplier> {
    return this.http.post<Supplier>(this.baseUrl, payload);
  }

  updateSupplier(id: string, payload: SupplierUpdate): Observable<Supplier> {
    return this.http.put<Supplier>(`${this.baseUrl}/${id}`, payload);
  }

  toggleSupplierStatus(id: string): Observable<Supplier> {
    return this.http.patch<Supplier>(`${this.baseUrl}/${id}/toggle-status`, {});
  }
}
