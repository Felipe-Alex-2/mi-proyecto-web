import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Reservation,
  ReservationStatusUpdate,
  ReservationStats,
  PayPalReservationOrderCreate,
  PayPalOrderResponse,
  PayPalCaptureResponse,
} from '../models/reservation.model';

@Injectable({
  providedIn: 'root',
})
export class ReservationService {
  private readonly baseUrl = `${environment.apiUrl}/reservations`;

  constructor(private http: HttpClient) {}

  getReservations(filters?: {
    branch_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Observable<Reservation[]> {
    let params = new HttpParams();
    if (filters?.branch_id) params = params.set('branch_id', filters.branch_id);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.limit) params = params.set('limit', filters.limit.toString());
    if (filters?.offset) params = params.set('offset', filters.offset.toString());

    return this.http.get<Reservation[]>(this.baseUrl, { params });
  }

  getReservation(id: string): Observable<Reservation> {
    return this.http.get<Reservation>(`${this.baseUrl}/${id}`);
  }

  updateStatus(id: string, payload: ReservationStatusUpdate): Observable<Reservation> {
    return this.http.patch<Reservation>(`${this.baseUrl}/${id}/status`, payload);
  }

  getStats(branchId?: string): Observable<ReservationStats> {
    let params = new HttpParams();
    if (branchId) params = params.set('branch_id', branchId);
    return this.http.get<ReservationStats>(`${this.baseUrl}/stats`, { params });
  }

  cancelReservation(id: string): Observable<Reservation> {
    return this.http.delete<Reservation>(`${this.baseUrl}/${id}`);
  }

  createPayPalOrder(payload: PayPalReservationOrderCreate): Observable<PayPalOrderResponse> {
    return this.http.post<PayPalOrderResponse>(`${this.baseUrl}/paypal-order`, payload);
  }

  capturePayPalOrder(paypalOrderId: string): Observable<PayPalCaptureResponse> {
    return this.http.post<PayPalCaptureResponse>(`${this.baseUrl}/paypal-capture`, {
      paypal_order_id: paypalOrderId,
    });
  }
}
