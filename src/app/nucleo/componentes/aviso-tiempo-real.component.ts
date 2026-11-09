import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TiempoRealService } from '../servicios/tiempo-real.service';
import { AutenticacionService } from '../servicios/autenticacion.service';

@Component({selector:'app-realtime-notice',standalone:true,imports:[RouterLink],
  styles:[`:host{display:block}.notice{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:12px 24px;background:#f0e5da;color:#2c211d;border-bottom:1px solid #d9c8ba}.notice a{color:#934832;font-weight:600;min-height:44px;display:inline-flex;align-items:center}.notice button{margin-left:auto;min-width:44px;min-height:44px;background:transparent;border:1px solid #934832;border-radius:8px;color:inherit;cursor:pointer}`],
  template:`@if(realtime.notice();as event){<div class="notice" role="status" aria-live="polite"><span>{{event.type==='delivery.created'?'Nuevo pedido de delivery.':customer?'Tu reserva fue registrada.':'Hay una nueva reserva.'}}</span><a [routerLink]="event.type==='delivery.created'?(customer?'/my-reservations':'/own/deliveries'):(customer?'/my-reservations':'/reservations')" (click)="realtime.notice.set(null)">Ver {{event.type==='delivery.created'?'delivery':'reservas'}}</a><button type="button" aria-label="Cerrar aviso" (click)="realtime.notice.set(null)">×</button></div>}`})
export class AvisoTiempoRealComponent {
  readonly realtime=inject(TiempoRealService);
  private auth=inject(AutenticacionService);
  get customer(){return this.auth.currentUser()?.role==='CUSTOMER';}
}
