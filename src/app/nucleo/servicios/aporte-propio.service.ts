import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({providedIn:'root'})
export class AportePropioService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/own`;
  get<T = any>(path: string) { return this.http.get<T>(`${this.url}/${path}`); }
  post<T = any>(path: string, payload: unknown) { return this.http.post<T>(`${this.url}/${path}`, payload); }
  patch<T = any>(path: string, payload: unknown) { return this.http.patch<T>(`${this.url}/${path}`, payload); }
  receipt(id: string) { return this.http.get(`${environment.apiUrl}/payments/${id}/invoice-pdf`, {responseType:'blob'}); }
}
