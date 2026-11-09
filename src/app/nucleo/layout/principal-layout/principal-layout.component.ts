import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AvisoTiempoRealComponent } from '../../componentes/aviso-tiempo-real.component';
import { AvisoSinConexionComponent } from '../../sin_conexion/aviso-sin-conexion.component';
import { AutenticacionService } from '../../servicios/autenticacion.service';
import { AvatarUsuarioComponent } from '../../componentes/avatar-usuario.component';

@Component({
  selector: 'app-main-layout', standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, AvatarUsuarioComponent, AvisoSinConexionComponent, AvisoTiempoRealComponent],
  templateUrl: './principal-layout.component.html', styleUrl: './principal-layout.component.css',
})
export class PrincipalLayoutComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  readonly authService = inject(AutenticacionService);
  readonly isSidebarCollapsed = signal(globalThis.matchMedia?.('(max-width: 960px)').matches ?? false);
  readonly roleLabel = computed(() => this.authService.currentUser()?.is_saas_admin ? 'Administrador SaaS' : ({ ADMIN: 'Administrador', STORE_MANAGER: 'Encargado de sucursal', CASHIER: 'Cajero', CUSTOMER: 'Cliente' })[this.authService.currentUser()?.role ?? 'CUSTOMER']);
  readonly groups = computed(() => {
    const role = this.authService.currentUser()?.role;
    const admin = role === 'ADMIN'; const manager = admin || role === 'STORE_MANAGER';
    const sales = manager || role === 'CASHIER';
    return [
      { title: 'Tu espacio', links: [
        ...(manager ? [{ path: '/dashboard', label: 'Panel principal', icon: 'home' }] : []),
        ...(role === 'CUSTOMER' ? [{ path: '/catalog', label: 'Catálogo', icon: 'hanger' }, {path:'/my-history',label:'Mis compras y reservas',icon:'calendar'}] : []),
      ] },
      { title: 'Administración', links: admin ? [
        ...(this.authService.currentUser()?.is_saas_admin ? [
          {path:'/companies',label:'Empresas',icon:'home'},
          {path:'/subscription',label:'Mi plan',icon:'tag'},
        ] : []),
        {path:'/backups',label:'Backup',icon:'box'},
        { path: '/users', label: 'Personal', icon: 'person' },
        { path: '/branches', label: 'Sucursales', icon: 'home' },
        { path: '/models', label: 'Modelos y entrenamiento', icon: 'chart' },
      ] : [] },
      { title: 'Inteligencia', links: [
        { path: '/reports', label: 'Reportes', icon: 'chart' },
        ...(manager ? [
        { path: '/recommendations', label: 'Recomendaciones', icon: 'spark' },
        { path: '/activity-log', label: 'Bitácora', icon: 'list' },
        ] : []),
      ] },
      { title: 'Ventas y stock', links: sales ? [
        { path: '/branch-availability', label: 'Stock por sucursal', icon: 'box' },
        { path: '/inventory-movements', label: 'Movimientos', icon: 'arrows' },
        { path: '/reservations', label: 'Reservas', icon: 'calendar' },
        { path: '/payments', label: 'Pagos', icon: 'wallet' },
      ] : [] },
      { title: 'Aporte Propio', links: sales ? [
        {path:'/own/exchanges',label:'Cambios de prendas',icon:'arrows'},
        ...(manager ? [{path:'/own/transfers',label:'Traslados',icon:'box'}] : []),
        {path:'/own/loyalty',label:'Fidelización por puntos',icon:'spark'},
        ...(admin ? [{path:'/own/discounts',label:'Descuentos sugeridos',icon:'tag'}] : []),
        {path:'/own/deliveries',label:'Delivery',icon:'home'},
      ] : [] },
      { title: 'Inventario', links: manager ? [
        { path: '/products', label: 'Catálogo', icon: 'hanger' },
        { path: '/catalog-attributes', label: 'Tallas y colores', icon: 'tag' },
        { path: '/seasons', label: 'Temporadas', icon: 'calendar' },
        { path: '/promotions', label: 'Promociones', icon: 'tag' },
        { path: '/suppliers', label: 'Proveedores', icon: 'box' },
      ] : [] },
    ].filter(group => group.links.length);
  });
  readonly icons: Record<string, string> = {
    home: 'M3 10 12 3l9 7v11h-6v-7H9v7H3z',
    hanger: 'M9 6a3 3 0 1 1 4 3v2l8 6v3H3v-3l9-6',
    box: 'm3 7 9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7M12 11v10',
    tag: 'M3 3h8l10 10-8 8L3 11V3zm4 4h.01',
    calendar: 'M4 5h16v16H4zM8 3v4m8-4v4M4 10h16',
    arrows: 'M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4',
    wallet: 'M3 5h18v15H3zM3 9h18m-5 6h2',
    chart: 'M4 3v18h17M9 17v-6m5 6V7m5 10v-9',
    spark: 'm12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3z',
    list: 'M7 5h14M7 12h14M7 19h14M3 5h.01M3 12h.01M3 19h.01',
    person: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 8 0 0 1 16 0v3',
  };
  ngOnInit(): void {
    if (!this.authService.currentUser()) this.authService.loadCurrentUser().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
  toggleSidebar(): void { this.isSidebarCollapsed.update(v => !v); }
  onNavigate(): void { if (globalThis.matchMedia?.('(max-width: 960px)').matches) this.isSidebarCollapsed.set(true); }
  logout(): void { this.authService.logout(); }
}
