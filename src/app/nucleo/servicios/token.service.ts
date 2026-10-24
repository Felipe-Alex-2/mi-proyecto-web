import { User } from '../modelos/usuario.model';
import { Injectable, inject } from '@angular/core';
import { ContextoSesion } from './contexto-sesion.service';

@Injectable({
  providedIn: 'root',
})
export class TokenService {
  storeContext: {tenant_id:string;branch_id:string}|null = null;
  private readonly session = inject(ContextoSesion);
  private readonly ACCESS_TOKEN_KEY = this.session.key('auth_access_token');
  private readonly REFRESH_TOKEN_KEY = this.session.key('auth_refresh_token');
  private readonly IDENTITY_KEY = this.session.key('vesta_offline_identity');

  getIdentity(): User | null {
    try {
      const user = JSON.parse(localStorage.getItem(this.IDENTITY_KEY) || 'null');
      const token = this.getAccessToken();
      if (!token || !user) return null;
      const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      return claims.sub === user.id ? user : null;
    } catch { return null; }
  }

  saveIdentity(user:User|null):void {
    if (user) localStorage.setItem(this.IDENTITY_KEY,JSON.stringify(user));
    else localStorage.removeItem(this.IDENTITY_KEY);
    window.dispatchEvent(new Event('vesta-session-changed'));
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  saveTokens(accessToken: string, refreshToken: string): void {
    this.storeContext=null;
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  clearTokens(): void {
    this.storeContext=null;
    this.saveIdentity(null);
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  hasToken(): boolean {
    return !!this.getAccessToken();
  }
}
