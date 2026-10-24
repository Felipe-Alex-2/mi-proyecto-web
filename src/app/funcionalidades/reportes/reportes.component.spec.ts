import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { ReportesComponent } from './reportes.component';

describe('Reports branch boundaries', () => {
  function setup(role = 'ADMIN') {
    TestBed.configureTestingModule({ imports: [ReportesComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      {provide: AutenticacionService, useValue: {currentUser: signal({role, branch_id: role === 'ADMIN' ? null : 'centro'})}},
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

  it('includes the assigned branch in natural-language reports', () => {
    const {fixture, http, component} = setup('STORE_MANAGER');
    expect(component.branchId).toBe('centro');
    component.transcript = 'Qué sucursal vendió más';
    component.sendVoiceReport();
    const request = http.expectOne(req => req.url.endsWith('/reports/voice'));
    expect(request.request.body.branch_id).toBe('centro');
    request.flush({report:{report_type:'sales_by_branch', title:'Ventas', generated_by:'natural_language', summary:{scope:'Centro'}, columns:[], rows:[]}});
    fixture.destroy();
    http.verify();
  });
});
