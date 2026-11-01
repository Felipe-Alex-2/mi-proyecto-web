import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenService } from '../servicios/token.service';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const router = inject(Router);

  const apiUrl = environment.apiUrl.replace(/\/$/, '');
  const isApiRequest = req.url === apiUrl || req.url.startsWith(`${apiUrl}/`);
  if (!isApiRequest) return next(req);
  const token = tokenService.getAccessToken();
  const publicRequest = req.url.split('?')[0] === `${apiUrl}/saas/directory`
    || req.url.startsWith(`${apiUrl}/shop/catalog/`);
  const restoringIdentity = req.method === 'GET' && req.url.split('?')[0] === `${apiUrl}/users/me`;

  let authReq = req;
  if (token && !publicRequest) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        ...(!req.url.includes('/sync/operations') && tokenService.storeContext ? {'X-Vesta-Tenant':tokenService.storeContext.tenant_id,'X-Vesta-Branch':tokenService.storeContext.branch_id} : {}),
      },
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if ((error.status === 401 || (error.status === 403 && restoringIdentity)) && token && !publicRequest && tokenService.getAccessToken() === token && !req.url.includes('/auth/login') && !req.url.includes('/auth/register')) {
        tokenService.clearTokens();
        const path = router.url.split(/[?#]/)[0];
        const publicPage = ['/', '/home', '/catalog', '/login', '/register', '/forgot-password', '/reset-password'].includes(path);
        if (!publicPage) {
          if (restoringIdentity) router.navigate(['/home']);
          else router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
        }
      }
      return throwError(() => error);
    })
  );
};
