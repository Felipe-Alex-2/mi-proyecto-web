import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { TokenService } from '../../nucleo/servicios/token.service';
import { getDefaultRouteForRole } from '../../nucleo/guards/autenticacion.guard';

export const customerShopGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AutenticacionService),
    router = inject(Router),
    tokens = inject(TokenService);
  if (!tokens.hasToken())
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url, reason: 'customer-action' },
    });
  const check = (user: ReturnType<typeof auth.currentUser>) =>
    user?.role === 'CUSTOMER'
      ? true
      : router.parseUrl(user ? getDefaultRouteForRole(user.role) : '/login');
  const user = auth.currentUser();
  return user ? check(user) : auth.loadCurrentUser().pipe(map(check));
};

export function shopReturnUrl(role: string | undefined, url: string | null): string {
  if (
    role === 'CUSTOMER' &&
    url &&
    /^\/(home|catalog|for-you|fitting|my-reservations|cart|favorites|notifications|account|purchases|paypal-return)(?:[?/#]|$)/.test(
      url,
    )
  )
    return url;
  return getDefaultRouteForRole(role);
}

export const legacyCustomerPageGuard: CanActivateFn = (route) => {
  const auth = inject(AutenticacionService),
    router = inject(Router);
  const destinations: Record<string, string> = {
    profile: '/account',
    'my-history': '/purchases',
    reservations: '/my-reservations',
    recommendations: '/for-you',
  };
  const redirect = (user: ReturnType<typeof auth.currentUser>) =>
    user?.role === 'CUSTOMER'
      ? router.parseUrl(destinations[route.routeConfig?.path || ''] || '/home')
      : true;
  return auth.currentUser()
    ? redirect(auth.currentUser())
    : auth.loadCurrentUser().pipe(map(redirect));
};

export const staffShopGuard: CanActivateFn = () => {
  const auth = inject(AutenticacionService),
    router = inject(Router);
  const check = (user: ReturnType<typeof auth.currentUser>) =>
    user && ['ADMIN', 'STORE_MANAGER', 'CASHIER'].includes(user.role)
      ? true
      : router.parseUrl('/home');
  return auth.currentUser() ? check(auth.currentUser()) : auth.loadCurrentUser().pipe(map(check));
};

export const shopHomeGuard: CanActivateFn = () => {
  const auth = inject(AutenticacionService),
    router = inject(Router),
    tokens = inject(TokenService);
  if (!tokens.hasToken()) return true;
  const check = (user: ReturnType<typeof auth.currentUser>) =>
    user && user.role !== 'CUSTOMER' ? router.parseUrl(getDefaultRouteForRole(user.role)) : true;
  return auth.currentUser() ? check(auth.currentUser()) : auth.loadCurrentUser().pipe(map(check));
};
