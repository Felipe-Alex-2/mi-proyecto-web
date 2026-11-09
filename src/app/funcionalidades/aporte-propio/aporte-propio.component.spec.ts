import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { AportePropioComponent } from './aporte-propio.component';

describe('Aporte Propio workflows', () => {
  function setup(mode:string,role='ADMIN') {
    TestBed.configureTestingModule({imports:[AportePropioComponent],providers:[
      provideHttpClient(),provideHttpClientTesting(),provideRouter([]),
      {provide:ActivatedRoute,useValue:{snapshot:{data:{mode}}}},
      {provide:AutenticacionService,useValue:{currentUser:signal({id:'user',role,tenant_id:'company',selected_tenant_id:'company',branch_id:'branch'})}},
    ]});
    const fixture=TestBed.createComponent(AportePropioComponent);fixture.detectChanges();
    return {fixture,component:fixture.componentInstance,http:TestBed.inject(HttpTestingController)};
  }
  const suggestion={product_id:'product',product_name:'Camisa',stock:12,days_in_stock:35,estimated:false,reason:'35 días',discount_percent:10,name:'Rotación Camisa',description:'Antigüedad',start_date:'2026-11-06',end_date:'2026-11-20'};

  it('shows stock over one month and sends the product to Promotions without creating a campaign',async()=>{
    const {fixture,component,http}=setup('discounts');
    http.expectOne(r=>r.url.endsWith('/suggestions/stock-age')).flush([suggestion]);fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Camisa');
    const select:HTMLSelectElement=fixture.nativeElement.querySelector('select');
    select.value=select.options[3].value;select.dispatchEvent(new Event('change'));
    http.expectOne(r=>r.url.includes('min_age_minutes=86400')).flush([]);
    await fixture.whenStable();fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay descuentos pendientes');
    const navigate=vi.spyOn(TestBed.inject(Router),'navigate').mockResolvedValue(true);
    component.useSuggestion(suggestion);
    expect(navigate).toHaveBeenCalledWith(['/promotions'],{queryParams:{suggestion:'product'}});
    http.expectNone(r=>r.method==='POST');fixture.destroy();http.verify();
  });

  it('shows the actual exchange difference and reuses the request after a lost response',()=>{
    const {fixture,component,http}=setup('exchanges');
    http.expectOne(r=>r.url.includes('/own/purchases')).flush([{id:'payment',code:'PAY-1',branch_id:'branch',customer_name:'Cliente',currency:'BOB',amount:100,paid_at:'2026-11-06',items:[{variant_id:'old',quantity:1,unit_price:100,subtotal:100,product_name:'Camisa',available_to_exchange:1}]}]);
    component.purchaseId='payment';component.selectPurchase();
    http.expectOne(r=>r.url.includes('/own/stock')).flush([
      {variant_id:'old',product_id:'p',price:100,quantity:0},
      {variant_id:'new',product_id:'p',price:120,quantity:3},
      {variant_id:'other-product',product_id:'q',price:120,quantity:3},
    ]);
    expect(component.replacements).toHaveLength(2);
    component.newVariant='new';component.resellable=true;
    expect(component.difference).toBe(20);expect(component.exchangeValid).toBe(false);
    component.confirmCash=true;component.exchange();component.exchange();
    const first=http.expectOne(r=>r.url.endsWith('/own/exchanges'));
    expect(first.request.body.expected_difference).toBe(20);
    const id=first.request.body.request_id;
    first.flush({detail:'Respuesta perdida'},{status:503,statusText:'Unavailable'});
    component.exchange();const retry=http.expectOne(r=>r.url.endsWith('/own/exchanges'));
    expect(retry.request.body.request_id).toBe(id);
    retry.flush({detail:'No disponible'},{status:409,statusText:'Conflict'});
    expect(component.error()).toContain('No disponible');fixture.destroy();http.verify();
  });

  it('prevents adding duplicated or unavailable quantities to a transfer',()=>{
    const {fixture,component,http}=setup('transfers');
    http.expectOne(r=>r.url.endsWith('/own/transfers')).flush([]);
    http.expectOne(r=>r.url.endsWith('/saas/directory')).flush([{id:'company',branches:[{id:'branch',name:'Central'},{id:'north',name:'Norte'}]}]);
    http.expectOne(r=>r.url.includes('/own/stock')).flush([{variant_id:'v',product_id:'p',product_name:'Camisa',size:'M',color:'Azul',quantity:2}]);
    component.transferVariant='v';component.transferQuantity=3;component.addItem();expect(component.transferItems).toHaveLength(0);
    component.transferQuantity=2;component.addItem();expect(component.transferItems).toHaveLength(1);
    component.transferVariant='v';component.addItem();expect(component.transferItems).toHaveLength(1);
    component.destination='north';component.send();
    const req=http.expectOne(r=>r.method==='POST');expect(req.request.body.items).toEqual([{variant_id:'v',quantity:2}]);
    req.flush({detail:'Stock cambió'},{status:409,statusText:'Conflict'});
    expect(component.transferItems).toHaveLength(1);fixture.destroy();http.verify();
  });

  it('looks up a mobile receipt, selects its customer and allows another catalog product',()=>{
    const {fixture,component,http}=setup('exchanges');
    http.expectOne(r=>r.url.includes('/own/purchases')).flush([]);
    component.search='REC-RSV-E2C8A6';component.load();
    const lookup=http.expectOne(r=>r.url.includes('/own/purchases'));
    expect(lookup.request.url).toContain('for_exchange=true');
    lookup.flush([{id:'reservation',source:'reservation',reservation_id:'reservation',code:'RSV-E2C8A6',
      branch_id:'branch',customer_name:'Felipe Cliente',customer_email:'felipe@example.com',currency:'USD',amount:50,
      paid_at:'2026-11-07T12:00:00Z',exchange_deadline:'2026-11-09T12:00:00Z',
      items:[{variant_id:'old',quantity:1,unit_price:50,subtotal:50,product_name:'Camisa',available_to_exchange:1}]}]);
    http.expectOne(r=>r.url.includes('/own/stock')).flush([
      {variant_id:'old',product_id:'shirt',price:50,quantity:2},
      {variant_id:'other',product_id:'pants',price:80,quantity:3},
    ]);
    fixture.detectChanges();
    expect(component.purchaseId).toBe('reservation');
    expect(fixture.nativeElement.textContent).toContain('Cliente: Felipe Cliente');
    expect(fixture.nativeElement.textContent).toContain('felipe@example.com');
    component.newVariant='other';component.resellable=true;component.confirmCash=true;component.exchange();
    const exchange=http.expectOne(r=>r.method==='POST');
    expect(exchange.request.body.reservation_id).toBe('reservation');
    expect(exchange.request.body.payment_id).toBeUndefined();
    expect(exchange.request.body.expected_difference).toBe(30);
    exchange.flush({detail:'Prueba de validación'},{status:409,statusText:'Conflict'});
    fixture.destroy();http.verify();
  });

  it('clears any previous purchase and shows the 48-hour error returned by the server',()=>{
    const {fixture,component,http}=setup('exchanges');
    http.expectOne(r=>r.url.includes('/own/purchases')).flush([]);
    component.purchaseId='previous';component.search='RSV-EXPIRED';component.load();
    http.expectOne(r=>r.url.includes('/own/purchases')).flush({detail:'Pasó el límite de cambio de 48 horas desde la emisión del recibo.'},{status:409,statusText:'Conflict'});
    fixture.detectChanges();
    expect(component.purchaseId).toBe('');expect(component.purchases()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Pasó el límite de cambio de 48 horas');
    expect(component.exchangeValid).toBe(false);
    fixture.destroy();http.verify();
  });

  it('shows the customer balance and refuses redeeming in the UI below five points',()=>{
    const {fixture,http}=setup('loyalty','CUSTOMER');
    http.expectOne(r=>r.url.endsWith('/own/loyalty')).flush({balance:4,options:[{id:'COUPON_7',name:'Cupón 7%',points:5}],rewards:[],entries:[]});fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('4');
    const button=Array.from(fixture.nativeElement.querySelectorAll('button')).find((b:any)=>b.textContent.includes('Canjear')) as HTMLButtonElement;
    expect(button.disabled).toBe(true);fixture.destroy();http.verify();
  });

  it('shows delivery errors without inventing successful state changes',()=>{
    const {fixture,component,http}=setup('deliveries');
    http.expectOne(r=>r.url.endsWith('/own/deliveries')).flush([{id:'delivery',status:'PENDING',history:[],shipping_payment_status:'PENDING'}]);
    component.updateDelivery(component.rows()[0],'PREPARING');
    http.expectOne(r=>r.method==='PATCH').flush({detail:'Confirma el cobro del envío'},{status:409,statusText:'Conflict'});
    expect(component.rows()[0].status).toBe('PENDING');expect(component.error()).toContain('Confirma el cobro');fixture.destroy();http.verify();
  });
  it('separates acceptance from dispatch and shows the branch route and USD quote',()=>{
    const {fixture,component,http}=setup('deliveries');
    const row={id:'d',source:'reservation',status:'REQUESTED',recipient:'Felipe',phone:'70001234',address:'Calle 123',history:[],distance_km:2.5,fee:1.44,fee_bob:10,bob_per_usd:6.96,branch_name:'Central',reservation_code:'RSV-123',purchase_payment_status:'PAID',origin_maps_url:'https://www.google.com/maps?q=1,2',destination_maps_url:'https://www.google.com/maps?q=3,4',directions_url:'https://www.google.com/maps/dir/?api=1',estimated_minutes_min:25,estimated_minutes_max:35};
    http.expectOne(r=>r.url.endsWith('/own/deliveries')).flush([row]);fixture.detectChanges();
    expect(component.actions(row)).toEqual(['ACCEPTED','REJECTED']);
    expect(fixture.nativeElement.textContent).toContain('USD 1.44');
    expect(fixture.nativeElement.textContent).toContain('Origen: sucursal');
    expect(fixture.nativeElement.textContent).toContain('Aceptar y apartar pedido');
    component.updateDelivery(row,'ACCEPTED');
    http.expectOne(r=>r.method==='PATCH').flush({...row,status:'ACCEPTED'});
    http.expectOne(r=>r.url.endsWith('/own/deliveries')).flush([{...row,status:'ACCEPTED'}]);
    expect(component.actions(component.rows()[0])).toEqual(['OUT_FOR_DELIVERY','REJECTED']);
    component.couriers['d']='Repartidor Uno';component.updateDelivery(component.rows()[0],'OUT_FOR_DELIVERY');
    const req=http.expectOne(r=>r.method==='PATCH');expect(req.request.body).toMatchObject({status:'OUT_FOR_DELIVERY',courier:'Repartidor Uno'});
    req.flush({...row,status:'OUT_FOR_DELIVERY'});http.expectOne(r=>r.url.endsWith('/own/deliveries')).flush([{...row,status:'OUT_FOR_DELIVERY'}]);
    expect(component.actions(component.rows()[0])).toEqual(['DELIVERED','FAILED']);fixture.destroy();http.verify();
  });

  it('accepts an unquoted request, confirms departure and records cash only on delivery',()=>{
    const {fixture,component,http}=setup('deliveries');
    const row={id:'request',source:'reservation',status:'REQUESTED',recipient:'Felipe',address:'Calle 123',phone:'70001234',history:[],fee:null,fee_collection:'CASH_ON_DELIVERY',purchase_payment_status:'PAID'};
    http.expectOne(r=>r.url.endsWith('/own/deliveries')).flush([row]);fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('pendiente de cálculo');
    expect(fixture.nativeElement.textContent).toContain('Aceptar y apartar pedido');
    component.updateDelivery(row,'ACCEPTED');http.expectOne(r=>r.method==='PATCH').flush({...row,status:'ACCEPTED'});
    http.expectOne(r=>r.url.endsWith('/own/deliveries')).flush([{...row,status:'ACCEPTED'}]);fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Confirmar salida de la moto');
    component.couriers['request']='Moto Uno';component.updateDelivery(component.rows()[0],'OUT_FOR_DELIVERY');
    http.expectOne(r=>r.method==='PATCH').flush({...row,status:'OUT_FOR_DELIVERY',fee:1.44,shipping_payment_status:'PENDING'});
    http.expectOne(r=>r.url.endsWith('/own/deliveries')).flush([{...row,status:'OUT_FOR_DELIVERY',fee:1.44,shipping_payment_status:'PENDING'}]);fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Confirmo que se recibió en efectivo');
    component.feesCollected['request']=true;component.updateDelivery(component.rows()[0],'DELIVERED');
    const req=http.expectOne(r=>r.method==='PATCH');expect(req.request.body.confirm_fee_collected).toBe(true);
    req.flush({...row,status:'DELIVERED'});http.expectOne(r=>r.url.endsWith('/own/deliveries')).flush([]);
    fixture.destroy();http.verify();
  });

  it('shows staff the descending ranking without private reward codes',()=>{
    const {fixture,http}=setup('loyalty');
    http.expectOne(r=>r.url.includes('/saas/directory')).flush([{id:'company',branches:[]}]);
    http.expectOne(r=>r.url.includes('/own/stock')).flush([]);
    http.expectOne(r=>r.url.endsWith('/own/loyalty/ranking')).flush([
      {customer_id:'a',customer_name:'Ana',points:20},{customer_id:'b',customer_name:'Luis',points:2}]);
    fixture.detectChanges();
    const text=fixture.nativeElement.textContent;
    expect(text.indexOf('Ana')).toBeLessThan(text.indexOf('Luis'));
    expect(text).toContain('20 puntos');expect(text).toContain('Confirmar entrega presencial');
    expect(text).not.toContain('Tus canjes');fixture.destroy();http.verify();
  });

  it('loads minute-old stock and carries the chosen threshold to the promotion draft',()=>{
    const {fixture,component,http}=setup('discounts');
    http.expectOne(r=>r.url.endsWith('/suggestions/stock-age')).flush([]);
    fixture.detectChanges();
    const select:HTMLSelectElement=fixture.nativeElement.querySelector('select');
    expect(Array.from(select.options).map(o=>o.textContent?.trim())).toContain('5 minutos');
    expect(Array.from(select.options).map(o=>o.textContent?.trim())).toContain('30 minutos');
    component.minAgeMinutes=5;component.load();
    const row={...suggestion,days_in_stock:0,minutes_in_stock:6};
    http.expectOne(r=>r.url.includes('min_age_minutes=5')).flush([row]);fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('6 minutos');
    expect(component.visibleSuggestions).toHaveLength(1);
    const navigate=vi.spyOn(TestBed.inject(Router),'navigate').mockResolvedValue(true);
    component.useSuggestion(row);
    expect(navigate).toHaveBeenCalledWith(['/promotions'],{queryParams:{suggestion:'product',min_age_minutes:5}});
    component.minAgeMinutes=30;component.load();
    http.expectOne(r=>r.url.includes('min_age_minutes=30')).flush([]);
    expect(component.visibleSuggestions).toHaveLength(0);fixture.destroy();http.verify();
  });

});
