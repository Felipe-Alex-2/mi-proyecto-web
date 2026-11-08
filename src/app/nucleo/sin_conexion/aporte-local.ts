import { AlmacenSinConexion } from './almacen-sin-conexion.service';
import { environment } from '../../../environments/environment';

export const ownWrites = ['/own/exchanges','/own/loyalty/redeem','/own/loyalty/apply','/own/loyalty/claim'];
const base=environment.apiUrl.replace(/\/$/,'');
const copy=(value:any)=>structuredClone(value);
const cents=(value:any)=>Math.round(Number(value)*100);
const normalized=(value:string)=>value.trim().toLocaleUpperCase().replace(/^(REC-|FAC-)/,'');

/** Local projections only. The server validates and commits the real operation. */
const queues=new Map<string,Promise<unknown>>();
export class AporteLocal {
  constructor(private store:AlmacenSinConexion) {}
  private operations(savedAt='') {
    return this.store.operations().filter(o=>o.scope===this.store.scope && o.state!=='CONFLICT' &&
      !(o.state==='SYNCED' && (o.confirmed_at||o.created_at)<=savedAt));
  }
  private async purchases(url:string) {
    const cached=await this.store.cached(base+'/own/purchases?for_exchange=true') || await this.store.cached(url);
    if(!cached)return undefined;
    const rows=copy(cached.data) as any[];
    for(const op of this.operations(cached.saved_at).filter(o=>o.path==='/own/exchanges')) {
      const p=rows.find(p=>p.id===(op.body.payment_id||op.body.reservation_id));
      const line=p?.items[op.body.original_line];
      if(line) {
        const quantity=Number(op.body.quantity);
        const taken=line.quantity-line.available_to_exchange;
        const credit=Math.round(cents(line.subtotal??line.unit_price*line.quantity)*(taken+quantity)/line.quantity)-cents(line.credited_amount||0);
        line.available_to_exchange=Math.max(0,line.available_to_exchange-quantity);
        line.credited_amount=(cents(line.credited_amount||0)+credit)/100;
      }
    }
    return {...cached,data:rows};
  }
  async stock(branch:string) {
    const cached=await this.store.cached(base+'/own/stock?branch_id='+encodeURIComponent(branch)) || await this.store.cached(base+'/stocks/branch/'+branch);
    if(!cached)return undefined;
    const rows=copy(cached.data).map((r:any)=>({...r,price:r.price??r.unit_price,size:r.size??r.size_name,color:r.color??r.color_name}));
    for(const op of this.operations(cached.saved_at).filter(o=>o.branch_id===branch)) {
      if(op.path==='/own/exchanges') {
        const next=rows.find((v:any)=>v.variant_id===op.body.new_variant_id);
        if(next)next.quantity=Math.max(0,next.quantity-op.body.quantity);
        const returned=rows.find((v:any)=>v.variant_id===op.preview.returned_variant_id);
        if(returned)returned.quantity+=op.body.quantity;
      }
      if(['/payments/offline-sale','/reservations'].includes(op.path)) {
        for(const item of op.body.items||[]) {const v=rows.find((v:any)=>v.variant_id===item.variant_id);if(v)v.quantity=Math.max(0,v.quantity-item.quantity);}
      }
      if(op.path==='/stocks/adjust' || op.path==='/inventory/movements') {
        const v=rows.find((v:any)=>v.variant_id===op.body.variant_id);
        if(v)v.quantity=op.path==='/stocks/adjust'||op.body.type==='ADJUSTMENT'?op.body.quantity:Math.max(0,v.quantity+(op.body.type==='EXIT'?-op.body.quantity:op.body.quantity));
      }
      if(op.path==='/own/loyalty/claim') {
        const next=rows.find((v:any)=>v.variant_id===op.body.variant_id);if(next)next.quantity=Math.max(0,next.quantity-1);
      }
    }
    return {...cached,data:rows};
  }
  async read(url:string):Promise<any> {
    await this.store.refresh();
    const parsed=new URL(url,location.origin),path=parsed.pathname.slice(new URL(base,location.origin).pathname.length),params=parsed.searchParams;
    if(path==='/own/purchases' && params.get('for_exchange')==='true') {
      const cached=await this.purchases(url);if(!cached)return undefined;
      const term=normalized(params.get('search')||'');
      let rows=cached.data.filter((p:any)=>Date.now()<=Date.parse(p.exchange_deadline||new Date(Date.parse(p.paid_at)+48*3600000).toISOString()));
      rows=rows.filter((p:any)=>!term || (/^(RSV-|PAY-|CAM-)/.test(term)?normalized(p.code)===term:[p.customer_name,p.customer_email,p.code].join(' ').toLocaleUpperCase().includes(term)));
      if(term && !rows.length)throw new Error('No hay un comprobante elegible guardado con ese código. Descárgalo con Internet; el plazo de cambio es de 48 horas.');
      return {...cached,data:rows};
    }
    if(path==='/own/stock')return this.stock(params.get('branch_id')||'');
    if(path==='/own/loyalty') {
      const cached=await this.store.cached(base+path);if(!cached)return undefined;
      const data=copy(cached.data);
      for(const op of this.operations(cached.saved_at).filter(o=>o.path==='/own/loyalty/redeem')) {
        data.balance-=op.preview.points_cost;
        data.rewards=[...data.rewards,{...(op.result||op.preview),code:op.state==='SYNCED'?op.result?.code:'Pendiente de sincronizar',status:op.state==='SYNCED'?op.result?.status:'PENDING'}];
      }
      return {...cached,data};
    }
    if(path==='/promotions/suggestions/stock-age') {
      const cached=await this.store.cached(base+path+'?min_age_minutes=5') || await this.store.cached(url);
      if(!cached)return undefined;
      const minimum=Number(params.get('min_age_minutes')||43200);
      const elapsed=Math.max(0,Math.floor((Date.now()-Date.parse(cached.saved_at))/60000));
      const promoted=new Set(this.operations(cached.saved_at).filter(o=>o.path==='/promotions').flatMap(o=>o.body.product_ids||[]));
      const rows=copy(cached.data).filter((r:any)=>!promoted.has(r.product_id)).map((row:any)=>{
        const minutes=(row.minutes_in_stock??row.days_in_stock*1440)+elapsed,days=row.days_in_stock+Math.floor(elapsed/1440);
        const discount=days>=180?30:days>=120?25:days>=90?20:days>=60?15:10;
        return {...row,minutes_in_stock:minutes,days_in_stock:days,discount_percent:discount,estimated:true,
          reason:'Propuesta local basada en el stock descargado. '+row.reason};
      }).filter((r:any)=>(minimum<43200?r.minutes_in_stock:r.days_in_stock*1440)>=minimum);
      return {...cached,data:rows};
    }
    return this.store.cached(url);
  }
  queue(path:string,body:any):Promise<any> {
    const scope=this.store.scope;
    if(navigator.locks)return navigator.locks.request('vesta-own-'+scope,()=>this.queueUnlocked(path,body,scope));
    const pending=(queues.get(scope)||Promise.resolve()).catch(()=>{}).then(()=>this.queueUnlocked(path,body,scope));
    queues.set(scope,pending);return pending;
  }
  private async queueUnlocked(path:string,body:any,scope:string) {
    const user=this.store.tokens.getIdentity();if(!user)throw new Error('Inicia sesión para guardar pendientes.');
    const customer=path.endsWith('/redeem');
    if(customer?user.role!=='CUSTOMER':!['ADMIN','STORE_MANAGER','CASHIER'].includes(user.role))throw new Error('Tu rol no permite esta operación.');
    let preview:any={};let branch=body.branch_id||user.branch_id||'';
    if(path==='/own/exchanges') {
      const cached=await this.purchases(base+'/own/purchases?for_exchange=true');
      const p=cached?.data.find((p:any)=>p.id===(body.payment_id||body.reservation_id));
      if(!p)throw new Error('Descarga el comprobante con Internet antes de registrar el cambio.');
      if(Date.now()>Date.parse(p.exchange_deadline||new Date(Date.parse(p.paid_at)+48*3600000).toISOString()))throw new Error('Pasó el límite de 48 horas para cambiar esta compra.');
      branch=p.branch_id;
      if(user.role!=='ADMIN' && branch!==user.branch_id)throw new Error('El cambio debe pertenecer a tu sucursal.');
      const item=p.items[body.original_line],stock=await this.stock(branch),replacement=stock?.data.find((r:any)=>r.variant_id===body.new_variant_id);
      if(!item || !Number.isInteger(body.quantity) || body.quantity<1 || body.quantity>item.available_to_exchange || !body.resellable)throw new Error('Cantidad de cambio no válida para el comprobante descargado.');
      if(!replacement || replacement.quantity<body.quantity || replacement.variant_id===item.variant_id)throw new Error('Stock local insuficiente o variante incorrecta.');
      const taken=item.quantity-item.available_to_exchange;
      const credit=Math.round(cents(item.subtotal??item.unit_price*item.quantity)*(taken+body.quantity)/item.quantity)-cents(item.credited_amount||0);
      const difference=cents(replacement.price)*body.quantity-credit;
      if(difference<0 || difference!==cents(body.expected_difference) || (difference>0&&!body.confirm_cash))throw new Error('Revisa la diferencia del cambio antes de guardar.');
      preview={branch_id:branch,returned_variant_id:item.variant_id,receipt_payment_id:null,difference:difference/100};
    }
    if(customer) {
      const cached=await this.read(base+'/own/loyalty'),option=cached?.data.options.find((o:any)=>o.id===body.reward);
      if(!option || cached.data.balance<option.points)throw new Error('Puntos locales insuficientes o saldo no descargado.');
      preview={points_cost:option.points,discount_percent:option.percent,reward_type:body.reward==='MYSTERY'?'MYSTERY':'COUPON',code:null};
    }
    if(path.endsWith('/claim')) {
      const stock=await this.stock(branch),variant=stock?.data.find((v:any)=>v.variant_id===body.variant_id);
      if(!variant || variant.quantity<1)throw new Error('No hay stock local para esta entrega.');
    }
    if(path.endsWith('/claim')||path.endsWith('/apply')) {
      if(this.operations().some(o=>['/own/loyalty/claim','/own/loyalty/apply'].includes(o.path)&&o.body.code?.toUpperCase()===body.code?.trim().toUpperCase()))throw new Error('Este código ya tiene una operación pendiente.');
    }
    if(scope!==this.store.scope)throw new Error('La cuenta o empresa cambió. Vuelve a abrir el formulario.');
    return this.store.enqueue(path,body,preview,'POST',false,branch);
  }
}
