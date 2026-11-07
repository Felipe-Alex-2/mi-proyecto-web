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
    select.value=select.options[1].value;select.dispatchEvent(new Event('change'));
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
    expect(component.replacements).toHaveLength(1);
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

  it('shows the customer balance and refuses redeeming in the UI below 100 points',()=>{
    const {fixture,http}=setup('loyalty','CUSTOMER');
    http.expectOne(r=>r.url.endsWith('/own/loyalty')).flush({balance:80,rewards:[],entries:[]});fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Te faltan 20 puntos');
    const button=Array.from(fixture.nativeElement.querySelectorAll('button')).find((b:any)=>b.textContent.includes('Canjear')) as HTMLButtonElement;
    expect(button.disabled).toBe(true);fixture.destroy();http.verify();
  });

  it('shows delivery errors without inventing successful state changes',()=>{
    const {fixture,component,http}=setup('deliveries');
    http.expectOne(r=>r.url.includes('/own/purchases')).flush([]);
    http.expectOne(r=>r.url.endsWith('/own/deliveries')).flush([{id:'delivery',status:'PENDING',history:[],shipping_payment_status:'PENDING'}]);
    component.updateDelivery(component.rows()[0],'PREPARING');
    http.expectOne(r=>r.method==='PATCH').flush({detail:'Confirma el cobro del envío'},{status:409,statusText:'Conflict'});
    expect(component.rows()[0].status).toBe('PENDING');expect(component.error()).toContain('Confirma el cobro');fixture.destroy();http.verify();
  });
});
