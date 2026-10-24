import { vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { SaasComponent } from './saas.component';

describe('Companies and subscription UI',()=>{
  function setup(platform:boolean,query:Record<string,string>={}, superadmin=platform) {
    TestBed.configureTestingModule({imports:[SaasComponent],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([]),
      {provide:AutenticacionService,useValue:{currentUser:signal({role:'ADMIN',is_saas_admin:superadmin})}},
      {provide:ActivatedRoute,useValue:{snapshot:{data:{platform},queryParamMap:{get:(key:string)=>query[key]??null}}}},
    ]});
    const fixture=TestBed.createComponent(SaasComponent);const http=TestBed.inject(HttpTestingController);
    http.expectOne(r=>r.url.endsWith('/saas/plans')).flush([
      {code:'BASIC',name:'Básico',branch_limit:2,price_usd:0,duration_days:null,ai_reports:false},
      {code:'PRO',name:'Profesional',branch_limit:10,price_usd:20,duration_days:30,ai_reports:true},
      {code:'MAX',name:'Max',branch_limit:25,price_usd:50,duration_days:30,ai_reports:true},
    ]);
    if(platform)http.expectOne(r=>r.url.endsWith('/saas/companies')).flush([]);
    else {
      http.expectOne(r=>r.url.endsWith('/saas/subscription')).flush({id:'company',name:'Moda',plan_code:'BASIC',plan_name:'Básico',status:'ACTIVE',is_active:true,is_root:false,branch_limit:2,active_branches:1,ai_reports:false,paypal_sandbox:true});
      http.expectOne(r=>r.url.endsWith('/saas/subscription/payments')).flush([]);
    }
    return {fixture,http,component:fixture.componentInstance};
  }
  it('rejects empty company data and creates a company without configurable plan or expiry',()=>{
    const {fixture,http,component}=setup(true);
    component.create();http.expectNone(r=>r.method==='POST');
    component.form.setValue({department:'Santa Cruz',name:'Moda Felipe',slug:'moda-felipe',admin_name:'Felipe Admin',admin_email:'felipe@example.com',admin_password:'StrongPass123!'});
    component.create();
    const request=http.expectOne(r=>r.url.endsWith('/saas/companies')&&r.method==='POST');
    expect(request.request.body.department).toBe('Santa Cruz');
    expect(request.request.body.plan_code).toBeUndefined();expect(request.request.body.duration_days).toBeUndefined();expect(request.request.body.admin_email).toBe('felipe@example.com');
    request.flush({detail:'Identificador duplicado'},{status:409,statusText:'Conflict'});
    expect(component.error()).toBe('Identificador duplicado');expect(component.success()).toBe('');
    fixture.destroy();http.verify();
  });
  it('opens a separate tab synchronously and keeps the application in place',()=>{
    const tab={opener:{},location:{href:''},close:vi.fn()};
    const open=vi.spyOn(window,'open').mockReturnValue(tab as any);
    const {fixture,http,component}=setup(false);
    component.checkout();expect(open).toHaveBeenCalledWith('about:blank','_blank');
    http.expectOne(r=>r.url.endsWith('/saas/subscription/paypal-order')).flush({approval_url:'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1'});
    expect(tab.location.href).toContain('sandbox.paypal.com');expect(tab.opener).toBeNull();
    fixture.destroy();http.verify();open.mockRestore();
  });
  it('does not create a payment when the browser blocks the new tab',()=>{
    const open=vi.spyOn(window,'open').mockReturnValue(null);
    const {fixture,http,component}=setup(false);component.checkout();
    http.expectNone(r=>r.method==='POST');expect(component.error()).toContain('nueva pestaña');
    fixture.destroy();http.verify();open.mockRestore();
  });
  it('does not unlock the plan or announce a payment when capture is rejected',()=>{
    const {fixture,http,component}=setup(false,{checkout:'return',token:'ORDER-1'});
    const request=http.expectOne(r=>r.url.endsWith('/saas/subscription/paypal-capture'));
    expect(request.request.body).toEqual({order_id:'ORDER-1'});
    request.flush({detail:'PayPal no confirmó el importe'},{status:409,statusText:'Conflict'});
    expect(component.current()?.plan_code).toBe('BASIC');expect(component.success()).toBe('');
    expect(component.paymentError()).toContain('no confirmó');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('$20');
    expect(fixture.nativeElement.textContent).toContain('Gratis');
    expect(fixture.nativeElement.textContent).toContain('Sin vencimiento');
    expect(fixture.nativeElement.textContent).toContain('Obtener plan Profesional');
    fixture.destroy();http.verify();
  });
  it('switches between monthly and annual billing with 17% savings and passes cycle to checkout',()=>{
    const tab={opener:{},location:{href:''},close:vi.fn()};
    const open=vi.spyOn(window,'open').mockReturnValue(tab as any);
    const {fixture,http,component}=setup(false);
    expect(component.billingCycle()).toBe('monthly');
    component.billingCycle.set('annual');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('$17');
    expect(fixture.nativeElement.textContent).toContain('$200 facturado anualmente');
    expect(fixture.nativeElement.textContent).toContain('Ahorra 17%');

    component.checkout();
    const req=http.expectOne(r=>r.url.endsWith('/saas/subscription/paypal-order'));
    expect(req.request.body).toEqual({billing_cycle:'annual'});
    req.flush({approval_url:'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-ANNUAL'});
    fixture.destroy();http.verify();open.mockRestore();
  });
  it('cleanAndRefreshPayments clears notices and closes receipt panel without auto-opening receipt',()=>{
    const {fixture,http,component}=setup(false);
    component.paymentError.set('Aviso de error previo');
    component.selectedPayment.set({id:'p1',order_id:'ord1',capture_id:null,status:'PAID',amount:25,currency:'USD',created_at:'2026-10-23',paid_at:'2026-10-23',expires_at:null});
    component.cleanAndRefreshPayments();
    expect(component.paymentError()).toBe('');
    expect(component.selectedPayment()).toBeNull();
    const req=http.expectOne(r=>r.url.endsWith('/saas/subscription/payments'));
    req.flush([{id:'p1',order_id:'ord1',capture_id:'cap1',status:'PAID',amount:25,currency:'USD',created_at:'2026-10-23',paid_at:'2026-10-23',expires_at:null}]);
    expect(component.selectedPayment()).toBeNull();
    fixture.destroy();http.verify();
  });
  it('cancels pending payment and notifies the user in the payments section',()=>{
    const {fixture,http,component}=setup(false);
    component.cancelPayment('pay-123');
    const req=http.expectOne(r=>r.url.endsWith('/saas/subscription/payments/pay-123/cancel')&&r.method==='POST');
    req.flush({id:'pay-123',status:'CANCELLED'});
    expect(component.paymentSuccess()).toContain('cancelado');
    http.expectOne(r=>r.url.endsWith('/saas/subscription/payments')).flush([]);
    fixture.destroy();http.verify();
  });
  it('shows Max in system colors and sends its plan code and fixed period to checkout',()=>{
    const tab={opener:{},location:{href:''},close:vi.fn()};
    const open=vi.spyOn(window,'open').mockReturnValue(tab as any);
    const {fixture,http,component}=setup(false);
    component.billingCycle.set('annual'); fixture.detectChanges();
    const maximum=fixture.nativeElement.querySelector('.max-plan');
    expect(maximum.textContent).toContain('$50');
    expect(maximum.textContent).toContain('25 sucursales');
    expect(maximum.textContent).toContain('Obtener plan Max');
    component.checkout('MAX');
    const request=http.expectOne(r=>r.url.endsWith('/saas/subscription/paypal-order'));
    expect(request.request.body).toEqual({billing_cycle:'monthly',plan_code:'MAX'});
    request.flush({approval_url:'https://sandbox.paypal.com/approve'});
    fixture.destroy();http.verify();open.mockRestore();
  });
  it('hides plan creation for company admins and blocks the component action',()=>{
    const {fixture,http,component}=setup(false); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Crear suscripciones');
    component.planForm.setValue({name:'Equipo',price_usd:75,duration_days:30,branch_limit:40,ai_reports:true});
    component.createPlan(); http.expectNone(r=>r.method==='POST');
    fixture.destroy();http.verify();
  });
  it('allows only the platform administrator to open and submit the plan form in Mi plan',()=>{
    const {fixture,http,component}=setup(false,{},true); fixture.detectChanges();
    const button=Array.from(fixture.nativeElement.querySelectorAll('header button') as NodeListOf<HTMLButtonElement>).find(b=>b.textContent?.includes('Crear suscripciones'))!;
    expect(button).toBeTruthy(); button.click(); fixture.detectChanges();
    component.createPlan(); http.expectNone(r=>r.method==='POST');
    component.planForm.setValue({name:'Equipo',price_usd:75,duration_days:45,branch_limit:40,ai_reports:true});
    component.createPlan(); component.createPlan();
    const request=http.expectOne(r=>r.method==='POST'&&r.url.endsWith('/saas/plans'));
    expect(request.request.body.name).toBe('Equipo');
    request.flush({code:'EQUIPO',name:'Equipo',price_usd:75,duration_days:45,branch_limit:40,ai_reports:true});
    expect(component.showCreatePlan()).toBe(false);
    expect(component.plans().at(-1)?.name).toBe('Equipo');
    fixture.destroy();http.verify();
  });
});
