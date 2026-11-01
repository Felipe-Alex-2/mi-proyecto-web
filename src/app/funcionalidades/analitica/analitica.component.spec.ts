import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { GeneradorSinteticoComponent } from './generador-sintetico.component';
import { ModelosComponent } from './modelos.component';

const dataset = {
  id: 'data-a',
  tenant_id: 'empresa-a',
  name: 'Simulación anual',
  status: 'READY',
  created_at: '2026-11-01T10:00:00Z',
  parameters: {
    date_from: '2025-01-01',
    date_to: '2025-12-31',
    sales: 800,
    customers: 40,
    products: 10,
    seed: 42,
  },
  summary: {
    sales: 800,
    customers: 40,
    products: 10,
    returns: 80,
    injected_anomalies: 24,
    weeks: 51,
    discarded_rows: 0,
    demand_train: 400,
    demand_test: 110,
    preprocessing: 'Solo entrenamiento',
    assumptions: ['Estacionalidad'],
    categories: ['Abrigos'],
    branches: ['Centro'],
  },
};
const run = {
  id: 'run-a',
  tenant_id: 'empresa-a',
  dataset_id: 'data-a',
  status: 'COMPLETED',
  created_at: '2026-11-01T10:00:00Z',
  completed_at: '2026-11-01T10:00:05Z',
  parameters: { request_id: 'request', clusters: 3 },
  metrics: {
    source: 'synthetic',
    sklearn_version: '1.9.1',
    demand: {
      mae: 4,
      rmse: 7,
      r2: -0.1,
      baseline_mae: 5,
      train_rows: 400,
      test_rows: 110,
      train_until: '2025-10-06',
      test_from: '2025-10-13',
    },
    clustering: { silhouette: null, clusters: 3, test_rows: 8 },
    anomalies: {
      precision: 0.8,
      recall: 0.7,
      f1: 0.75,
      detected: 32,
      test_detected: 8,
      test_injected: 10,
    },
  },
  results: { groups: [], forecasts: [], anomalies: [], comparisons: [] },
};

describe('Generación sintética por empresa', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [GeneradorSinteticoComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(GeneradorSinteticoComponent);
    fixture.componentRef.setInput('company', { id: 'empresa-a', name: 'Moda A' });
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      http: TestBed.inject(HttpTestingController),
    };
  }
  it('validates the time window before sending a request', () => {
    const { fixture, component, http } = setup();
    component.form.patchValue({ date_from: '2025-12-01', date_to: '2025-12-31' });
    component.generate();
    expect(component.error()).toContain('90');
    http.expectNone((req) => req.method === 'POST');
    fixture.destroy();
    http.verify();
  });
  it('targets the selected company and keeps a stable request ID across a lost response', () => {
    const { fixture, component, http } = setup();
    component.generate();
    const first = http.expectOne((req) =>
      req.url.endsWith('/saas/companies/empresa-a/synthetic-data'),
    );
    const requestId = first.request.body.request_id;
    first.flush({}, { status: 503, statusText: 'Unavailable' });
    component.generate();
    const second = http.expectOne((req) => req.method === 'POST');
    expect(second.request.body.request_id).toBe(requestId);
    second.flush(dataset);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Conjunto preparado para entrenar');
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toContain(
      'tenant_id=empresa-a',
    );
    component.generate();
    http.expectNone((req) => req.method === 'POST');
    fixture.destroy();
    http.verify();
  });
});

describe('Modelos y entrenamiento', () => {
  function setup(platform = false) {
    const params = new BehaviorSubject(convertToParamMap({ tenant_id: 'empresa-a' }));
    TestBed.configureTestingModule({
      imports: [ModelosComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AutenticacionService,
          useValue: {
            currentUser: signal({
              role: 'ADMIN',
              tenant_id: 'empresa-a',
              company_name: 'Moda A',
              is_saas_admin: platform,
            }),
          },
        },
        { provide: ActivatedRoute, useValue: { queryParamMap: params.asObservable() } },
      ],
    });
    const fixture = TestBed.createComponent(ModelosComponent),
      http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    if (platform)
      http
        .expectOne((req) => req.url.endsWith('/saas/companies'))
        .flush([
          { id: 'empresa-a', name: 'Moda A' },
          { id: 'empresa-b', name: 'Moda B' },
        ]);
    return { fixture, http, params, component: fixture.componentInstance };
  }
  function load(
    http: HttpTestingController,
    datasets: unknown[] = [dataset],
    runs: unknown[] = [],
  ) {
    http.expectOne((req) => req.url.endsWith('/analytics/datasets')).flush(datasets);
    http.expectOne((req) => req.url.endsWith('/analytics/runs')).flush(runs);
  }
  it('shows an empty state and never trains without a dataset', () => {
    const { fixture, http, component } = setup();
    load(http, []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aún no hay datos');
    component.train();
    http.expectNone((req) => req.method === 'POST');
    fixture.destroy();
    http.verify();
  });
  it('trains with the chosen dataset and renders measured results, including negative R² and null silhouette', () => {
    const { fixture, http, component } = setup();
    load(http);
    component.train();
    const request = http.expectOne((req) => req.url.endsWith('/analytics/train'));
    expect(request.request.params.get('tenant_id')).toBe('empresa-a');
    expect(request.request.body.dataset_id).toBe('data-a');
    request.flush(run);
    load(http, [dataset], [run]);
    http.expectOne((req) => req.url.endsWith('/analytics/runs/run-a')).flush(run);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Modelos guardados');
    expect(fixture.nativeElement.textContent).toContain('No disponible');
    expect(fixture.nativeElement.textContent).toContain('−1 a 1');
    fixture.destroy();
    http.verify();
  });
  it('cancels obsolete company responses before showing a different company', () => {
    const { fixture, http, params, component } = setup(true);
    const oldData = http.expectOne((req) => req.url.endsWith('/analytics/datasets'));
    const oldRuns = http.expectOne((req) => req.url.endsWith('/analytics/runs'));
    params.next(convertToParamMap({ tenant_id: 'empresa-b' }));
    expect(oldData.cancelled).toBe(true);
    expect(oldRuns.cancelled).toBe(true);
    const fresh = http.expectOne((req) => req.url.endsWith('/analytics/datasets'));
    expect(fresh.request.params.get('tenant_id')).toBe('empresa-b');
    fresh.flush([]);
    http.expectOne((req) => req.url.endsWith('/analytics/runs')).flush([]);
    expect(component.selected()).toBeNull();
    fixture.destroy();
    http.verify();
  });
  it('preserves the retry identity after a training connection failure', () => {
    const { fixture, http, component } = setup();
    load(http);
    component.train();
    const first = http.expectOne((req) => req.url.endsWith('/analytics/train')),
      id = first.request.body.request_id;
    first.flush({}, { status: 503, statusText: 'Unavailable' });
    load(http);
    expect(component.error()).toContain('historial');
    component.train();
    const second = http.expectOne((req) => req.url.endsWith('/analytics/train'));
    expect(second.request.body.request_id).toBe(id);
    second.flush({ ...run, status: 'FAILED', error: 'Error controlado' });
    load(http, [dataset], [{ ...run, status: 'FAILED' }]);
    http
      .expectOne((req) => req.url.endsWith('/analytics/runs/run-a'))
      .flush({ ...run, status: 'FAILED', error: 'Error controlado' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Error controlado');
    fixture.destroy();
    http.verify();
  });
});
