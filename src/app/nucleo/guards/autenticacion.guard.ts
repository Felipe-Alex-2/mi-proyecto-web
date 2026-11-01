import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { TokenService } from '../servicios/token.service';
import { AutenticacionService } from '../servicios/autenticacion.service';
import { UserRole } from '../modelos/usuario.model';

export function getDefaultRouteForRole(role?: UserRole | string): string {
  if (role === 'CUSTOMER') {
    return '/home';
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

  return router.parseUrl('/home');
};

export const guestGuard: CanActivateFn = () => {
  const tokenService = inject(TokenService);
  const authService = inject(AutenticacionService);
  const router = inject(Router);

  if (!tokenService.hasToken()) {
    return true;
  }

  const user = authService.currentUser();
  if (user) {
    return router.parseUrl(getDefaultRouteForRole(user.role));
  }

  return authService.loadCurrentUser().pipe(
    map((loadedUser) => loadedUser ? router.parseUrl(getDefaultRouteForRole(loadedUser.role)) : true),
    catchError(() => of(true))
  );
};

export const dashboardGuard: CanActivateFn = () => {
  const authService = inject(AutenticacionService);
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
      return router.parseUrl(loadedUser ? getDefaultRouteForRole(loadedUser.role) : '/login');
    }),
    catchError(() => of(router.parseUrl('/login')))
  );
};

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AutenticacionService);
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
    map((loadedUser) => loadedUser?.role === 'ADMIN' ? true : router.parseUrl(loadedUser ? getDefaultRouteForRole(loadedUser.role) : '/login')),
    catchError(() => of(router.parseUrl('/login')))
  );
};

export const managerGuard: CanActivateFn = () => {
  const authService = inject(AutenticacionService);
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
        : router.parseUrl(loadedUser ? getDefaultRouteForRole(loadedUser.role) : '/login')
    ),
    catchError(() => of(router.parseUrl('/login')))
  );
};

export const reportsGuard: CanActivateFn = () => {
  const authService = inject(AutenticacionService);
  const tokenService = inject(TokenService);
  const router = inject(Router);

  if (!tokenService.hasToken()) {
    router.navigate(['/login']);
    return false;
  }

  const user = authService.currentUser();
  if (user) {
    // Los reportes empresariales son para administración y encargados.
    return (user.role === 'ADMIN' || user.role === 'STORE_MANAGER')
      ? true
      : router.parseUrl(getDefaultRouteForRole(user.role));
  }

  return authService.loadCurrentUser().pipe(
    map((loadedUser) =>
      (loadedUser?.role === 'ADMIN' || loadedUser?.role === 'STORE_MANAGER')
        ? true
        : router.parseUrl(loadedUser ? getDefaultRouteForRole(loadedUser.role) : '/login')
    ),
    catchError(() => of(router.parseUrl('/login')))
  );
};

export const platformGuard: CanActivateFn = () => {
  const auth = inject(AutenticacionService); const router = inject(Router);
  if (auth.currentUser()) return auth.currentUser()?.is_saas_admin ? true : router.parseUrl('/subscription');
  return auth.loadCurrentUser().pipe(map(user=>user?.is_saas_admin ? true : router.parseUrl('/subscription')));
};
