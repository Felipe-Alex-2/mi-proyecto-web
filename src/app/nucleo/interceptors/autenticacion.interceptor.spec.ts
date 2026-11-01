import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
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
  it('consults the public store without attaching a saved session', () => {
    for (const path of ['/saas/directory', '/shop/catalog/products?tenant_id=a&store_branch=b']) {
      client.get(environment.apiUrl + path).subscribe();
      const request = http.expectOne(environment.apiUrl + path);
      expect(request.request.headers.has('Authorization')).toBe(false);
      expect(request.request.headers.has('X-Vesta-Tenant')).toBe(false);
      request.flush({});
    }
  });
  it('keeps browsing the public catalog when a saved session has expired', () => {
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/catalog?search=azul');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    client.get(`${environment.apiUrl}/users/me`).subscribe({error:()=>{}});
    http.expectOne(`${environment.apiUrl}/users/me`).flush({}, {status:401,statusText:'Unauthorized'});
    expect(TestBed.inject(TokenService).hasToken()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
  it('still asks for access when a personal page loses its session', () => {
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/cart');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    client.get(`${environment.apiUrl}/cart`).subscribe({error:()=>{}});
    http.expectOne(`${environment.apiUrl}/cart`).flush({}, {status:401,statusText:'Unauthorized'});
    expect(navigate).toHaveBeenCalledWith(['/login'], {queryParams:{returnUrl:'/cart'}});
  });
  it('returns to the public store if a remembered staff session cannot be restored', () => {
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/dashboard');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    client.get(`${environment.apiUrl}/users/me`).subscribe({error:()=>{}});
    http.expectOne(`${environment.apiUrl}/users/me`).flush({}, {status:401,statusText:'Unauthorized'});
    expect(navigate).toHaveBeenCalledWith(['/home']);
  });
});
