import { TiempoRealService } from '../../nucleo/servicios/tiempo-real.service';
import { Component, DestroyRef, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { auditTime, finalize, forkJoin, Subject, takeUntil } from 'rxjs';
import { AportePropioService } from '../../nucleo/servicios/aporte-propio.service';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { SaasService } from '../../nucleo/servicios/saas.service';
import { PromocionService } from '../../nucleo/servicios/promocion.service';
import { DiscountSuggestion } from '../../nucleo/modelos/promocion.model';

type Mode = 'exchanges'|'transfers'|'loyalty'|'discounts'|'deliveries';
interface StockRow {variant_id:string; product_id:string; product_name:string; sku:string; size:string; color:string; quantity:number; price:number;}
interface Purchase {source?:'payment'|'reservation';reservation_id?:string|null;customer_email?:string|null;customer_phone?:string|null;receipt_issued_at?:string;exchange_deadline?:string;id:string; code:string; branch_id:string; customer_name:string; currency:string; amount:number; paid_at:string; items:any[];}

@Component({
  standalone:true, imports:[CommonModule, FormsModule, RouterLink],
  templateUrl:'./aporte-propio.component.html', styleUrl:'./aporte-propio.component.css',
})
export class AportePropioComponent implements OnInit {
  private realtime = inject(TiempoRealService);
  private api = inject(AportePropioService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroy = inject(DestroyRef);
  private saas = inject(SaasService);
  private promotions = inject(PromocionService);
  readonly auth = inject(AutenticacionService);
  readonly mode = this.route.snapshot.data['mode'] as Mode;
  readonly titles: Record<Mode,string> = {exchanges:'Cambios y devoluciones de prendas', transfers:'Traslados entre sucursales', loyalty:'Fidelización por puntos', discounts:'Descuentos sugeridos', deliveries:'Entregas a domicilio'};
  readonly descriptions: Record<Mode,string> = {
    exchanges:'Busca el código del comprobante, verifica al cliente y elige la prenda del catálogo para el cambio.',
    transfers:'Envía un lote y confirma su recepción. Las prendas permanecen en tránsito hasta llegar.',
    loyalty:'Ranking de clientes y beneficios por compras pagadas: 1 punto por cada USD 10.',
    discounts:'Encuentra prendas con stock desde hace un mes y prepara su promoción.',
    deliveries:'Solicita una entrega o gestiona la preparación y el reparto de una compra pagada.',
  };
  readonly customer = this.auth.currentUser()?.role === 'CUSTOMER';
  readonly loading = signal(false); readonly busy = signal(false);
  readonly error = signal(''); readonly success = signal('');
  readonly rows = signal<any[]>([]); readonly purchases = signal<Purchase[]>([]);
  readonly inventory = signal<StockRow[]>([]); readonly branches = signal<{id:string;name:string;city:string}[]>([]);
  readonly suggestions = signal<DiscountSuggestion[]>([]); readonly loyalty = signal<any>(null);
  readonly receiptId = signal(''); readonly stockLoading = signal(false);
  private stockVersion = 0;
  private contextChanged = new Subject<void>();
  private activeScope = '';
  private initializedScope = false;
  private requests = new Map<string,{body:string; id:string}>();
  search = ''; purchaseId = ''; line = 0; newVariant = ''; quantity = 1;
  resellable = false; confirmCash = false;
  origin = this.auth.currentUser()?.branch_id || ''; destination = ''; transferVariant = ''; transferQuantity = 1;
  transferItems: {variant_id:string; quantity:number; label:string}[] = []; notes = '';
  coupon = ''; pendingPayment = ''; minAgeMinutes = 43200;
  recipient = ''; phone = ''; address = ''; zone = 'CENTRO';
  couriers: Record<string,string> = {}; deliveryNotes: Record<string,string> = {};
  readonly statusLabels: Record<string,string> = {AWAITING_PAYMENT:'Pendiente de pago', REQUESTED:'Por aceptar',ACCEPTED:'Aceptado · preparando',REJECTED:'Rechazado · retiro en sucursal',SENT:'En tránsito', RECEIVED:'Recibido', PENDING:'Pendiente', PREPARING:'En preparación', OUT_FOR_DELIVERY:'En reparto', DELIVERED:'Entregado', FAILED:'Entrega fallida', CANCELLED:'Cancelado', RESERVED:'Reservado en una compra', CLAIMED:'Retirado presencialmente', AVAILABLE:'Disponible', USED:'Utilizado', PAID:'Pagado'};

  constructor() {
    effect(() => {
      const user=this.auth.currentUser();
      const scope=[user?.id,user?.role==='CUSTOMER'?user.selected_tenant_id:user?.tenant_id,user?.branch_id].join('|');
      if(this.initializedScope && scope!==this.activeScope) untracked(()=>{
        this.contextChanged.next();this.stockVersion++;this.rows.set([]);this.purchases.set([]);
        this.inventory.set([]);this.loyalty.set(null);this.receiptId.set('');this.requests.clear();
        this.purchaseId='';this.transferItems=[];this.origin=user?.branch_id||'';this.destination='';
        this.success.set('');this.load();
      });
      this.activeScope=scope;this.initializedScope=true;
    });
  }
  ngOnInit() { this.realtime.events$.pipe(auditTime(150),takeUntilDestroyed(this.destroy)).subscribe(event=>{if(this.mode==='deliveries'&&!this.busy()&&!this.loading()&&(event.type==='resync'||event.type.startsWith('delivery.')||event.type.startsWith('reservation.')))this.load();});this.load(); if(this.mode==='deliveries'){const timer=setInterval(()=>{if(!document.hidden&&!this.busy()&&!this.loading())this.load();},15000);this.destroy.onDestroy(()=>clearInterval(timer));} }
  get purchase() { return this.purchases().find(p=>p.id===this.purchaseId); }
  get item() { return this.purchase?.items[this.line]; }
  get replacements() {
    return this.inventory().filter(v=>v.variant_id!==this.item?.variant_id && v.quantity>0);
  }
  get difference() {
    const variant = this.inventory().find(v=>v.variant_id===this.newVariant);
    const item = this.item;
    if (!variant || !item) return null;
    const cents = Math.round(Number(item.subtotal ?? item.unit_price*item.quantity)*100);
    const previousQuantity = item.quantity - item.available_to_exchange;
    const credit = Math.round(cents*(previousQuantity+this.quantity)/item.quantity) - Math.round(Number(item.credited_amount || 0)*100);
    return (Math.round(Number(variant.price)*100)*this.quantity-credit)/100;
  }
  get visibleSuggestions() { return this.suggestions().filter(row=>(this.minAgeMinutes<43200?(row.minutes_in_stock ?? row.days_in_stock*1440):row.days_in_stock*1440)>=this.minAgeMinutes); }
  get exchangeValid() {
    return !!this.newVariant && this.quantity>=1 && Number.isInteger(this.quantity) &&
      this.quantity <= (this.item?.available_to_exchange || 0) && this.resellable &&
      this.difference !== null && this.difference>=0 && (this.difference===0 || this.confirmCash);
  }
  label(row: StockRow) { return `${row.product_name} · ${row.size} · ${row.color} (${row.quantity} disponibles)`; }
  branchName(id: string) { return this.branches().find(b=>b.id===id)?.name || id; }
  private message(e:any) { return typeof e.error?.detail==='string' ? e.error.detail : e.message || 'No se pudo completar la operación. Revisa tu conexión e inténtalo de nuevo.'; }
  private storageKey(key:string) {
    const user=this.auth.currentUser();
    return ['vesta-own-request',user?.id,user?.role==='CUSTOMER'?user.selected_tenant_id:user?.tenant_id,key].join(':');
  }
  private request(key:string, payload:Record<string,unknown>) {
    const body = JSON.stringify(payload);
    const storageKey=this.storageKey(key);
    let previous = this.requests.get(key);
    if (!previous) {try {previous=JSON.parse(sessionStorage.getItem(storageKey)||'null') || undefined;} catch {}}
    if (!previous || previous.body!==body) previous={body,id:crypto.randomUUID()};
    this.requests.set(key,previous);
    try {sessionStorage.setItem(storageKey,JSON.stringify(previous));} catch {}
    return {...payload,request_id:previous.id};
  }
  private submit(path:string, payload:unknown, message:string, done?:(row:any)=>void) {
    if(this.busy()) return;
    this.busy.set(true);this.error.set('');this.success.set('');
    this.api.post(path,payload).pipe(takeUntil(this.contextChanged),takeUntilDestroyed(this.destroy),finalize(()=>this.busy.set(false))).subscribe({
      next:row=>{
        const requestId=(payload as any)?.request_id;
        for(const [key,value] of this.requests) if(value.id===requestId) {
          this.requests.delete(key);try {sessionStorage.removeItem(this.storageKey(key));} catch {}
        }
        this.success.set(row.sync_status==='PENDING'?'Guardado en este dispositivo. Pendiente de validación al recuperar Internet.':message);done?.(row);this.load();
      }, error:e=>this.error.set(this.message(e)),
    });
  }
  load() {
    this.loading.set(true);this.error.set('');
    if(this.mode==='discounts') {
      this.promotions.suggestDiscounts(this.minAgeMinutes).pipe(takeUntil(this.contextChanged),takeUntilDestroyed(this.destroy),finalize(()=>this.loading.set(false))).subscribe({next:r=>this.suggestions.set(r),error:e=>this.error.set(this.message(e))});return;
    }
    if(this.mode==='loyalty') {
      if(!this.customer) {
        this.saas.directory().subscribe(directory=>this.branches.set(directory.find(c=>c.id===this.auth.currentUser()?.tenant_id)?.branches || []));
        if(this.origin) this.loadInventory(this.origin);
        this.api.get<any[]>('loyalty/ranking').pipe(takeUntil(this.contextChanged),takeUntilDestroyed(this.destroy),finalize(()=>this.loading.set(false))).subscribe({next:r=>this.rows.set(r),error:e=>this.error.set(this.message(e))});return;
      }
      this.api.get('loyalty').pipe(takeUntil(this.contextChanged),takeUntilDestroyed(this.destroy),finalize(()=>this.loading.set(false))).subscribe({next:r=>this.loyalty.set(r),error:e=>this.error.set(this.message(e))});return;
    }
    if(this.mode==='transfers') {
      forkJoin({rows:this.api.get<any[]>('transfers'),directory:this.saas.directory()}).pipe(takeUntil(this.contextChanged),takeUntilDestroyed(this.destroy),finalize(()=>this.loading.set(false))).subscribe({
        next:({rows,directory})=>{this.rows.set(rows);this.branches.set(directory.find(c=>c.id===this.auth.currentUser()?.tenant_id)?.branches || []);if(this.origin) this.loadInventory(this.origin);},error:e=>this.error.set(this.message(e)),
      });return;
    }
    const purchases = this.api.get<Purchase[]>('purchases?search='+encodeURIComponent(this.search)+(this.mode==='exchanges'?'&for_exchange=true':''));
    if(this.mode==='exchanges') {
      this.purchaseId='';this.purchases.set([]);this.inventory.set([]);this.newVariant='';
      purchases.pipe(takeUntil(this.contextChanged),takeUntilDestroyed(this.destroy),finalize(()=>this.loading.set(false))).subscribe({
        next:r=>{
          this.purchases.set(r);
          if(this.search.trim() && r.length===1){this.purchaseId=r[0].id;this.selectPurchase(true);}
        },error:e=>{this.purchaseId='';this.purchases.set([]);this.error.set(this.message(e));},
      });return;
    }
    this.api.get<any[]>('deliveries').pipe(takeUntil(this.contextChanged),takeUntilDestroyed(this.destroy),finalize(()=>this.loading.set(false))).subscribe({next:r=>this.rows.set(r),error:e=>this.error.set(this.message(e))});return;

  }
  selectPurchase(keepReceipt=false) {this.line=0;this.newVariant='';this.confirmCash=false;this.resellable=false;if(!keepReceipt)this.receiptId.set('');if(this.purchase && this.mode==='exchanges')this.loadInventory(this.purchase.branch_id);}
  selectLine() {this.newVariant='';this.confirmCash=false;}
  loadInventory(id:string) {
    const version=++this.stockVersion;this.inventory.set([]);this.stockLoading.set(true);
    this.api.get<StockRow[]>('stock?branch_id='+encodeURIComponent(id)).pipe(takeUntil(this.contextChanged),takeUntilDestroyed(this.destroy)).subscribe({next:r=>{if(version===this.stockVersion){this.inventory.set(r);this.stockLoading.set(false);}},error:e=>{if(version===this.stockVersion){this.error.set(this.message(e));this.stockLoading.set(false);}}});
  }
  changeOrigin() {this.transferItems=[];this.transferVariant='';if(this.origin)this.loadInventory(this.origin);}
  addItem() {
    const row=this.inventory().find(v=>v.variant_id===this.transferVariant);
    if(!row || !Number.isInteger(this.transferQuantity) || this.transferQuantity<1 || this.transferQuantity>row.quantity) {this.error.set('Elige una variante y una cantidad disponible.');return;}
    if(this.transferItems.some(i=>i.variant_id===row.variant_id)){this.error.set('La variante ya está en el lote. Quítala para cambiar su cantidad.');return;}
    this.transferItems=[...this.transferItems,{variant_id:row.variant_id,quantity:this.transferQuantity,label:this.label(row)}];this.transferVariant='';this.transferQuantity=1;this.error.set('');
  }
  exchange() {
    if(!this.exchangeValid)return;
    const payload={...(this.purchase?.source==='reservation'?{reservation_id:this.purchaseId}:{payment_id:this.purchaseId}),original_line:this.line,new_variant_id:this.newVariant,quantity:this.quantity,resellable:true,confirm_cash:this.confirmCash,expected_difference:this.difference};
    this.submit('exchanges',this.request('exchange',payload),'Cambio confirmado. Puedes descargar su comprobante.',r=>{this.receiptId.set(r.receipt_payment_id||'');this.newVariant='';this.confirmCash=false;this.resellable=false;if(this.purchase)this.loadInventory(this.purchase.branch_id);});
  }
  removeItem(id:string) {this.transferItems=this.transferItems.filter(i=>i.variant_id!==id);}
  send() {
    if(!this.origin || !this.destination || this.origin===this.destination || !this.transferItems.length)return;
    this.submit('transfers',this.request('transfer',{origin_id:this.origin,destination_id:this.destination,items:this.transferItems.map(({variant_id,quantity})=>({variant_id,quantity})),notes:this.notes}),'Lote enviado. El destino debe confirmar la recepción.',()=>{this.transferItems=[];this.notes='';});
  }
  canReceive(row:any) {return row.status==='SENT' && (this.auth.currentUser()?.role==='ADMIN'||row.destination_id===this.auth.currentUser()?.branch_id);}
  receive(row:any) {this.submit('transfers/'+row.id+'/receive',{},'Recepción confirmada. Stock actualizado.');}
  redeem(reward:string) {this.submit('loyalty/redeem',this.request('redeem',{reward}),'Beneficio generado. Tu código aparece en tus canjes.',()=>this.requests.delete('redeem'));}
  claimBox() {if(this.coupon.trim() && this.origin && this.newVariant)this.submit('loyalty/claim',{code:this.coupon.trim(),branch_id:this.origin,variant_id:this.newVariant},'Caja entregada. Inventario actualizado.');}
  applyCoupon() {if(this.coupon.trim() && this.pendingPayment.trim())this.submit('loyalty/apply',{code:this.coupon.trim(),payment_id:this.pendingPayment.trim()},'Cupón aplicado. El importe está actualizado en Pagos.');}
  useSuggestion(row:DiscountSuggestion) {this.router.navigate(['/promotions'],{queryParams:{suggestion:row.product_id,...(this.minAgeMinutes<43200?{min_age_minutes:this.minAgeMinutes}:{})}});}
  createDelivery() {
    if(!this.purchaseId || this.recipient.trim().length<2 || this.phone.trim().length<7 || this.address.trim().length<10)return;
    this.submit('deliveries',this.request('delivery',{payment_id:this.purchaseId,recipient:this.recipient.trim(),phone:this.phone.trim(),address:this.address.trim(),zone:this.zone}),'Entrega solicitada. El envío debe pagarse antes de su preparación.',()=>{this.purchaseId='';this.recipient='';this.phone='';this.address='';});
  }
  actions(row:any):string[] {if(row.source==='reservation')return ({REQUESTED:['ACCEPTED','REJECTED'],ACCEPTED:['OUT_FOR_DELIVERY','REJECTED'],OUT_FOR_DELIVERY:['DELIVERED','FAILED'],FAILED:['OUT_FOR_DELIVERY']} as Record<string,string[]>)[row.status]||[];return ({PENDING:['PREPARING','CANCELLED'],PREPARING:['OUT_FOR_DELIVERY','CANCELLED'],OUT_FOR_DELIVERY:['DELIVERED','FAILED'],FAILED:['OUT_FOR_DELIVERY']} as Record<string,string[]>)[row.status] || [];}
  updateDelivery(row:any,status:string) {
    if(this.busy())return;
    this.busy.set(true);this.error.set('');this.success.set('');
    this.api.patch('deliveries/'+row.id,{status,courier:this.couriers[row.id]||row.courier||'',note:this.deliveryNotes[row.id]||''}).pipe(takeUntil(this.contextChanged),takeUntilDestroyed(this.destroy),finalize(()=>this.busy.set(false))).subscribe({next:()=>{this.success.set('Estado de entrega actualizado.');this.load();},error:e=>this.error.set(this.message(e))});
  }
  downloadReceipt() {
    this.api.receipt(this.receiptId()).pipe(takeUntil(this.contextChanged),takeUntilDestroyed(this.destroy)).subscribe({next:blob=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='comprobante-cambio.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},error:e=>this.error.set(this.message(e))});
  }
}
