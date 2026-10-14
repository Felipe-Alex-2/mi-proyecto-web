import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { environment } from '../../../environments/environment';

describe('AuthService session loading', () => {
  let http: HttpTestingController;
  let tokens: TokenService;
  const url = `${environment.apiUrl}/users/me`;
  const user = { id: '1', full_name: 'Cliente', email: 'cliente@example.com', role: 'CUSTOMER' };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: 'login', children: [] }])] });
    http = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenService);
    tokens.saveTokens('token', 'refresh');
  });
  afterEach(() => { http.verify(); localStorage.clear(); });

  it('shares the initial request with guards and layout', () => {
    const auth = TestBed.inject(AuthService);
    const received: unknown[] = [];
    auth.loadCurrentUser().subscribe(value => received.push(value));
    auth.loadCurrentUser().subscribe(value => received.push(value));
    http.expectOne(url).flush(user);
    expect(received).toEqual([user, user]);
    expect(auth.currentUser()?.id).toBe('1');
  });

  it('retains tokens after a temporary server failure and can retry', () => {
    const auth = TestBed.inject(AuthService);
    http.expectOne(url).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(tokens.getAccessToken()).toBe('token');
    auth.loadCurrentUser().subscribe();
    http.expectOne(url).flush(user);
    expect(auth.currentUser()?.id).toBe('1');
  });

  it('does not restore a user from a request completed after logout', () => {
    const auth = TestBed.inject(AuthService);
    const pending = http.expectOne(url);
    auth.logout();
    http.expectOne(`${environment.apiUrl}/auth/logout`).flush({});
    pending.flush(user);
    expect(auth.currentUser()).toBeNull();
    expect(tokens.hasToken()).toBe(false);
  });

  it('clears rejected credentials', () => {
    const auth = TestBed.inject(AuthService);
    http.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(tokens.hasToken()).toBe(false);
    expect(auth.currentUser()).toBeNull();
  });
});
