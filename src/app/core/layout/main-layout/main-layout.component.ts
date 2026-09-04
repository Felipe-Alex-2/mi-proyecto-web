import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css'],
})
export class MainLayoutComponent implements OnInit {
  isSidebarCollapsed = signal<boolean>(false);
  module1Open = signal<boolean>(true);  // Default open so user sees it right away
  module2Open = signal<boolean>(false);
  module3Open = signal<boolean>(false);

  constructor(public authService: AuthService) {}

  ngOnInit(): void {
    // Refresh current user data from backend so permissions/roles are always up to date
    this.authService.loadCurrentUser().subscribe();
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

  logout(): void {
    this.authService.logout();
  }
}
