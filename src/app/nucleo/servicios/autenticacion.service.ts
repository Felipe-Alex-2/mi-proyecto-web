import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, of, map, finalize, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenService } from './token.service';
import { User, UserUpdate } from '../modelos/usuario.model';
import {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  MessageResponse,
  RefreshTokenRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../modelos/autenticacion.model';

@Injectable({
  providedIn: 'root',
})
export class AutenticacionService {
  private readonly destroyRef = inject(DestroyRef);
  private userRequest$?: Observable<User | null>;
  private userRequestToken: string | null = null;
  private contextVersion = 0;
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
    const confirmed = (event: Event) => {
      const user = (event as CustomEvent<User>).detail;
      if (user.id === this.tokenService.getIdentity()?.id) this.acceptUser(user);
    };
    window.addEventListener('vesta-profile-confirmed', confirmed);
    this.destroyRef.onDestroy(() => window.removeEventListener('vesta-profile-confirmed', confirmed));
    const sessionChanged = () => { if (!this.tokenService.hasToken()) this.currentUserSignal.set(null); };
    window.addEventListener('vesta-session-changed', sessionChanged);
    this.destroyRef.onDestroy(() => window.removeEventListener('vesta-session-changed', sessionChanged));
    if (this.tokenService.hasToken()) {
      this.acceptUser(this.tokenService.getIdentity());
      this.loadCurrentUser().subscribe();
    }
  }

  private acceptUser(user:User|null):void {
    this.currentUserSignal.set(user);
    this.tokenService.saveIdentity(user);
    this.tokenService.storeContext=user?.role==='CUSTOMER' && user.selected_tenant_id && user.branch_id
      ? {tenant_id:user.selected_tenant_id,branch_id:user.branch_id} : null;
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
        this.acceptUser(res.user);
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
    const version = this.contextVersion;
    const request$ = this.http.get<User>(`${this.baseUrl}/users/me`).pipe(
      map((user) => this.tokenService.getAccessToken() === token ? (version === this.contextVersion ? user : this.currentUserSignal()) : null),
      tap((user) => {
        if (this.tokenService.getAccessToken() === token) this.acceptUser(user);
      }),
      catchError((error) => {
        if (version !== this.contextVersion) return of(this.currentUserSignal());
        // A temporary outage must not destroy a valid session. Ignore replies
        // belonging to a session that has already logged out or changed user.
        if ((error.status === 401 || error.status === 403) && this.tokenService.getAccessToken() === token) {
          this.tokenService.clearTokens();
          this.currentUserSignal.set(null);
        }
        const cached = this.tokenService.getIdentity();
        return of(error.status === 0 && this.tokenService.getAccessToken() === token ? cached : null);
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
      tap((updated) => this.acceptUser(updated))
    );
  }

  selectStore(selection: {tenant_id:string;branch_id:string|null}): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/saas/selection`, selection).pipe(tap(user=>{
      this.contextVersion++;
      this.userRequest$ = undefined;
      this.acceptUser(user);
    }));
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
    this.router.navigate(['/home']);
  }
}
