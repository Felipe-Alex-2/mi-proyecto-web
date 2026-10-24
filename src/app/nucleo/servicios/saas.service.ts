import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface StoreCompany { id: string; name: string; slug: string; department?: string | null; branches: {id:string; name:string; city:string}[]; }
export interface SaasPlan { code:string; name:string; branch_limit:number; ai_reports:boolean; price_usd:number; duration_days:number|null; }
export interface CompanySubscription {
  department?: string | null;
  id:string; name:string; slug:string; is_root:boolean; is_active:boolean; admin_email?:string;
  plan_code:string; plan_name:string; branch_limit:number; active_branches:number; ai_reports:boolean;
  status:string; starts_at:string; expires_at:string|null; paypal_sandbox?:boolean;
}
export interface SubscriptionPayment { id:string; plan_code?:string; plan_name?:string; order_id:string|null; capture_id:string|null; status:string; amount:number; currency:string; duration_days?:number; created_at:string; paid_at:string|null; expires_at:string|null; }

@Injectable({providedIn:'root'})
export class SaasService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/saas`;
  directory() { return this.http.get<StoreCompany[]>(`${this.url}/directory`); }
  companies() { return this.http.get<CompanySubscription[]>(`${this.url}/companies`); }
  createCompany(payload:unknown) { return this.http.post<CompanySubscription>(`${this.url}/companies`,payload); }
  setDepartment(id: string, department: string) { return this.http.patch<CompanySubscription>(`${this.url}/companies/${id}/department`, { department }); }
  status(id:string, is_active:boolean) { return this.http.patch<CompanySubscription>(`${this.url}/companies/${id}/status`,{is_active}); }
  updateSubscription(id:string,payload:unknown) { return this.http.put<CompanySubscription>(`${this.url}/companies/${id}/subscription`,payload); }
  plans() { return this.http.get<SaasPlan[]>(`${this.url}/plans`); }
  createPlan(payload: unknown) { return this.http.post<SaasPlan>(`${this.url}/plans`, payload); }
  updatePlan(code:string,payload:unknown) { return this.http.put<SaasPlan>(`${this.url}/plans/${code}`,payload); }
  subscription() { return this.http.get<CompanySubscription>(`${this.url}/subscription`); }
  payments() { return this.http.get<SubscriptionPayment[]>(`${this.url}/subscription/payments`); }
  checkout(billingCycle: 'monthly' | 'annual' = 'monthly', planCode = 'PRO') {
    return this.http.post<{approval_url:string; order_id:string; duration_days?:number}>(
      `${this.url}/subscription/paypal-order`,
      { billing_cycle: billingCycle, ...(planCode !== 'PRO' ? {plan_code: planCode} : {}) }
    );
  }
  capture(order_id:string) { return this.http.post<CompanySubscription>(`${this.url}/subscription/paypal-capture`,{order_id}); }
  cancelPayment(paymentId: string) { return this.http.post<SubscriptionPayment>(`${this.url}/subscription/payments/${paymentId}/cancel`, {}); }
  deletePayment(paymentId: string) { return this.http.delete<{id: string; deleted: boolean}>(`${this.url}/subscription/payments/${paymentId}`); }
  downloadSubscriptionInvoice(paymentId: string) { return this.http.get(`${this.url}/subscription/payments/${paymentId}/invoice`, { responseType: 'blob' }); }
  history() { return this.http.get<{id:string; company_name:string; branch_name:string; payment_code:string; amount:number; currency:string; status:string; created_at:string}[]>(`${this.url}/history`); }
}
