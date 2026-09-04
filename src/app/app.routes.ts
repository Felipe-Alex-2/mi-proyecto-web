import { Routes } from '@angular/router';
import { authGuard, guestGuard, adminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
    canActivate: [guestGuard],
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      ),
    canActivate: [guestGuard],
  },
  {
    path: '',
    loadComponent: () =>
      import('./core/layout/main-layout/main-layout.component').then(
        (m) => m.MainLayoutComponent
      ),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/users/users.component').then(
            (m) => m.UsersComponent
          ),
        canActivate: [adminGuard],
      },
      {
        path: 'branches',
        loadComponent: () =>
          import('./features/branches/branches.component').then(
            (m) => m.BranchesComponent
          ),
        canActivate: [adminGuard],
      },
      {
        path: 'catalog-attributes',
        loadComponent: () =>
          import('./features/catalog-attributes/catalog-attributes.component').then(
            (m) => m.CatalogAttributesComponent
          ),
        canActivate: [adminGuard],
      },
      {
        path: 'seasons',
        loadComponent: () =>
          import('./features/seasons/seasons.component').then(
            (m) => m.SeasonsComponent
          ),
        canActivate: [adminGuard],
      },
      {
        path: 'suppliers',
        loadComponent: () =>
          import('./features/suppliers/suppliers.component').then(
            (m) => m.SuppliersComponent
          ),
        canActivate: [adminGuard],
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
