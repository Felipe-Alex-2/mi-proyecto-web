import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { PanelPrincipalComponent } from './panel_principal.component';

describe('Resumen del panel', () => {
  function setup(role = 'ADMIN') {
    TestBed.configureTestingModule({
      imports: [PanelPrincipalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AutenticacionService,
          useValue: { currentUser: signal({ role, full_name: 'Ana', branch_id: 'centro' }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(PanelPrincipalComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http
      .expectOne((req) => req.url.endsWith('/branches'))
      .flush([{ id: 'centro', name: 'Centro', city: 'La Paz' }]);
    return { fixture, http, component: fixture.componentInstance };
  }
  const summary = {
    months: 3,
    date_from: '2026-09-01',
    date_to: '2026-11-01',
    scope: 'Centro',
    sales: 2,
    customers: 1,
    revenue: [
      { currency: 'USD', amount: 40 },
      { currency: 'BOB', amount: 100 },
    ],
    series: [
      { period: '2026-09', sales: 0, customers: 0, revenue: [] },
      { period: '2026-10', sales: 2, customers: 1, revenue: [] },
    ],
  };

  it('cancels outdated periods and branches and renders currencies separately', () => {
    const { fixture, http, component } = setup();
    const first = http.expectOne((req) => req.url.endsWith('/reports/dashboard'));
    expect(first.request.params.get('months')).toBe('1');
    component.changePeriod(3);
    expect(first.cancelled).toBe(true);
    const second = http.expectOne((req) => req.url.endsWith('/reports/dashboard'));
    expect(second.request.params.get('months')).toBe('3');
    component.changeBranch('centro');
    expect(second.cancelled).toBe(true);
    const third = http.expectOne((req) => req.url.endsWith('/reports/dashboard'));
    expect(third.request.params.get('branch_id')).toBe('centro');
    third.flush(summary);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Clientes con compras');
    expect(text).toContain('USD');
    expect(text).toContain('BOB');
    expect(fixture.nativeElement.querySelectorAll('.chart-column').length).toBe(2);
    fixture.destroy();
    http.verify();
  });

  it('uses the employee branch and offers a retry on network failure', () => {
    const { fixture, http, component } = setup('STORE_MANAGER');
    const request = http.expectOne((req) => req.url.endsWith('/reports/dashboard'));
    expect(request.request.params.get('branch_id')).toBe('centro');
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reintentar');
    component.load();
    http
      .expectOne((req) => req.url.endsWith('/reports/dashboard'))
      .flush({ ...summary, sales: 0, revenue: [], customers: 0, series: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay ventas');
    fixture.destroy();
    http.verify();
  });
});
