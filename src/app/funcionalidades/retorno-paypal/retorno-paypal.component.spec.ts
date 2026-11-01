import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { RetornoPaypalComponent } from './retorno-paypal.component';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { ReservaService } from '../../nucleo/servicios/reserva.service';
import { PagoService } from '../../nucleo/servicios/pago.service';
import { User } from '../../nucleo/modelos/usuario.model';

describe('Retorno del pago de una reserva de cliente', () => {
  let identity: Subject<User | null>;
  let user: ReturnType<typeof signal<User | null>>;
  let capture: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers(); identity = new Subject(); user = signal<User | null>(null);
    capture = vi.fn(() => of({reservation:{reservation_code:'RSV-TEST'}})); navigate = vi.fn();
    TestBed.configureTestingModule({imports:[RetornoPaypalComponent],providers:[
      {provide:ActivatedRoute,useValue:{snapshot:{queryParamMap:convertToParamMap({token:'ORDER-TEST'})}}},
      {provide:Router,useValue:{url:'/paypal-return?token=ORDER-TEST',navigate}},
      {provide:AutenticacionService,useValue:{currentUser:user,loadCurrentUser:()=>identity}},
      {provide:ReservaService,useValue:{capturePayPalOrder:capture}},
      {provide:PagoService,useValue:{}},
    ]});
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
  it('espera a restaurar la cuenta y muestra éxito solo después de confirmar la captura', () => {
    const fixture = TestBed.createComponent(RetornoPaypalComponent); fixture.detectChanges();
    expect(capture).not.toHaveBeenCalled(); expect(fixture.componentInstance.success()).toBe(false);
    const customer = {id:'customer',role:'CUSTOMER'} as User; user.set(customer); identity.next(customer);
    expect(capture).toHaveBeenCalledWith('ORDER-TEST');
    expect(fixture.componentInstance.success()).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(navigate).toHaveBeenCalledWith(['/my-reservations']);
    fixture.destroy();
  });
  it('pide iniciar sesión conservando la orden cuando no hay una cuenta válida', () => {
    const fixture = TestBed.createComponent(RetornoPaypalComponent); fixture.detectChanges(); identity.next(null);
    expect(capture).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login'],{queryParams:{returnUrl:'/paypal-return?token=ORDER-TEST'}});
    expect(fixture.componentInstance.success()).toBe(false); fixture.destroy();
  });
  it('no informa que el pago fue exitoso si el servidor rechaza la captura', () => {
    capture.mockReturnValue(throwError(()=>({error:{detail:'Pago pendiente de aprobación'}})));
    const fixture = TestBed.createComponent(RetornoPaypalComponent); fixture.detectChanges(); identity.next({id:'customer',role:'CUSTOMER'} as User);
    expect(fixture.componentInstance.success()).toBe(false);
    expect(fixture.componentInstance.errorMsg()).toBe('Pago pendiente de aprobación'); fixture.destroy();
  });
});
