import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { HttpClient,provideHttpClient,withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting,HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { AlmacenSinConexion } from './almacen-sin-conexion.service';
import { RepositorioSinConexion } from './repositorio-sin-conexion.service';
import { offlineInterceptor } from './sin_conexion.interceptor';
import { TokenService } from '../servicios/token.service';
import { environment } from '../../../environments/environment';

describe('Aporte propio offline operations',()=>{
  const base=environment.apiUrl;
  let store:AlmacenSinConexion,repo:RepositorioSinConexion,http:HttpTestingController,api:HttpClient,user:any;
  beforeEach(()=>{
    vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
    user={id:crypto.randomUUID(),role:'ADMIN',tenant_id:'company',branch_id:'branch',full_name:'Admin'};
    TestBed.configureTestingModule({providers:[provideHttpClient(withInterceptors([offlineInterceptor])),provideHttpClientTesting(),
      {provide:TokenService,useValue:{getIdentity:()=>user}}]});
    store=TestBed.inject(AlmacenSinConexion);repo=TestBed.inject(RepositorioSinConexion);api=TestBed.inject(HttpClient);http=TestBed.inject(HttpTestingController);
  });
  afterEach(()=>{http.verify();vi.restoreAllMocks();});
  async function seed() {
    await store.cache(base+'/own/purchases?for_exchange=true',[{id:'sale',code:'PAY-ABC',branch_id:'branch',source:'payment',
      customer_name:'Felipe',paid_at:new Date().toISOString(),exchange_deadline:new Date(Date.now()+3600000).toISOString(),
      items:[{variant_id:'old',quantity:1,unit_price:50,subtotal:50,available_to_exchange:1,credited_amount:0}]}]);
    await store.cache(base+'/own/stock?branch_id=branch',[{variant_id:'old',product_id:'p',quantity:0,price:50},
      {variant_id:'new',product_id:'q',quantity:2,price:60}]);
  }
  it('searches downloaded receipt codes and queues exchanges with stock projections',async()=>{
    await seed();
    const purchases:any=await firstValueFrom(api.get(base+'/own/purchases?search=REC-PAY-ABC&for_exchange=true'));
    expect(purchases[0].customer_name).toBe('Felipe');
    const payload={request_id:crypto.randomUUID(),payment_id:'sale',original_line:0,new_variant_id:'new',quantity:1,resellable:true,confirm_cash:true,expected_difference:10};
    const change:any=await firstValueFrom(api.post(base+'/own/exchanges',payload));
    expect(change.sync_status).toBe('PENDING');expect(change.receipt_payment_id).toBeNull();
    const inventory:any=await firstValueFrom(api.get(base+'/own/stock?branch_id=branch'));
    expect(inventory.find((r:any)=>r.variant_id==='new').quantity).toBe(1);
    expect(inventory.find((r:any)=>r.variant_id==='old').quantity).toBe(1);
    await expect(firstValueFrom(api.post(base+'/own/exchanges',{...payload,request_id:crypto.randomUUID()}))).rejects.toMatchObject({error:{detail:expect.stringContaining('Cantidad')}});
    expect(store.operations()).toHaveLength(1);http.expectNone(()=>true);
  });
  it('holds points durably and never invents an available coupon offline',async()=>{
    user.role='CUSTOMER';user.selected_tenant_id='company';
    await store.cache(base+'/own/loyalty',{balance:5,rewards:[],entries:[],options:[{id:'COUPON_7',points:5,percent:7}]});
    const result:any=await firstValueFrom(api.post(base+'/own/loyalty/redeem',{request_id:crypto.randomUUID(),reward:'COUPON_7'}));
    expect(result.code).toBeNull();
    const local:any=await firstValueFrom(api.get(base+'/own/loyalty'));
    expect(local.balance).toBe(0);expect(local.rewards[0].status).toBe('PENDING');
    const restored=TestBed.runInInjectionContext(()=>new RepositorioSinConexion());
    expect((await restored.read(base+'/own/loyalty'))?.data.balance).toBe(0);
    await expect(firstValueFrom(api.post(base+'/own/loyalty/redeem',{request_id:crypto.randomUUID(),reward:'COUPON_7'}))).rejects.toMatchObject({error:{detail:expect.stringContaining('Puntos')}});
    expect(store.operations()).toHaveLength(1);
  });
  it('changes minimum stock age offline and creates the proposed promotion as pending',async()=>{
    await store.cache(base+'/promotions/suggestions/stock-age?min_age_minutes=5',[{product_id:'p',product_name:'Camisa',
      minutes_in_stock:45,days_in_stock:0,stock:3,discount_percent:10,reason:'Stock descargado',name:'Oferta',start_date:'2026-11-08',end_date:'2026-11-22'}]);
    const rows:any=await firstValueFrom(api.get(base+'/promotions/suggestions/stock-age?min_age_minutes=30'));
    expect(rows[0].product_id).toBe('p');expect(rows[0].estimated).toBe(true);
    const month:any=await firstValueFrom(api.get(base+'/promotions/suggestions/stock-age'));
    expect(month).toEqual([]);
    const promotion:any=await firstValueFrom(api.post(base+'/promotions',{name:'Oferta Camisa',discount_percent:10,product_ids:['p'],start_date:'2026-11-08',end_date:'2026-11-22'}));
    expect(promotion.sync_status).toBe('PENDING');
    expect(await firstValueFrom(api.get(base+'/promotions/suggestions/stock-age?min_age_minutes=30'))).toEqual([]);
  });
});
