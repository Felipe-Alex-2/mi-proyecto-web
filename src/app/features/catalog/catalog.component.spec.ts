import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CatalogComponent } from './catalog.component';

describe('Catalog request cancellation', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CatalogComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
    ] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('cancels old filters so only the latest result can update the view', () => {
    const fixture = TestBed.createComponent(CatalogComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    http.expectOne(req => req.url.endsWith('/catalog/filters')).flush({});
    const first = http.expectOne(req => req.url.endsWith('/catalog/products'));
    component.search = 'lino';
    component.applyFilters();
    expect(first.cancelled).toBe(true);
    http.expectOne(req => req.params.get('search') === 'lino').flush({ items: [], total: 7 });
    expect(component.total()).toBe(7);
    expect(component.loading()).toBe(false);
    fixture.destroy();
  });

  it('cancels in-flight requests when the component is destroyed', () => {
    const fixture = TestBed.createComponent(CatalogComponent);
    fixture.componentInstance.ngOnInit();
    const requests = http.match(() => true);
    fixture.destroy();
    expect(requests.length).toBe(2);
    expect(requests.every(req => req.cancelled)).toBe(true);
  });
});
