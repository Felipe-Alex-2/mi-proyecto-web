import { DestroyRef, Injectable, InjectionToken, effect, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AutenticacionService } from './autenticacion.service';
import { TokenService } from './token.service';

export interface RealtimeEvent { type:string; reservation_id?:string; }
export const REALTIME_SOCKET = new InjectionToken<(url:string)=>WebSocket>('REALTIME_SOCKET', {
  providedIn:'root', factory:()=>url=>new WebSocket(url),
});

@Injectable({providedIn:'root'})
export class TiempoRealService {
  private auth=inject(AutenticacionService);
  private tokens=inject(TokenService);
  private factory=inject(REALTIME_SOCKET);
  private destroy=inject(DestroyRef);
  private revision=signal(0);
  private subject=new Subject<RealtimeEvent>();
  readonly events$=this.subject.asObservable();
  readonly connected=signal(false);
  readonly notice=signal<RealtimeEvent|null>(null);
  private socket:WebSocket|null=null;
  private retry?:ReturnType<typeof setTimeout>;
  private version=0;
  private attempts=0;
  constructor() {
    effect(()=>{
      this.auth.currentUser();this.revision();
      this.stop();this.notice.set(null);this.attempts=0;this.open(this.version);
    });
    const wake=()=>this.revision.update(v=>v+1);
    window.addEventListener('online',wake);
    window.addEventListener('vesta-session-changed',wake);
    this.destroy.onDestroy(()=>{
      this.stop();this.subject.complete();
      window.removeEventListener('online',wake);window.removeEventListener('vesta-session-changed',wake);
    });
  }
  private stop() {
    this.version++;clearTimeout(this.retry);this.connected.set(false);
    const socket=this.socket;this.socket=null;
    if(socket){socket.onclose=null;socket.onmessage=null;socket.onopen=null;socket.close();}
  }
  private open(version:number) {
    const user=this.auth.currentUser(),token=this.tokens.getAccessToken();
    if(!user||!token||version!==this.version||navigator.onLine===false)return;
    try {
      const claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      if(!claims.exp||claims.exp*1000<=Date.now())return;
      const url=new URL(`${environment.apiUrl}/realtime/ws`,location.origin);
      url.protocol=url.protocol==='https:'?'wss:':'ws:';
      const socket=this.factory(url.toString());this.socket=socket;
      socket.onopen=()=>{
        if(version!==this.version)return;
        socket.send(JSON.stringify({type:'authenticate',token,...(user.role==='CUSTOMER'?{
          tenant_id:user.selected_tenant_id,branch_id:user.branch_id}: {})}));
      };
      socket.onmessage=message=>{
        if(version!==this.version)return;
        try {
          const event=JSON.parse(message.data) as RealtimeEvent;
          if(event.type==='ready'){this.connected.set(true);this.attempts=0;this.subject.next({type:'resync'});}
          else if(event.type==='heartbeat'){this.subject.next({type:'resync'});}
          else if(['resync','reservation.created','reservation.changed','delivery.created','delivery.changed','notification.changed'].includes(event.type)){
            if(event.type==='reservation.created'||event.type==='delivery.created')this.notice.set(event);
            this.subject.next(event);
          }
        }catch{/* Ignore malformed transport messages. */}
      };
      socket.onerror=()=>socket.close();
      socket.onclose=()=>{
        if(version!==this.version)return;
        this.connected.set(false);this.socket=null;
        this.retry=setTimeout(()=>this.open(version),Math.min(30000,1000*2**Math.min(this.attempts++,5)));
      };
    }catch {
      this.connected.set(false);
    }
  }
}
