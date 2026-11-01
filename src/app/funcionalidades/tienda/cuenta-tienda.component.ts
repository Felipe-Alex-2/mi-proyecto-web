import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PerfilComponent } from '../perfil/perfil.component';
@Component({
  standalone: true,
  imports: [PerfilComponent, RouterLink],
  styleUrl: './tienda.css',
  template:
    '<div class="actions section-space"><a class="secondary" routerLink="/purchases">Mis compras y comprobantes</a><a class="secondary" routerLink="/fitting">Mis medidas y vestidor</a><a class="secondary" routerLink="/my-reservations">Mis reservas</a></div><app-profile />',
})
export class CuentaTiendaComponent {}
