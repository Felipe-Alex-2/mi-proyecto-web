import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { PromocionesComponent } from './promociones.component';

describe('Borrador de descuento', () => {
  const suggestion = {
    product_id: 'p1',
    product_name: 'Camisa',
    stock: 12,
    days_in_stock: 95,
    estimated: true,
    reason: '95 días estimados',
    discount_percent: 20,
    name: 'Rotación Camisa',
    description: 'Por antigüedad',
    start_date: '2026-11-01',
    end_date: '2026-11-15',
  };
  function setup(role = 'ADMIN') {
    TestBed.configureTestingModule({
      imports: [PromocionesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AutenticacionService, useValue: { currentUser: signal({ role }) } },
      ],
    });
    const fixture = TestBed.createComponent(PromocionesComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((req) => req.url.endsWith('/promotions')).flush([]);
    return { fixture, http, component: fixture.componentInstance };
  }

  it('suggests without writing, opens an editable draft and assigns only on create', () => {
    const { fixture, http, component } = setup();
    component.suggestDiscounts();
    http.expectOne((req) => req.url.endsWith('/suggestions/stock-age')).flush([suggestion]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Preparar borrador');
    component.useSuggestion(suggestion);
    fixture.detectChanges();
    http.expectNone((req) => req.method === 'POST');
    expect(fixture.nativeElement.querySelector('[role="dialog"]').textContent).toContain('Camisa');
    component.promotionForm.patchValue({ discount_percent: 17 });
    component.save();
    const create = http.expectOne((req) => req.method === 'POST');
    expect(create.request.body.product_ids).toEqual(['p1']);
    expect(create.request.body.discount_percent).toBe(17);
    create.flush({ id: 'promo', ...create.request.body });
    http.expectOne((req) => req.url.endsWith('/promotions')).flush([]);
    http.expectOne((req) => req.url.endsWith('/suggestions/stock-age')).flush([]);
    expect(component.isModalOpen()).toBe(false);
    fixture.destroy();
    http.verify();
  });

  it('cancel does not create a promotion and a manual draft clears the target', () => {
    const { fixture, http, component } = setup();
    component.useSuggestion(suggestion);
    component.closeModal();
    http.expectNone((req) => req.method === 'POST');
    component.openCreateModal();
    expect(component.draft()).toBeNull();
    fixture.destroy();
    http.verify();
  });

  it('keeps the draft open if stock or a concurrent campaign prevents creation', () => {
    const { fixture, http, component } = setup();
    component.useSuggestion(suggestion);
    component.save();
    http
      .expectOne((req) => req.method === 'POST')
      .flush(
        { detail: 'La prenda ya tiene una promoción.' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(component.isModalOpen()).toBe(true);
    expect(component.modalError()).toContain('ya tiene');
    expect(component.draft()?.product_id).toBe('p1');
    fixture.destroy();
    http.verify();
  });

  it('hides stock-age suggestions for managers and shows network failures for administrators', () => {
    const { fixture, http } = setup('STORE_MANAGER');
    expect(fixture.nativeElement.textContent).not.toContain('Sugerir descuento');
    fixture.destroy();
    http.verify();
  });
});
