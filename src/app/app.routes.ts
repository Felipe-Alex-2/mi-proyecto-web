import { Routes } from '@angular/router';
import { customerShopGuard, legacyCustomerPageGuard, staffShopGuard, shopHomeGuard } from './funcionalidades/tienda/tienda.guard';
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
    redirectTo: 'home',
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
    loadComponent: () => import('./funcionalidades/tienda/tienda-layout.component').then(m => m.TiendaLayoutComponent),
    children: [
      { path: 'home', loadComponent: () => import('./funcionalidades/tienda/catalogo-tienda.component').then(m => m.CatalogoTiendaComponent), canActivate: [shopHomeGuard], data: { mode: 'home' } },
      { path: 'catalog', loadComponent: () => import('./funcionalidades/tienda/catalogo-tienda.component').then(m => m.CatalogoTiendaComponent) },
      { path: 'favorites', loadComponent: () => import('./funcionalidades/tienda/catalogo-tienda.component').then(m => m.CatalogoTiendaComponent), canActivate: [customerShopGuard], data: { mode: 'favorites' } },
      { path: 'cart', loadComponent: () => import('./funcionalidades/tienda/carrito-tienda.component').then(m => m.CarritoTiendaComponent), canActivate: [customerShopGuard] },
      { path: 'my-reservations', loadComponent: () => import('./funcionalidades/tienda/reservas-tienda.component').then(m => m.ReservasTiendaComponent), canActivate: [customerShopGuard] },
      { path: 'for-you', loadComponent: () => import('./funcionalidades/tienda/para-ti.component').then(m => m.ParaTiComponent), canActivate: [customerShopGuard] },
      { path: 'fitting', loadComponent: () => import('./funcionalidades/tienda/vestidor-tienda.component').then(m => m.VestidorTiendaComponent), canActivate: [customerShopGuard] },
      { path: 'notifications', loadComponent: () => import('./funcionalidades/tienda/notificaciones-tienda.component').then(m => m.NotificacionesTiendaComponent), canActivate: [customerShopGuard] },
      { path: 'account', loadComponent: () => import('./funcionalidades/tienda/cuenta-tienda.component').then(m => m.CuentaTiendaComponent), canActivate: [customerShopGuard] },
      { path: 'purchases', loadComponent: () => import('./funcionalidades/tienda/compras-tienda.component').then(m => m.ComprasTiendaComponent), canActivate: [customerShopGuard] },
    ],
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
      {path:'models',loadComponent:()=>import('./funcionalidades/analitica/modelos.component').then(m=>m.ModelosComponent),canActivate:[adminGuard]},
      {path:'offline',redirectTo:'profile',pathMatch:'full'},
      { path:'companies', loadComponent:()=>import('./funcionalidades/saas/saas.component').then(m=>m.SaasComponent), canActivate:[platformGuard], data:{platform:true} },
      { path:'subscription', loadComponent:()=>import('./funcionalidades/saas/saas.component').then(m=>m.SaasComponent), canActivate:[platformGuard] },
      { path:'my-history', loadComponent:()=>import('./funcionalidades/saas/historial-cliente.component').then(m=>m.HistorialClienteComponent), canActivate: [legacyCustomerPageGuard] },
      { path: 'profile', loadComponent: () => import('./funcionalidades/perfil/perfil.component').then(m => m.PerfilComponent), canActivate: [legacyCustomerPageGuard] },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./funcionalidades/panel_principal/panel_principal.component').then(
            (m) => m.PanelPrincipalComponent
          ),
        canActivate: [dashboardGuard],
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
        canActivate: [legacyCustomerPageGuard],
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
        canActivate: [staffShopGuard],
        loadComponent: () =>
          import('./funcionalidades/movimientos-inventario/movimientos-inventario.component').then(
            (m) => m.MovimientosInventarioComponent
          ),
      },
      {
        path: 'branch-availability',
        canActivate: [staffShopGuard],
        loadComponent: () =>
          import('./funcionalidades/disponibilidad-sucursal/disponibilidad-sucursal.component').then(
            (m) => m.DisponibilidadSucursalComponent
          ),
      },
      {
        path: 'reservations',
        canActivate: [legacyCustomerPageGuard, staffShopGuard],
        loadComponent: () =>
          import('./funcionalidades/reservas-admin/reservas-admin.component').then(
            (m) => m.ReservasAdminComponent
          ),
      },
      {
        path: 'payments',
        canActivate: [staffShopGuard],
        loadComponent: () =>
          import('./funcionalidades/pagos/pagos.component').then(
            (m) => m.PagosComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
