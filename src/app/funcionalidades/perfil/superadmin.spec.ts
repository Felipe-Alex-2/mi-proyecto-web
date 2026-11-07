import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { PerfilComponent } from './perfil.component';
import { PrincipalLayoutComponent } from '../../nucleo/layout/principal-layout/principal-layout.component';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { SaasService } from '../../nucleo/servicios/saas.service';
import { CatalogoSinConexion } from '../../nucleo/sin_conexion/catalogo-sin-conexion.service';
import { platformGuard } from '../../nucleo/guards/autenticacion.guard';
import { User } from '../../nucleo/modelos/usuario.model';

describe('Superadmin company workspace', () => {
  const base = { id: 'platform', full_name: 'superadmin Felipe', email: 'platform@example.com', role: 'ADMIN', is_saas_admin: true } as User;
  let currentUser: ReturnType<typeof signal<User>>;
  let response: Subject<User>;
  let auth: any;
  beforeEach(() => {
    currentUser = signal({...base});
    response = new Subject<User>();
    auth = { currentUser, selectStore: vi.fn(() => response), updateProfile: vi.fn(), logout: vi.fn() };
    TestBed.configureTestingModule({ imports: [PerfilComponent, PrincipalLayoutComponent], providers: [
      provideRouter([]),
      { provide: AutenticacionService, useValue: auth },
      { provide: SaasService, useValue: { directory: () => of([{ id:'a', name:'Empresa A', branches:[{id:'branch-a', name:'Central', city:'La Paz'}] }]) } },
      { provide: CatalogoSinConexion, useValue: { lastDownload:signal(null), productCount:signal(0), error:signal(''), busy:signal(false), store:{online:signal(true)}, download:vi.fn() } },
    ] });
  });

  it('waits for explicit selection and shows the confirmed workspace', () => {
    const fixture = TestBed.createComponent(PerfilComponent); fixture.detectChanges();
    expect(auth.selectStore).not.toHaveBeenCalled();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('app-store-picker input');
    input.checked = true; input.dispatchEvent(new Event('change')); fixture.detectChanges();
    expect(auth.selectStore).toHaveBeenCalledWith({tenant_id:'a', branch_id:'branch-a'});
    expect(input.disabled).toBe(true);
    const updated = {...base, tenant_id:'a', selected_tenant_id:'a', branch_id:'branch-a', company_name:'Empresa A', branch_name:'Central'};
    currentUser.set(updated); response.next(updated); response.complete(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Empresa A');
    expect(fixture.nativeElement.textContent).toContain('Central');
    expect(fixture.componentInstance.storeBusy()).toBe(false);
    expect(fixture.componentInstance.success()).toContain('Ya puedes trabajar');
    fixture.destroy();
  });

  it('keeps the workspace when the server rejects the switch', () => {
    const fixture = TestBed.createComponent(PerfilComponent); fixture.detectChanges();
    fixture.componentInstance.changeStore({tenant_id:'a', branch_id:'branch-a'});
    response.error({error:{detail:'La sucursal no esta disponible'}}); fixture.detectChanges();
    expect(currentUser().tenant_id).toBeUndefined();
    expect(fixture.nativeElement.textContent).toContain('La sucursal no esta disponible');
    expect(fixture.componentInstance.storeBusy()).toBe(false);
    fixture.destroy();
  });

  it('shows platform links and switching only for the superadmin among staff', () => {
    TestBed.overrideComponent(PrincipalLayoutComponent, {set:{template:''}});
    const layout = TestBed.createComponent(PrincipalLayoutComponent);
    const links = () => layout.componentInstance.groups().flatMap(group => group.links).map(link => link.path);
    expect(links()).toContain('/companies'); expect(links()).toContain('/subscription');
    currentUser.set({...base, is_saas_admin:false});
    expect(links()).not.toContain('/companies'); expect(links()).not.toContain('/subscription');
    const profile = TestBed.createComponent(PerfilComponent); profile.detectChanges();
    expect(profile.nativeElement.querySelector('app-store-picker')).toBeNull();
    expect(links()).toContain('/users');
    profile.destroy(); layout.destroy();
  });

  it('rejects direct platform routes for an ordinary administrator', () => {
    currentUser.set({...base, is_saas_admin:false});
    const router = TestBed.inject(Router);
    const result = TestBed.runInInjectionContext(() => platformGuard({} as any, {} as any));
    expect(result).toEqual(router.parseUrl('/dashboard'));
    currentUser.set(base);
    expect(TestBed.runInInjectionContext(() => platformGuard({} as any, {} as any))).toBe(true);
  });
});
