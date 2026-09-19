import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Payment,
  PaymentCreate,
  PaymentProcess,
  PaymentPayPalOrderResponse,
  PendingReservationOption,
} from '../models/payment.model';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private readonly baseUrl = `${environment.apiUrl}/payments`;

  constructor(private http: HttpClient) {}

  getPayments(filters?: {
    branch_id?: string;
    status?: string;
    payment_type?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Observable<Payment[]> {
    let params = new HttpParams();
    if (filters?.branch_id) params = params.set('branch_id', filters.branch_id);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.payment_type) params = params.set('payment_type', filters.payment_type);
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.limit) params = params.set('limit', filters.limit.toString());
    if (filters?.offset) params = params.set('offset', filters.offset.toString());

    return this.http.get<Payment[]>(this.baseUrl, { params });
  }

  getPendingReservations(branchId: string): Observable<PendingReservationOption[]> {
    let params = new HttpParams().set('branch_id', branchId);
    return this.http.get<PendingReservationOption[]>(`${this.baseUrl}/pending-reservations`, { params });
  }

  getPayment(id: string): Observable<Payment> {
    return this.http.get<Payment>(`${this.baseUrl}/${id}`);
  }

  createPayment(payload: PaymentCreate): Observable<Payment> {
    return this.http.post<Payment>(this.baseUrl, payload);
  }

  processCashPayment(paymentId: string, notes?: string): Observable<Payment> {
    const payload: PaymentProcess = {
      payment_type: 'EFECTIVO',
      notes,
    };
    return this.http.post<Payment>(`${this.baseUrl}/${paymentId}/cash`, payload);
  }

  createPayPalCheckout(paymentId: string): Observable<PaymentPayPalOrderResponse> {
    return this.http.post<PaymentPayPalOrderResponse>(`${this.baseUrl}/${paymentId}/paypal-order`, {});
  }

  capturePayPalPayment(paymentId: string, orderId: string): Observable<Payment> {
    let params = new HttpParams().set('order_id', orderId);
    return this.http.post<Payment>(`${this.baseUrl}/${paymentId}/paypal-capture`, null, { params });
  }
}
