import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { AvatarUsuarioComponent } from '../../nucleo/componentes/avatar-usuario.component';
@Component({selector: 'app-dashboard', standalone: true, imports: [RouterLink, AvatarUsuarioComponent], templateUrl: './panel_principal.component.html', styleUrl: './panel_principal.component.css'})
export class PanelPrincipalComponent { readonly authService = inject(AutenticacionService); }
