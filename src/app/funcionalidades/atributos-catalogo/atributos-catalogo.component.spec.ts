import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { AtributosCatalogoComponent } from './atributos-catalogo.component';

describe('Catalog attribute counts', () => {
  function setup() {
    TestBed.configureTestingModule({imports:[AtributosCatalogoComponent], providers:[
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      {provide:AutenticacionService, useValue:{}},
    ]});
    const fixture = TestBed.createComponent(AtributosCatalogoComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const counters = () => Array.from(fixture.nativeElement.querySelectorAll('.tab-count') as NodeListOf<HTMLElement>).map(node => node.textContent?.trim());
    const flushLists = (colors = [{id:'blue', name:'Azul', hex_code:'#0000ff', is_active:true}]) => {
      http.expectOne(req => req.url.endsWith('/attributes/categories')).flush([{id:'clothes',name:'Ropa',is_active:true}]);
      http.expectOne(req => req.url.endsWith('/attributes/sizes')).flush([{id:'m', name:'Mediana',code:'M',is_active:true}]);
      http.expectOne(req => req.url.endsWith('/attributes/colors')).flush(colors);
      fixture.detectChanges();
    };
    return {fixture,http,counters,flushLists,component:fixture.componentInstance};
  }

  it('loads all three totals on entry without opening the other tabs', () => {
    const {fixture,http,counters,flushLists,component} = setup();
    expect(counters()).toEqual(['…','…','…']);
    flushLists();
    expect(component.activeTab()).toBe('categories');
    expect(counters()).toEqual(['1','1','1']);
    component.switchTab('sizes');
    component.switchTab('colors');
    http.expectNone(req => req.url.includes('/attributes/'));
    fixture.destroy();
    http.verify();
  });

  it('refreshes every total after a successful creation', () => {
    const {fixture,http,counters,flushLists,component} = setup();
    flushLists();
    component.switchTab('colors');
    component.openCreateModal();
    component.colorForm.patchValue({name:'Rojo',hex_code:'#ff0000'});
    component.save();
    const red = {id:'red',name:'Rojo',hex_code:'#ff0000',is_active:true};
    http.expectOne(req => req.method === 'POST' && req.url.endsWith('/attributes/colors')).flush(red);
    flushLists([{id:'blue',name:'Azul',hex_code:'#0000ff',is_active:true},red]);
    expect(counters()).toEqual(['1','1','2']);
    fixture.destroy();
    http.verify();
  });

  it('does not display zero when a list fails to load', () => {
    const {fixture,http,counters,component} = setup();
    http.expectOne(req => req.url.endsWith('/attributes/categories')).flush([{id:'c',name:'Ropa',is_active:true}]);
    http.expectOne(req => req.url.endsWith('/attributes/sizes')).flush([], {status:503,statusText:'Unavailable'});
    http.expectOne(req => req.url.endsWith('/attributes/colors')).flush([]);
    fixture.detectChanges();
    expect(counters()).toEqual(['1','—','0']);
    component.switchTab('sizes');
    expect(component.errorMessage()).toBe('Error al cargar tallas');
    fixture.destroy();
    http.verify();
  });
});
