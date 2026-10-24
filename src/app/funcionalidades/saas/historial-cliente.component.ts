import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { SaasService } from '../../nucleo/servicios/saas.service';

@Component({standalone:true,imports:[CommonModule],styleUrl:'./saas.component.css',template:`
  <section class="saas-page"><p class="eyebrow">TU CUENTA EN VESTA</p><h1>Mis compras y reservas</h1>
  <p>Tu historial se conserva al cambiar de tienda. Cada operación pertenece a la empresa y sucursal donde la realizaste.</p>
  @if(error()){<p role="alert" class="notice error">{{error()}}</p>}
  @if(loading()){<p role="status">Cargando historial…</p>}
  <section class="panel"><h2>Compras y comprobantes</h2><div class="table-scroll"><table><thead><tr><th>Comprobante</th><th>Empresa</th><th>Sucursal</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>
  @for(p of payments();track p.id){<tr><td>{{p.payment_code}}</td><td>{{p.company_name}}</td><td>{{p.branch_name}}</td><td>{{p.amount | currency:p.currency}}</td><td>{{p.status==='PAID'?'Pagado':p.status==='PENDING'?'Pendiente':p.status}}</td><td><button class="secondary" (click)="invoice(p.id)" [disabled]="p.status!=='PAID'">Comprobante PDF</button></td></tr>}
  @empty{<tr><td colspan="6">Todavía no tienes comprobantes de caja.</td></tr>}
  </tbody></table></div></section>
  <section class="panel"><h2>Reservas</h2><div class="table-scroll"><table><thead><tr><th>Reserva</th><th>Empresa</th><th>Sucursal</th><th>Fecha</th><th>Estado</th><th>Total</th></tr></thead><tbody>
  @for(r of reservations();track r.id){<tr><td>{{r.reservation_code}}</td><td>{{r.company_name}}</td><td>{{r.branch_name}}</td><td>{{r.created_at|date:'dd/MM/yyyy'}}</td><td>{{r.status}}</td><td>{{r.total_amount | number:'1.2-2'}}</td></tr>}
  @empty{<tr><td colspan="6">Todavía no tienes reservas.</td></tr>}
  </tbody></table></div></section></section>`})
export class HistorialClienteComponent {
  private api=inject(SaasService); private http=inject(HttpClient);private destroyRef=inject(DestroyRef);
  payments=signal<any[]>([]);reservations=signal<any[]>([]);error=signal('');loading=signal(true);
  constructor(){
    this.api.history().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:rows=>{this.payments.set(rows);this.loading.set(false);},error:()=>{this.error.set('No se pudo cargar tu historial.');this.loading.set(false);}});
    this.http.get<any[]>(`${environment.apiUrl}/reservations`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:rows=>this.reservations.set(rows),error:()=>this.error.set('No se pudieron cargar tus reservas.')});
  }
  invoice(id:string){this.http.get(`${environment.apiUrl}/saas/history/${id}/invoice`,{responseType:'blob'}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:blob=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='comprobante.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},error:()=>this.error.set('No se pudo descargar el comprobante.')});}
}
