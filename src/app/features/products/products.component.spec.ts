import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ProductsComponent } from './products.component';

describe('Product search request frequency', () => {
  it('waits until typing settles before querying products', async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [ProductsComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
    ] });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ProductsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    http.match(() => true).forEach(req => req.flush([]));
    for (const value of ['l', 'li', 'lino']) {
      component.onSearch({ target: { value } } as unknown as Event);
    }
    http.expectNone(req => req.url.endsWith('/products'));
    await new Promise(resolve => setTimeout(resolve, 350));
    http.expectOne(req => req.url.endsWith('/products') && req.params.get('search') === 'lino').flush([]);
    fixture.destroy();
    http.verify();
  });
});
