import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './autenticacion.interceptor';
import { TokenService } from '../servicios/token.service';
import { environment } from '../../../environments/environment';

describe('Auth interceptor origin boundaries', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), provideRouter([]),
    ] });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(TokenService).saveTokens('private-token', 'refresh');
  });
  afterEach(() => { http.verify(); localStorage.clear(); });

  it('sends credentials only to the configured API', () => {
    for (const url of [`${environment.apiUrl}/products`, 'https://example.com/image', `${environment.apiUrl}-other/products`]) {
      client.get(url).subscribe();
      const req = http.expectOne(url);
      expect(req.request.headers.has('Authorization')).toBe(url === `${environment.apiUrl}/products`);
      req.flush({});
    }
  });

  it('preserves the original store headers on an outbox replay',()=>{
    const tokens=TestBed.inject(TokenService);tokens.storeContext={tenant_id:'new-company',branch_id:'new-branch'};
    client.post(`${environment.apiUrl}/sync/operations`,{}, {headers:{'X-Vesta-Tenant':'original-company','X-Vesta-Branch':'original-branch'}}).subscribe();
    const request=http.expectOne(`${environment.apiUrl}/sync/operations`);
    expect(request.request.headers.get('X-Vesta-Tenant')).toBe('original-company');
    expect(request.request.headers.get('X-Vesta-Branch')).toBe('original-branch');request.flush({});
  });
  it('ignores a rejected request from a previous session', () => {
    client.get(`${environment.apiUrl}/products`).subscribe({ error: () => {} });
    const req = http.expectOne(`${environment.apiUrl}/products`);
    const tokens = TestBed.inject(TokenService);
    tokens.saveTokens('new-token', 'new-refresh');
    req.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(tokens.getAccessToken()).toBe('new-token');
  });
});
