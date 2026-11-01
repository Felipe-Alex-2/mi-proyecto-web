import { Component } from '@angular/core';
import { AsistenteTiendaComponent } from './asistente-tienda.component';
@Component({
  standalone: true,
  imports: [AsistenteTiendaComponent],
  template: '<app-shop-assistant [embedded]="true" />',
})
export class ParaTiComponent {}
