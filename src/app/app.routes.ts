import { Routes } from '@angular/router';
import {
  authGuard,
  platformGuard,
  guestGuard,
  adminGuard,
  managerGuard,
  reportsGuard,
  dashboardGuard,
} from './nucleo/guards/autenticacion.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./funcionalidades/autenticacion/inicio_sesion/inicio_sesion.component').then((m) => m.InicioSesionComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./funcionalidades/autenticacion/registro/registro.component').then((m) => m.RegistroComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./funcionalidades/autenticacion/recuperar-contrasena/recuperar-contrasena.component').then(
        (m) => m.RecuperarContrasenaComponent
      ),
    canActivate: [guestGuard],
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./funcionalidades/autenticacion/restablecer-contrasena/restablecer-contrasena.component').then(
        (m) => m.RestablecerContrasenaComponent
      ),
    canActivate: [guestGuard],
  },
  {
    path: 'paypal-return',
    loadComponent: () =>
      import('./funcionalidades/retorno-paypal/retorno-paypal.component').then(
        (m) => m.RetornoPaypalComponent
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./nucleo/layout/principal-layout/principal-layout.component').then(
        (m) => m.PrincipalLayoutComponent
      ),
    canActivate: [authGuard],
    children: [
      {path:'backups',loadComponent:()=>import('./funcionalidades/respaldos/respaldos.component').then(m=>m.RespaldosComponent),canActivate:[adminGuard]},
      {path:'offline',redirectTo:'profile',pathMatch:'full'},
      { path:'companies', loadComponent:()=>import('./funcionalidades/saas/saas.component').then(m=>m.SaasComponent), canActivate:[platformGuard], data:{platform:true} },
      { path:'subscription', loadComponent:()=>import('./funcionalidades/saas/saas.component').then(m=>m.SaasComponent), canActivate:[managerGuard] },
      { path:'my-history', loadComponent:()=>import('./funcionalidades/saas/historial-cliente.component').then(m=>m.HistorialClienteComponent) },
      { path: 'profile', loadComponent: () => import('./funcionalidades/perfil/perfil.component').then(m => m.PerfilComponent) },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./funcionalidades/panel_principal/panel_principal.component').then(
            (m) => m.PanelPrincipalComponent
          ),
        canActivate: [dashboardGuard],
      },
      {
        path: 'catalog',
        loadComponent: () =>
          import('./funcionalidades/catalogo/catalogo.component').then(
            (m) => m.CatalogoComponent
          ),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./funcionalidades/reportes/reportes.component').then(
            (m) => m.ReportesComponent
          ),
        canActivate: [reportsGuard],
      },
      {
        path: 'recommendations',
        loadComponent: () =>
          import('./funcionalidades/recomendaciones/recomendaciones.component').then(
            (m) => m.RecomendacionesComponent
          ),
      },
      {
        path: 'activity-log',
        loadComponent: () =>
          import('./funcionalidades/bitacora/bitacora.component').then(
            (m) => m.BitacoraComponent
          ),
        canActivate: [managerGuard],
      },
      // Módulo 1: Seguridad y Personal (Solo ADMIN)
      {
        path: 'users',
        loadComponent: () =>
          import('./funcionalidades/usuarios/usuarios.component').then(
            (m) => m.UsuariosComponent
          ),
        canActivate: [adminGuard],
      },
      {
        path: 'branches',
        loadComponent: () =>
          import('./funcionalidades/sucursales/sucursales.component').then(
            (m) => m.SucursalesComponent
          ),
        canActivate: [adminGuard],
      },
      // Módulo 2: Catálogo y Proveedores (ADMIN y STORE_MANAGER)
      {
        path: 'products',
        loadComponent: () =>
          import('./funcionalidades/productos/productos.component').then(
            (m) => m.ProductosComponent
          ),
        canActivate: [managerGuard],
      },
      {
        path: 'catalog-attributes',
        loadComponent: () =>
          import('./funcionalidades/atributos-catalogo/atributos-catalogo.component').then(
            (m) => m.AtributosCatalogoComponent
          ),
        canActivate: [managerGuard],
      },
      {
        path: 'seasons',
        loadComponent: () =>
          import('./funcionalidades/temporadas/temporadas.component').then(
            (m) => m.TemporadasComponent
          ),
        canActivate: [managerGuard],
      },
      {
        path: 'promotions',
        loadComponent: () =>
          import('./funcionalidades/promociones/promociones.component').then(
            (m) => m.PromocionesComponent
          ),
        canActivate: [managerGuard],
      },
      {
        path: 'suppliers',
        loadComponent: () =>
          import('./funcionalidades/proveedores/proveedores.component').then(
            (m) => m.ProveedoresComponent
          ),
        canActivate: [managerGuard],
      },
      // Módulo 3: Inventario, Catálogo Digital y Reservas
      {
        path: 'inventory-movements',
        loadComponent: () =>
          import('./funcionalidades/movimientos-inventario/movimientos-inventario.component').then(
            (m) => m.MovimientosInventarioComponent
          ),
      },
      {
        path: 'branch-availability',
        loadComponent: () =>
          import('./funcionalidades/disponibilidad-sucursal/disponibilidad-sucursal.component').then(
            (m) => m.DisponibilidadSucursalComponent
          ),
      },
      {
        path: 'reservations',
        loadComponent: () =>
          import('./funcionalidades/reservas-admin/reservas-admin.component').then(
            (m) => m.ReservasAdminComponent
          ),
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./funcionalidades/pagos/pagos.component').then(
            (m) => m.PagosComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
