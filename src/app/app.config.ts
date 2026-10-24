import { ApplicationConfig, provideAppInitializer, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { CatalogoSinConexion } from './nucleo/sin_conexion/catalogo-sin-conexion.service';
import { SincronizacionSinConexion } from './nucleo/sin_conexion/sincronizacion-sin-conexion.service';
import { offlineInterceptor } from './nucleo/sin_conexion/sin_conexion.interceptor';
import { authInterceptor } from './nucleo/interceptors/autenticacion.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(()=>{inject(SincronizacionSinConexion).start();inject(CatalogoSinConexion).start();}),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, offlineInterceptor])),
  ],
};
