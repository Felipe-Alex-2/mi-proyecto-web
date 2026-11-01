import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { InicioSesionComponent } from './inicio_sesion.component';
import { AutenticacionService } from '../../../nucleo/servicios/autenticacion.service';
import { User } from '../../../nucleo/modelos/usuario.model';

describe('Inicio de sesión web con carrusel VESTA', () => {
  let auth: {isLoading: ReturnType<typeof signal<boolean>>; currentUser: ReturnType<typeof signal<User|null>>; login: ReturnType<typeof vi.fn>};
  beforeEach(() => {
    vi.useFakeTimers(); sessionStorage.clear();
    auth = {isLoading:signal(false), currentUser:signal<User|null>(null), login:vi.fn()};
    TestBed.configureTestingModule({imports:[InicioSesionComponent],providers:[provideRouter([]),{provide:AutenticacionService,useValue:auth}]});
  });
  afterEach(() => {vi.clearAllTimers();vi.useRealTimers();sessionStorage.clear();});

  it('muestra tres imágenes y campos vacíos sin credenciales ni datos del modelo', () => {
    const fixture = TestBed.createComponent(InicioSesionComponent);fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('.showcase-slide').length).toBe(3);
    expect(element.querySelectorAll('.carousel-dots button').length).toBe(3);
    expect(element.querySelector<HTMLInputElement>('#email')!.value).toBe('');
    expect(element.querySelector<HTMLInputElement>('#password')!.value).toBe('');
    expect(element.textContent).not.toContain('adminsas@gmail.com');
    expect(element.textContent).not.toContain('480');
    fixture.destroy();
  });

  it('avanza exactamente cada diez segundos y vuelve a la primera imagen', () => {
    const fixture = TestBed.createComponent(InicioSesionComponent);fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.activeSlide()).toBe(0);
    vi.advanceTimersByTime(9999);expect(component.activeSlide()).toBe(0);
    vi.advanceTimersByTime(1);expect(component.activeSlide()).toBe(1);
    vi.advanceTimersByTime(10000);expect(component.activeSlide()).toBe(2);
    vi.advanceTimersByTime(10000);expect(component.activeSlide()).toBe(0);
    fixture.destroy();
  });

  it('permite elegir un punto, pausar y reanudar sin duplicar temporizadores', () => {
    const fixture = TestBed.createComponent(InicioSesionComponent);fixture.detectChanges();
    const component = fixture.componentInstance;
    const dots = fixture.nativeElement.querySelectorAll('.carousel-dots button') as NodeListOf<HTMLButtonElement>;
    vi.advanceTimersByTime(5000);dots[2].click();fixture.detectChanges();
    expect(component.activeSlide()).toBe(2);
    expect(dots[2].getAttribute('aria-pressed')).toBe('true');
    vi.advanceTimersByTime(9999);expect(component.activeSlide()).toBe(2);
    vi.advanceTimersByTime(1);expect(component.activeSlide()).toBe(0);
    component.toggleCarousel();vi.advanceTimersByTime(30000);expect(component.activeSlide()).toBe(0);
    component.toggleCarousel();vi.advanceTimersByTime(10000);expect(component.activeSlide()).toBe(1);
    fixture.destroy();vi.advanceTimersByTime(30000);expect(component.activeSlide()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([['CUSTOMER','/home'],['ADMIN','/dashboard']] as const)('mantiene el destino de la cuenta %s al iniciar sesión', (role,destination) => {
    const fixture = TestBed.createComponent(InicioSesionComponent);fixture.detectChanges();
    const navigate = vi.spyOn(TestBed.inject(Router),'navigateByUrl').mockResolvedValue(true);
    auth.login.mockImplementation(() => {const user = {id:'test-user',role} as User;auth.currentUser.set(user);return of({user});});
    fixture.componentInstance.onSubmit();expect(auth.login).not.toHaveBeenCalled();
    fixture.componentInstance.loginForm.setValue({email:'usuario@example.com',password:'Example123!'});
    fixture.componentInstance.onSubmit();
    expect(auth.login).toHaveBeenCalledWith({email:'usuario@example.com',password:'Example123!'});
    expect(navigate).toHaveBeenCalledWith(destination);fixture.destroy();
  });
});
