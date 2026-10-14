import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, of, map, finalize, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenService } from './token.service';
import { User, UserUpdate } from '../models/user.model';
import {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  MessageResponse,
  RefreshTokenRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../models/auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private userRequest$?: Observable<User | null>;
  private userRequestToken: string | null = null;
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
    const token = this.tokenService.getAccessToken();
    if (!token) return of(null);
    if (this.userRequest$ && this.userRequestToken === token) return this.userRequest$;
    const request$ = this.http.get<User>(`${this.baseUrl}/users/me`).pipe(
      map((user) => this.tokenService.getAccessToken() === token ? user : null),
      tap((user) => {
        if (this.tokenService.getAccessToken() === token) this.currentUserSignal.set(user);
      }),
      catchError((error) => {
        // A temporary outage must not destroy a valid session. Ignore replies
        // belonging to a session that has already logged out or changed user.
        if ((error.status === 401 || error.status === 403) && this.tokenService.getAccessToken() === token) {
          this.tokenService.clearTokens();
          this.currentUserSignal.set(null);
        }
        return of(null);
      }),
      finalize(() => {
        if (this.userRequest$ === request$) this.userRequest$ = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.userRequestToken = token;
    this.userRequest$ = request$;
    return request$;
  }

  updateProfile(payload: UserUpdate): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/users/me`, payload).pipe(
      tap((updated) => this.currentUserSignal.set(updated))
    );
  }

  forgotPassword(email: string): Observable<MessageResponse> {
    this.isLoadingSignal.set(true);
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/forgot-password`, { email }).pipe(
      tap(() => this.isLoadingSignal.set(false)),
      catchError((error) => {
        this.isLoadingSignal.set(false);
        return throwError(() => error);
      })
    );
  }

  resetPassword(payload: ResetPasswordRequest): Observable<MessageResponse> {
    this.isLoadingSignal.set(true);
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/reset-password`, payload).pipe(
      tap(() => this.isLoadingSignal.set(false)),
      catchError((error) => {
        this.isLoadingSignal.set(false);
        return throwError(() => error);
      })
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
