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
      { provide: SaasService, useValue: { directory: () => of([{ id:'a', name:'Empresa A', branches:[{id:'branch-a', name:'Central', city:'La Paz'}] }, {id:'empty',name:'MODAT',branches:[]}]) } },
      { provide: CatalogoSinConexion, useValue: { lastDownload:signal(null), productCount:signal(0), error:signal(''), busy:signal(false), store:{online:signal(true)}, download:vi.fn() } },
    ] });
  });

  it('waits for explicit Save and shows the confirmed workspace', async () => {
    const fixture = TestBed.createComponent(PerfilComponent); fixture.detectChanges();
    await fixture.whenStable();fixture.detectChanges();
    expect(auth.selectStore).not.toHaveBeenCalled();
    const selects = fixture.nativeElement.querySelectorAll('app-company-workspace-picker select');
    selects[0].value='a';selects[0].dispatchEvent(new Event('change'));
    await fixture.whenStable();fixture.detectChanges();
    selects[1].value='branch-a';selects[1].dispatchEvent(new Event('change'));
    await fixture.whenStable();fixture.detectChanges();
    expect(auth.selectStore).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('app-company-workspace-picker button[type=submit]').click();
    await fixture.whenStable();fixture.detectChanges();
    expect(auth.selectStore).toHaveBeenCalledWith({tenant_id:'a', branch_id:'branch-a'});
    expect(selects[0].disabled).toBe(true);
    const updated = {...base, tenant_id:'a', selected_tenant_id:'a', branch_id:'branch-a', company_name:'Empresa A', branch_name:'Central'};
    currentUser.set(updated); response.next(updated); response.complete(); fixture.detectChanges();
    await fixture.whenStable();fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Empresa A');
    expect(fixture.nativeElement.textContent).toContain('Central');
    expect(fixture.componentInstance.storeBusy()).toBe(false);
    expect(fixture.componentInstance.storeSuccess()).toContain('Ya puedes trabajar');
    fixture.destroy();
  });

  it('selects a company without branches and sends null only when Save is pressed', async () => {
    const fixture=TestBed.createComponent(PerfilComponent);fixture.detectChanges();
    await fixture.whenStable();fixture.detectChanges();
    const company:HTMLSelectElement=fixture.nativeElement.querySelector('app-company-workspace-picker select');
    company.value='empty';company.dispatchEvent(new Event('change'));
    await fixture.whenStable();fixture.detectChanges();
    expect(auth.selectStore).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('crear su primera sucursal');
    fixture.nativeElement.querySelector('app-company-workspace-picker button[type=submit]').click();
    expect(auth.selectStore).toHaveBeenCalledWith({tenant_id:'empty',branch_id:null});
    response.error({error:{detail:'No se pudo guardar'}});fixture.detectChanges();
    expect(currentUser().tenant_id).toBeUndefined();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('No se pudo guardar');
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
    expect(profile.nativeElement.querySelector('app-company-workspace-picker')).toBeNull();
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
