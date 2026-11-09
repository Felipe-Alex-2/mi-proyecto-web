import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TiempoRealService, REALTIME_SOCKET, RealtimeEvent } from './tiempo-real.service';
import { AutenticacionService } from './autenticacion.service';
import { TokenService } from './token.service';

class Socket {
  onopen:(()=>void)|null=null;
  onclose:(()=>void)|null=null;
  onerror:(()=>void)|null=null;
  onmessage:((event:{data:string})=>void)|null=null;
  send=vi.fn();close=vi.fn();
  message(type:string){this.onmessage?.({data:JSON.stringify({type,reservation_id:'reservation'})});}
}
describe('WebSocket realtime session',()=>{
  afterEach(()=>{TestBed.resetTestingModule();vi.useRealTimers();});
  function setup(){
    const user=signal<any>({id:'client',role:'CUSTOMER',selected_tenant_id:'company',branch_id:'branch'});
    const token='header.'+btoa(JSON.stringify({sub:'client',exp:Math.floor(Date.now()/1000)+3600}))+'.signature';
    const sockets:Socket[]=[],urls:string[]=[];
    TestBed.configureTestingModule({providers:[
      {provide:AutenticacionService,useValue:{currentUser:user}},
      {provide:TokenService,useValue:{getAccessToken:()=>token}},
      {provide:REALTIME_SOCKET,useValue:(url:string)=>{urls.push(url);const socket=new Socket();sockets.push(socket);return socket as unknown as WebSocket;}},
    ]});
    const service=TestBed.inject(TiempoRealService),events:RealtimeEvent[]=[];
    service.events$.subscribe(e=>events.push(e));TestBed.tick();
    return {service,sockets,urls,user,events,token};
  }
  it('authenticates in a frame, refreshes snapshots and announces new reservations',()=>{
    const {service,sockets,urls,events,token}=setup();const socket=sockets[0];
    expect(urls[0]).toMatch(/^wss?:/);expect(urls[0]).not.toContain(token);
    socket.onopen?.();expect(JSON.parse(socket.send.mock.calls[0][0])).toMatchObject({type:'authenticate',token,tenant_id:'company',branch_id:'branch'});
    socket.message('ready');expect(service.connected()).toBe(true);expect(events[0].type).toBe('resync');
    socket.message('reservation.created');expect(service.notice()?.reservation_id).toBe('reservation');
    socket.message('heartbeat');expect(events.at(-1)?.type).toBe('resync');
  });
  it('reconnects after a dropped socket and ignores callbacks from the previous company',()=>{
    vi.useFakeTimers();const {service,sockets,user,events}=setup();
    const previous=sockets[0].onmessage;sockets[0].onclose?.();
    expect(service.connected()).toBe(false);vi.advanceTimersByTime(1000);expect(sockets).toHaveLength(2);
    user.set({...user(),selected_tenant_id:'other-company',branch_id:'other-branch'});TestBed.tick();
    expect(sockets[1].close).toHaveBeenCalled();expect(sockets).toHaveLength(3);
    previous?.({data:JSON.stringify({type:'reservation.created',reservation_id:'private-old-company'})});
    expect(events).toHaveLength(0);expect(service.notice()).toBeNull();
    user.set(null);TestBed.tick();expect(sockets[2].close).toHaveBeenCalled();
    vi.advanceTimersByTime(60000);expect(sockets).toHaveLength(3);
  });
});
