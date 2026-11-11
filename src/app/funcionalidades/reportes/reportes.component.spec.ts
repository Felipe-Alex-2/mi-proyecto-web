import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { ReportesComponent } from './reportes.component';

describe('Reports branch boundaries', () => {
  function setup(role = 'ADMIN', platform=false) {
    TestBed.configureTestingModule({ imports: [ReportesComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      {provide: AutenticacionService, useValue: {currentUser: signal({email:'usuario@gmail.com',role,is_saas_admin:platform, branch_id: role === 'ADMIN' ? null : 'centro'})}},
    ] });
    const fixture = TestBed.createComponent(ReportesComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(req=>req.url.endsWith("/saas/subscription")).flush({ai_reports:true});
    http.expectOne(req => req.url.endsWith('/branches')).flush([
      {id:'centro', name:'Centro', city:'La Paz'}, {id:'sur', name:'Sur', city:'La Paz'},
    ]);
    return {fixture, http, component: fixture.componentInstance};
  }

  it('sends the selected branch and dates, and cancels obsolete results when switching branch', () => {
    const {fixture, http, component} = setup();
    component.changeBranch('centro');
    component.reportType = 'sales_by_branch';
    component.dateFrom = '2026-10-01';
    component.dateTo = '2026-10-20';
    component.generateManual();
    const old = http.expectOne(req => req.url.endsWith('/reports/generate'));
    expect(old.request.body.branch_id).toBe('centro');
    expect(old.request.body.date_from).toBe('2026-10-01');
    component.changeBranch('sur');
    expect(old.cancelled).toBe(true);
    expect(component.report()).toBeNull();
    component.generateManual();
    const fresh = http.expectOne(req => req.url.endsWith('/reports/generate'));
    expect(fresh.request.body.branch_id).toBe('sur');
    fresh.flush({report_type:'sales_by_branch', title:'Ventas', generated_by:'manual', summary:{scope:'Sur'}, columns:[], rows:[]});
    expect(component.report()?.summary['scope']).toBe('Sur');
    fixture.destroy();
    http.verify();
  });

  it('allows a manager to request global natural-language reports', () => {
    const {fixture, http, component} = setup('STORE_MANAGER');
    expect(component.branchId).toBe('');
    expect(component.emailTo).toBe('usuario@gmail.com');
    component.transcript = 'Qué sucursal vendió más';
    component.sendVoiceReport();
    const request = http.expectOne(req => req.url.endsWith('/reports/voice'));
    expect(request.request.body.branch_id).toBeUndefined();
    expect(request.request.body.all_companies).toBe(true);
    request.flush({report:{report_type:'sales_by_branch', title:'Ventas', generated_by:'natural_language', summary:{scope:'Centro'}, columns:[], rows:[]}});
    fixture.destroy();
    http.verify();
  });
  it.each(['ADMIN','STORE_MANAGER','CASHIER','CUSTOMER'])('lets %s request global comparisons and carries the PDF recipient',(role)=>{
    const {fixture,http,component}=setup(role,false);
    expect(component.allCompanies).toBe(true);
    component.reportType='sales_by_company';component.emailTo='felipe@gmail.com';component.generateManual();
    const request=http.expectOne(r=>r.url.endsWith('/reports/generate'));
    expect(request.request.body.all_companies).toBe(true);
    expect(request.request.body.email_to).toBe('felipe@gmail.com');
    request.flush({report_id:'one',report_type:'sales_by_company',title:'Ventas por empresa',generated_by:'manual',summary:{leader_USD:'MODAT'},columns:[],rows:[],email_status:'FAILED',email_message:'No se pudo enviar el PDF.'});
    fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('No se pudo enviar el PDF.');
    component.sendPdf();const email=http.expectOne(r=>r.url.endsWith('/reports/one/email'));
    expect(email.request.body.email_to).toBe('felipe@gmail.com');email.flush({...component.report(),email_status:'SENT'});
    fixture.destroy();http.verify();
  });

  it('shows the applied period and least-selling zero branch without claiming it sold more',()=>{
    const {fixture,http,component}=setup();
    component.report.set({report_type:'sales_by_branch',title:'Menores ventas por sucursal',generated_by:'natural_language',
      summary:{period:'Últimos 3 meses · 11/08/2026 al 11/11/2026',lowest_USD:'VESTA · La Paz',total_USD:0,comparison_total_USD:79},
      columns:['branch','amount'],rows:[{branch:'La Paz',amount:0}]});
    fixture.detectChanges();
    const text=fixture.nativeElement.textContent;
    expect(text).toContain('Periodo consultado');expect(text).toContain('Últimos 3 meses');
    expect(text).toContain('Menor venta (USD)');expect(text).toContain('VESTA · La Paz');
    expect(text).not.toContain('Mayor venta (USD)');
    fixture.destroy();http.verify();
  });

  it('renders composed product rankings and labels calculated columns',()=>{
    const {fixture,http,component}=setup();
    component.report.set({report_type:'sales_items',title:'Productos más vendidos por sucursal',generated_by:'natural_language',
      summary:{period:'Últimos 3 meses',limit_scope:'10 por sucursal',interpretation_source:'Gemini'},
      columns:['company','branch','product','sum_units','avg_unit_price'],
      rows:[{company:'VESTA',branch:'La Paz',product:'Camisa azul',sum_units:12,avg_unit_price:10}]});
    fixture.detectChanges();
    const text=fixture.nativeElement.textContent;
    expect(text).toContain('Camisa azul');expect(text).toContain('10 por sucursal');
    expect(component.label('sum_units')).toContain('Unidades');
    expect(component.label('avg_unit_price')).toContain('Precio unitario');
    expect(component.label('interpretation_source')).toBe('Interpretación');
    fixture.destroy();http.verify();
  });

  it('reads the generated narration and stops speaking on scope changes',()=>{
    const speak=vi.fn(),cancel=vi.fn();
    vi.stubGlobal('speechSynthesis',{speak,cancel});
    vi.stubGlobal('SpeechSynthesisUtterance',class {lang='';onend:any;onerror:any;constructor(public text:string){}});
    const {fixture,http,component}=setup();
    component.report.set({report_type:'sales_by_branch',title:'Ventas',generated_by:'manual',summary:{},columns:[],rows:[],narration:'La sucursal Central vendió 50 dólares.'});
    component.readReport();expect(speak.mock.calls[0][0].text).toContain('50 dólares');expect(component.speaking()).toBe(true);
    component.changeBranch('sur');expect(cancel).toHaveBeenCalled();expect(component.speaking()).toBe(false);
    fixture.destroy();http.verify();vi.unstubAllGlobals();
  });

});
