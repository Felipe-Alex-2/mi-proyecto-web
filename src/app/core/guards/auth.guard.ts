import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { TokenService } from '../services/token.service';
import { AuthService } from '../services/auth.service';

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
  const router = inject(Router);

  if (!tokenService.hasToken()) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
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
    return user.role === 'ADMIN' ? true : router.parseUrl('/dashboard');
  }

  return authService.loadCurrentUser().pipe(
    map((loadedUser) => loadedUser?.role === 'ADMIN' ? true : router.parseUrl('/dashboard')),
    catchError(() => of(router.parseUrl('/login')))
  );
};
