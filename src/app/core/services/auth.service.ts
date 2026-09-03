import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, of, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenService } from './token.service';
import { User, UserUpdate } from '../models/user.model';
import {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  MessageResponse,
  RefreshTokenRequest,
} from '../models/auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly baseUrl = environment.apiUrl;

  // Modern Angular signals for reactive state
  private currentUserSignal = signal<User | null>(null);
  private isLoadingSignal = signal<boolean>(false);

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.currentUserSignal());
  readonly isLoading = this.isLoadingSignal.asReadonly();

  constructor(
    private http: HttpClient,
    private tokenService: TokenService,
    private router: Router
  ) {
    if (this.tokenService.hasToken()) {
      this.loadCurrentUser().subscribe();
    }
  }

  register(payload: RegisterRequest): Observable<User> {
    this.isLoadingSignal.set(true);
    return this.http.post<User>(`${this.baseUrl}/auth/register`, payload).pipe(
      tap(() => this.isLoadingSignal.set(false)),
      catchError((error) => {
        this.isLoadingSignal.set(false);
        return throwError(() => error);
      })
    );
  }

  login(payload: LoginRequest): Observable<TokenResponse> {
    this.isLoadingSignal.set(true);
    return this.http.post<TokenResponse>(`${this.baseUrl}/auth/login`, payload).pipe(
      tap((res) => {
        this.tokenService.saveTokens(res.access_token, res.refresh_token);
        this.currentUserSignal.set(res.user);
        this.isLoadingSignal.set(false);
      }),
      catchError((error) => {
        this.isLoadingSignal.set(false);
        return throwError(() => error);
      })
    );
  }

  loadCurrentUser(): Observable<User | null> {
    return this.http.get<User>(`${this.baseUrl}/users/me`).pipe(
      tap((user) => this.currentUserSignal.set(user)),
      catchError(() => {
        this.tokenService.clearTokens();
        this.currentUserSignal.set(null);
        return of(null);
      })
    );
  }

  updateProfile(payload: UserUpdate): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/users/me`, payload).pipe(
      tap((updated) => this.currentUserSignal.set(updated))
    );
  }

  logout(): void {
    const token = this.tokenService.getAccessToken();
    if (token) {
      this.http.post<MessageResponse>(`${this.baseUrl}/auth/logout`, {}).subscribe({
        next: () => {},
        error: () => {},
      });
    }
    this.tokenService.clearTokens();
    this.currentUserSignal.set(null);
    this.router.navigate(['/login']);
  }
}
