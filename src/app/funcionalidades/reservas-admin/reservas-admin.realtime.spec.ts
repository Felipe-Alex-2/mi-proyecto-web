import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { ReservasAdminComponent } from './reservas-admin.component';
import { ReservaService } from '../../nucleo/servicios/reserva.service';
import { SucursalService } from '../../nucleo/servicios/sucursal.service';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { TiempoRealService, RealtimeEvent } from '../../nucleo/servicios/tiempo-real.service';

describe('Reservation updates received by WebSocket',()=>{
  it('refreshes rows and totals while preserving filters and the open status form',async()=>{
    const events=new Subject<RealtimeEvent>();let rows:any[]=[];
    const reservations={getReservations:vi.fn(()=>of(rows)),getStats:vi.fn(()=>of({total:rows.length}))};
    TestBed.configureTestingModule({imports:[ReservasAdminComponent],providers:[
      {provide:TiempoRealService,useValue:{events$:events}},
      {provide:ReservaService,useValue:reservations},
      {provide:SucursalService,useValue:{getBranches:()=>of([])}},
      {provide:AutenticacionService,useValue:{currentUser:signal({id:'admin',tenant_id:'company',role:'ADMIN'})}},
    ]}).overrideComponent(ReservasAdminComponent,{set:{template:''}});
    const fixture=TestBed.createComponent(ReservasAdminComponent);fixture.detectChanges();
    const component=fixture.componentInstance;
    component.selectedBranchFilter.set('branch');component.selectedStatusFilter.set('PENDING');component.onFilterChange();
    component.isStatusModalOpen.set(true);component.statusForm.patchValue({staff_notes:'Nota que estoy escribiendo'});
    rows=[{id:'new-reservation'}];events.next({type:'reservation.created',reservation_id:'new-reservation'});
    await new Promise(resolve=>setTimeout(resolve,200));fixture.detectChanges();
    expect(component.reservations()[0].id).toBe('new-reservation');
    expect(reservations.getReservations).toHaveBeenLastCalledWith({branch_id:'branch',status:'PENDING'});
    expect(component.stats()?.total).toBe(1);
    expect(component.isStatusModalOpen()).toBe(true);
    expect(component.statusForm.value.staff_notes).toBe('Nota que estoy escribiendo');
    const calls=reservations.getReservations.mock.calls.length;fixture.destroy();
    events.next({type:'reservation.changed'});await new Promise(resolve=>setTimeout(resolve,200));
    expect(reservations.getReservations.mock.calls.length).toBe(calls);
  });
});
