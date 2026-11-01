import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { RegistroComponent } from './registro.component';
import { AutenticacionService } from '../../../nucleo/servicios/autenticacion.service';
import { SaasService, StoreCompany } from '../../../nucleo/servicios/saas.service';

describe('Registro de cuenta', () => {
  let directory: Subject<StoreCompany[]>;
  let auth: { isLoading: ReturnType<typeof signal<boolean>>; register: ReturnType<typeof vi.fn> };
  const companies: StoreCompany[] = [
    { id: 'empty', name: 'Sin sucursales', slug: 'empty', branches: [] },
    { id: 'first', name: 'Primera tienda', slug: 'first', branches: [{ id: 'a', name: 'Central', city: 'La Paz' }] },
    { id: 'second', name: 'Segunda tienda', slug: 'second', branches: [{ id: 'b', name: 'Norte', city: 'La Paz' }] },
  ];

  beforeEach(() => {
    directory = new Subject<StoreCompany[]>();
    auth = { isLoading: signal(false), register: vi.fn(() => new Subject()) };
    TestBed.configureTestingModule({
      imports: [RegistroComponent],
      providers: [provideRouter([]),
        { provide: AutenticacionService, useValue: auth },
        { provide: SaasService, useValue: { directory: () => directory } },
      ],
    });
  });

  it('muestra las cinco reglas y actualiza las palomitas al escribir o borrar', () => {
    const fixture = TestBed.createComponent(RegistroComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('.password-requirements li').length).toBe(5);
    expect(element.querySelectorAll('.password-requirements .met').length).toBe(0);
    const password = element.querySelector<HTMLInputElement>('#password')!;
    for (const [value, count] of [['Ab', 2], ['Abcdef1!', 5], ['', 0]] as const) {
      password.value = value;
      password.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(element.querySelectorAll('.password-requirements .met svg').length).toBe(count);
      expect(fixture.componentInstance.registerForm.get('password')!.valid).toBe(count === 5);
    }
    fixture.destroy();
  });

  it('selecciona una empresa disponible y envía la empresa cambiada al registrarse', () => {
    const fixture = TestBed.createComponent(RegistroComponent);
    fixture.detectChanges();
    directory.next(companies);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const element: HTMLElement = fixture.nativeElement;
    expect(component.storeSelection).toEqual({ tenant_id: 'first', branch_id: 'a' });
    expect(element.querySelector('.company-selection strong')!.textContent).toBe('Primera tienda');
    const options = element.querySelector<HTMLElement>('[id^="store-options-"]')!;
    expect(options.hidden).toBe(true);
    element.querySelector<HTMLButtonElement>('.change-company')!.click();
    fixture.detectChanges();
    expect(options.hidden).toBe(false);
    element.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click();
    fixture.detectChanges();
    expect(options.hidden).toBe(true);
    expect(element.querySelector('.company-selection strong')!.textContent).toBe('Segunda tienda');
    component.registerForm.setValue({ full_name: 'Ana Pérez', email: 'ana@example.com', password: 'Abcdef1!', confirmPassword: 'Abcdef1!' });
    component.onSubmit();
    expect(auth.register).toHaveBeenCalledWith({ tenant_id: 'second', branch_id: 'b', full_name: 'Ana Pérez', email: 'ana@example.com', password: 'Abcdef1!' });
    fixture.destroy();
  });

  it('no inventa una selección cuando no existen sucursales disponibles', () => {
    const fixture = TestBed.createComponent(RegistroComponent);
    fixture.detectChanges();
    directory.next([companies[0]]);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.storeSelection).toBeNull();
    component.registerForm.setValue({ full_name: 'Ana Pérez', email: 'ana@example.com', password: 'Abcdef1!', confirmPassword: 'Abcdef1!' });
    component.onSubmit();
    expect(auth.register).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain('Escoge una empresa');
    fixture.destroy();
  });
});
