import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, RouterOutlet, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes } from '../../app.routes';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { TokenService } from '../../nucleo/servicios/token.service';
import { User } from '../../nucleo/modelos/usuario.model';

@Component({ standalone: true, imports: [RouterOutlet], template: '<p>{{path}}</p><router-outlet />' })
class RoutePage {
  readonly path = inject(ActivatedRoute).snapshot.routeConfig?.path;
}

// Exercise the real URLs and guards without loading unrelated page services.
function routingOnly(config: Routes): Routes {
  return config.map(route => ({
    ...route,
    ...(route.loadComponent ? { loadComponent: () => Promise.resolve(RoutePage) } : {}),
    ...(route.children ? { children: routingOnly(route.children) } : {}),
  }));
}

describe('Entrada pública de la web', () => {
  const user = signal<User | null>(null);
  const signedIn = signal(false);
  beforeEach(() => {
    user.set(null); signedIn.set(false);
    TestBed.configureTestingModule({ providers: [
      provideRouter(routingOnly(routes)),
      { provide: AutenticacionService, useValue: { currentUser:user, loadCurrentUser:() => of(user()) } },
      { provide: TokenService, useValue: { hasToken:() => signedIn() } },
    ] });
  });

  it('abre la tienda sin sesión desde la raíz, enlaces desconocidos o un enlace antiguo al panel', async () => {
    const harness = await RouterTestingHarness.create('/');
    const router = TestBed.inject(Router);
    expect(router.url).toBe('/home');
    for (const url of ['/index.html','/enlace-antiguo','/dashboard']) {
      await harness.navigateByUrl(url);
      expect(router.url).toBe('/home');
    }
    await harness.navigateByUrl('/catalog');
    expect(router.url).toBe('/catalog');
  });

  it('pide acceso al entrar en una función personal y conserva el destino', async () => {
    const harness = await RouterTestingHarness.create('/home');
    await harness.navigateByUrl('/cart');
    expect(TestBed.inject(Router).url).toContain('/login?returnUrl=%2Fcart');
  });

  it('el cliente autenticado sigue en la tienda y habilita sus páginas personales', async () => {
    signedIn.set(true); user.set({id:'customer',role:'CUSTOMER'} as User);
    const harness = await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/home');
    await harness.navigateByUrl('/cart');
    expect(TestBed.inject(Router).url).toBe('/cart');
  });

  it('el administrador SaaS entra al panel una vez autenticado', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/home');
    signedIn.set(true); user.set({id:'saas',role:'ADMIN',is_saas_admin:true} as User);
    await harness.navigateByUrl('/login');
    expect(TestBed.inject(Router).url).toBe('/dashboard');
    await harness.navigateByUrl('/companies');
    expect(TestBed.inject(Router).url).toBe('/companies');
  });
});
