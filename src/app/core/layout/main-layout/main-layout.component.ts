import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { EMPTY, catchError, filter, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth.service';
import { ActivityLogService } from '../../services/activity-log.service';
import { UserAvatarComponent } from '../../components/user-avatar.component';

@Component({
  selector: 'app-main-layout', standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, UserAvatarComponent],
  templateUrl: './main-layout.component.html', styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly activity = inject(ActivityLogService);
  readonly isSidebarCollapsed = signal(globalThis.matchMedia?.('(max-width: 960px)').matches ?? false);
  readonly roleLabel = computed(() => ({ ADMIN: 'Administrador', STORE_MANAGER: 'Encargado de sucursal', CASHIER: 'Cajero', CUSTOMER: 'Cliente' })[this.authService.currentUser()?.role ?? 'CUSTOMER']);
  readonly groups = computed(() => {
    const role = this.authService.currentUser()?.role;
    const admin = role === 'ADMIN'; const manager = admin || role === 'STORE_MANAGER';
    const sales = manager || role === 'CASHIER';
    return [
      { title: 'Tu espacio', links: [
        ...(manager ? [{ path: '/dashboard', label: 'Panel principal', icon: 'home' }] : []),
        ...(role === 'CUSTOMER' ? [{ path: '/catalog', label: 'Catálogo', icon: 'hanger' }, { path: '/reports', label: 'Reportes por voz', icon: 'chart' }] : []),
      ] },
      { title: 'Inventario', links: manager ? [
        { path: '/products', label: 'Prendas', icon: 'hanger' },
        { path: '/catalog-attributes', label: 'Tallas y colores', icon: 'tag' },
        { path: '/seasons', label: 'Temporadas', icon: 'calendar' },
        { path: '/promotions', label: 'Promociones', icon: 'tag' },
        { path: '/suppliers', label: 'Proveedores', icon: 'box' },
      ] : [] },
      { title: 'Ventas y stock', links: sales ? [
        { path: '/branch-availability', label: 'Stock por sucursal', icon: 'box' },
        { path: '/inventory-movements', label: 'Movimientos', icon: 'arrows' },
        { path: '/reservations', label: 'Reservas', icon: 'calendar' },
        { path: '/payments', label: 'Pagos', icon: 'wallet' },
      ] : [] },
      { title: 'Inteligencia', links: manager ? [
        { path: '/reports', label: 'Reportes', icon: 'chart' },
        { path: '/recommendations', label: 'Recomendaciones', icon: 'spark' },
        ...(admin ? [{ path: '/activity-log', label: 'Actividad', icon: 'list' }] : []),
      ] : [] },
      { title: 'Administración', links: admin ? [
        { path: '/users', label: 'Personal', icon: 'person' },
        { path: '/branches', label: 'Sucursales', icon: 'home' },
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
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      switchMap(e => this.activity.record({ action: 'NAVEGACION', description: `Navegación a la vista: ${e.urlAfterRedirects}`, category: 'SISTEMA' }).pipe(catchError(() => EMPTY))),
      takeUntilDestroyed(this.destroyRef)).subscribe();
  }
  toggleSidebar(): void { this.isSidebarCollapsed.update(v => !v); }
  onNavigate(): void { if (globalThis.matchMedia?.('(max-width: 960px)').matches) this.isSidebarCollapsed.set(true); }
  logout(): void { this.authService.logout(); }
}
