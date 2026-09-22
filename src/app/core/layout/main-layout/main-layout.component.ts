import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ActivityLogService } from '../../services/activity-log.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css'],
})
export class MainLayoutComponent implements OnInit {
  isSidebarCollapsed = signal<boolean>(false);
  module1Open = signal<boolean>(false);
  module2Open = signal<boolean>(false);
  module3Open = signal<boolean>(true);  // Default open for Paquete 3
  module4Open = signal<boolean>(true);

  // Helper signals por rol
  isAdmin = computed(() => this.authService.currentUser()?.role === 'ADMIN');
  isStoreManager = computed(() => this.authService.currentUser()?.role === 'STORE_MANAGER');
  isCashier = computed(() => this.authService.currentUser()?.role === 'CASHIER');
  isCustomer = computed(() => this.authService.currentUser()?.role === 'CUSTOMER');

  // Reglas de visualización solicitadas por el usuario:
  // - Encargado de sucursal: no le aparece el módulo 1 (ve Dashboard, Módulo 2, Módulo 3, Módulo 4)
  // - Cajero: solo le aparece el módulo 3 (ocultar Dashboard, Módulo 1, Módulo 2, Módulo 4)
  // - Cliente: solo ve Catálogo Digital y Reportes por Voz (ocultar Dashboard y acordeones administrativos)
  // - Admin: ve todos los módulos
  showDashboard = computed(() => this.isAdmin() || this.isStoreManager());
  showModule1 = computed(() => this.isAdmin());
  showModule2 = computed(() => this.isAdmin() || this.isStoreManager());
  showModule3 = computed(() => this.isAdmin() || this.isStoreManager() || this.isCashier());
  showModule4 = computed(() => this.isAdmin() || this.isStoreManager());
  showCustomerLinks = computed(() => this.isCustomer());

  constructor(
    public authService: AuthService,
    private router: Router,
    private activityLogService: ActivityLogService
  ) {}

  ngOnInit(): void {
    this.authService.loadCurrentUser().subscribe();
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      const navigation = event as NavigationEnd;
      this.activityLogService.record({
        action: 'NAVEGACION',
        description: `Navegación a la vista: ${navigation.urlAfterRedirects}`,
        category: 'SISTEMA',
      }).subscribe();
    });
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed.update((val) => !val);
  }

  toggleModule1(): void {
    this.module1Open.update((val) => !val);
  }

  toggleModule2(): void {
    this.module2Open.update((val) => !val);
  }

  toggleModule3(): void {
    this.module3Open.update((val) => !val);
  }

  toggleModule4(): void {
    this.module4Open.update((val) => !val);
  }

  logout(): void {
    this.authService.logout();
  }
}
