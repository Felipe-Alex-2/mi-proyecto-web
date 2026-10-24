import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { SucursalesComponent } from './sucursales.component';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';

describe('Branch municipality selection', () => {
  function setup(department: string | null) {
    TestBed.configureTestingModule({
      imports: [SucursalesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: AutenticacionService, useValue: { currentUser: signal({ role: 'ADMIN' }) } }],
    });
    const fixture = TestBed.createComponent(SucursalesComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(r => r.url.endsWith('/branches')).flush([]);
    http.expectOne(r => r.url.endsWith('/saas/subscription')).flush({ department });
    const component = fixture.componentInstance;
    component.openCreateModal();
    component.branchForm.patchValue({ name: 'Sucursal Centro', address: 'Av. Principal' });
    return { fixture, component, http };
  }

  it('shows only locations of the company department and rejects a city from another', () => {
    const { fixture, component, http } = setup('Santa Cruz');
    fixture.detectChanges();
    const options = [...fixture.nativeElement.querySelectorAll('#popular-cities option')].map((o: any) => o.value);
    expect(options).toContain('Santa Cruz de la Sierra');
    expect(options).toContain('Montero');
    expect(options).not.toContain('Sucre');
    expect(fixture.nativeElement.textContent).toContain('Ciudad/municipio');
    component.branchForm.patchValue({ city: 'Sucre' });
    component.saveBranch();
    http.expectNone(r => r.method === 'POST');
    component.branchForm.patchValue({ city: 'Montero' });
    component.saveBranch();
    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/branches')).flush({});
    http.expectOne(r => r.url.endsWith('/branches')).flush([]);
    fixture.destroy();
    http.verify();
  });

  it('does not default a company in Chuquisaca to La Paz', () => {
    const { fixture, component, http } = setup('Chuquisaca');
    expect(component.branchForm.get('city')?.value).toBe('');
    expect(component.municipalityOptions()).toContain('Sucre');
    expect(component.municipalityOptions()).not.toContain('La Paz');
    fixture.destroy(); http.verify();
  });

  it('requires an assigned department before creating a branch for a legacy company', () => {
    const { fixture, component, http } = setup(null);
    component.branchForm.patchValue({ city: 'La Paz' });
    component.saveBranch();
    http.expectNone(r => r.method === 'POST');
    expect(component.modalError()).toContain('asignar un departamento');
    fixture.destroy(); http.verify();
  });
});
