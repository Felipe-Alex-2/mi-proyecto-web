import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { TokenService } from '../services/token.service';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

export function getDefaultRouteForRole(role?: UserRole | string): string {
  if (role === 'CUSTOMER') {
    return '/catalog';
  }
  if (role === 'CASHIER') {
    return '/payments';
  }
  return '/dashboard';
}

export const authGuard: CanActivateFn = () => {
  const tokenService = inject(TokenService);
  const router = inject(Router);

  if (tokenService.hasToken()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

export const guestGuard: CanActivateFn = () => {
  const tokenService = inject(TokenService);
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!tokenService.hasToken()) {
    return true;
  }

  const user = authService.currentUser();
  if (user) {
    return router.parseUrl(getDefaultRouteForRole(user.role));
  }

  return authService.loadCurrentUser().pipe(
    map((loadedUser) => router.parseUrl(getDefaultRouteForRole(loadedUser?.role))),
    catchError(() => of(true))
  );
};

export const dashboardGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const tokenService = inject(TokenService);
  const router = inject(Router);

  if (!tokenService.hasToken()) {
    router.navigate(['/login']);
    return false;
  }

  const user = authService.currentUser();
  if (user) {
    if (user.role === 'ADMIN' || user.role === 'STORE_MANAGER') {
      return true;
    }
    return router.parseUrl(getDefaultRouteForRole(user.role));
  }

  return authService.loadCurrentUser().pipe(
    map((loadedUser) => {
      if (loadedUser?.role === 'ADMIN' || loadedUser?.role === 'STORE_MANAGER') {
        return true;
      }
      return router.parseUrl(getDefaultRouteForRole(loadedUser?.role));
    }),
    catchError(() => of(router.parseUrl('/login')))
  );
};

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const tokenService = inject(TokenService);
  const router = inject(Router);

  if (!tokenService.hasToken()) {
    router.navigate(['/login']);
    return false;
  }

  const user = authService.currentUser();
  if (user) {
    return user.role === 'ADMIN' ? true : router.parseUrl(getDefaultRouteForRole(user.role));
  }

  return authService.loadCurrentUser().pipe(
    map((loadedUser) => loadedUser?.role === 'ADMIN' ? true : router.parseUrl(getDefaultRouteForRole(loadedUser?.role))),
    catchError(() => of(router.parseUrl('/login')))
  );
};

export const managerGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const tokenService = inject(TokenService);
  const router = inject(Router);

  if (!tokenService.hasToken()) {
    router.navigate(['/login']);
    return false;
  }

  const user = authService.currentUser();
  if (user) {
    return (user.role === 'ADMIN' || user.role === 'STORE_MANAGER')
      ? true
      : router.parseUrl(getDefaultRouteForRole(user.role));
  }

  return authService.loadCurrentUser().pipe(
    map((loadedUser) =>
      (loadedUser?.role === 'ADMIN' || loadedUser?.role === 'STORE_MANAGER')
        ? true
        : router.parseUrl(getDefaultRouteForRole(loadedUser?.role))
    ),
    catchError(() => of(router.parseUrl('/login')))
  );
};

export const reportsGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const tokenService = inject(TokenService);
  const router = inject(Router);

  if (!tokenService.hasToken()) {
    router.navigate(['/login']);
    return false;
  }

  const user = authService.currentUser();
  if (user) {
    // ADMIN, STORE_MANAGER y CUSTOMER pueden ver reportes
    return (user.role === 'ADMIN' || user.role === 'STORE_MANAGER' || user.role === 'CUSTOMER')
      ? true
      : router.parseUrl(getDefaultRouteForRole(user.role));
  }

  return authService.loadCurrentUser().pipe(
    map((loadedUser) =>
      (loadedUser?.role === 'ADMIN' || loadedUser?.role === 'STORE_MANAGER' || loadedUser?.role === 'CUSTOMER')
        ? true
        : router.parseUrl(getDefaultRouteForRole(loadedUser?.role))
    ),
    catchError(() => of(router.parseUrl('/login')))
  );
};
