import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserAvatarComponent } from '../../core/components/user-avatar.component';
@Component({selector: 'app-dashboard', standalone: true, imports: [RouterLink, UserAvatarComponent], templateUrl: './dashboard.component.html', styleUrl: './dashboard.component.css'})
export class DashboardComponent { readonly authService = inject(AuthService); }
