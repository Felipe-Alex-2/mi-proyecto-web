import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, tap, throwError, filter, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { queryLocalCatalog } from './consulta-catalogo';
import { AlmacenSinConexion } from './almacen-sin-conexion.service';
import { RepositorioSinConexion, managedWrite, resourcePath } from './repositorio-sin-conexion.service';

export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  const base = environment.apiUrl.replace(/\/$/, '');
  if (!req.url.startsWith(base + '/')) return next(req);
  const store = inject(AlmacenSinConexion), repository = inject(RepositorioSinConexion),
    path = req.url.slice(base.length).split('?')[0],
    scope = store.scope,
    owner = store.owner;
  const cacheable =
    req.method === 'GET' &&
    req.responseType === 'json' &&
    !!owner &&
    /^\/(catalog|products|branches|stocks|reservations|payments|suppliers|seasons|promotions|attributes|inventory|users|saas\/subscription|saas\/plans|saas\/history)(\/|$)/.test(
      path,
    );
  // Every allowed commercial write first obtains a durable UUID. A lost online
  // response can then be retried safely instead of being submitted twice.
  const hasCoupon = !!(req.body as any)?.coupon_code?.trim();
  const reserve = req.method === 'POST' && path === '/reservations' && !hasCoupon;
  const sale =
    req.method === 'POST' && path === '/payments' && !hasCoupon && (req.body as any)?.payment_type === 'EFECTIVO';
  const localCash = req.method === 'POST' && /^\/payments\/local-[a-z0-9-]+\/cash$/.test(path);
  if (localCash)
    return from(store.refresh()).pipe(
      switchMap(() => {
        const row = store.operations().find((row) => 'local-' + row.id === path.split('/')[2]);
        return row
          ? from(
              Promise.resolve(new HttpResponse({ body: row.result || row.preview, status: 200 })),
            )
          : throwError(
              () =>
                new HttpErrorResponse({
                  status: 409,
                  error: { detail: 'No se encontró la venta local.' },
                }),
            );
      }),
    );
  const managed = managedWrite(path, req.method);
  if (reserve || sale || managed) {
    return from(managed ? repository.queue(path, req.method, req.body || {}) : store.enqueue(reserve ? '/reservations' : '/payments/offline-sale', req.body)).pipe(
      switchMap((preview) =>
        from(store.ownedOperations()).pipe(
          switchMap((rows) => {
            const operation = rows.find((row) => row.preview.id === preview.id && row.created_at === preview.created_at && row.state === 'PENDING' && row.path === (managed ? path : reserve ? '/reservations' : '/payments/offline-sale') && row.method === req.method && row.scope === scope);
            if (!operation) return throwError(() => new Error('No se pudo recuperar el cambio guardado. Revisa los pendientes antes de repetirlo.'));
            if (store.owner !== owner || store.scope !== scope)
              return throwError(
                () =>
                  new HttpErrorResponse({
                    status: 401,
                    error: {
                      detail: 'La sesión cambió. La operación se conserva para su cuenta original.',
                    },
                  }),
              );
            const dependencies = JSON.stringify({ body: operation.body, path: operation.path }).match(/local-[0-9a-f-]{36}(?:-variant-\d+)?/g) || [];
            const hasPendingDependency = dependencies.some(ref => !rows.some(row => 'local-' + row.id === ref.slice(0, 42) && row.state === 'SYNCED'));
            if (!navigator.onLine || hasPendingDependency)
              return from(Promise.resolve(new HttpResponse({ body: preview, status: 202 })));
            const id = operation.id;
            const command$ = from(store.commandBody(operation)).pipe(switchMap(body => next(req.clone({
              url: base + '/sync/operations',
              body: {
                operation_id: id,
                account_id: operation.owner,
                tenant_id: operation.tenant_id,
                branch_id: operation.branch_id,
                method: operation.method,
                path: operation.path,
                body,
              },
            }))));
            return command$.pipe(
              filter((event): event is HttpResponse<any> => event instanceof HttpResponse),
              timeout(15000),
              switchMap((event) =>
                from(
                  (async () => {
                    const row = (await store.read<any[]>('operations')).find(
                      (row) => row.id === id,
                    );
                    store.message.set('Operación confirmada por el servidor.');
                    try {
                      await store.update({
                        ...row,
                        state: 'SYNCED',
                        conflict: undefined,
                        result: event.body,
                        message: 'Confirmada por el servidor.',
                      });
                    } catch {
                      store.message.set(
                        'Confirmada por el servidor. La copia local se verificará con el mismo identificador.',
                      );
                    }
                    store.setOnline(true);
                    return new HttpResponse({ body: event.body, status: 200 });
                  })(),
                ),
              ),
              catchError((error) =>
                from(
                  (async () => {
                    const row = (await store.read<any[]>('operations')).find(
                      (row) => row.id === id,
                    );
                    if (error.status > 0) store.setOnline(true);
                    if (
                      error.status === 0 ||
                      error.status >= 500 ||
                      error.status === 429 ||
                      error.status === 401 || error.status === 424 ||
                      error.name === 'TimeoutError'
                    ) {
                      if (error.status === 0 || error.name === 'TimeoutError')
                        store.setOnline(false);
                      store.message.set(
                        'Guardado localmente. Pendiente de confirmación al recuperar conexión.',
                      );
                      return new HttpResponse({ body: preview, status: 202 });
                    }
                    await store.update({
                      ...row,
                      state: 'CONFLICT',
                      conflict: typeof error.error?.detail === 'object' ? error.error.detail : undefined,
                      message:
                        typeof error.error?.detail === 'string'
                          ? error.error.detail
                          : typeof error.error?.detail?.message === 'string'
                            ? error.error.detail.message
                          : 'El servidor rechazó la operación.',
                    });
                    if (typeof error.error?.detail?.message === 'string') {
                      throw new HttpErrorResponse({
                        status: error.status, statusText: error.statusText,
                        headers: error.headers, url: error.url || undefined,
                        error: { ...error.error, detail: error.error.detail.message },
                      });
                    }
                    throw error;
                  })(),
                ),
              ),
            );
          }),
        ),
      ),
      catchError((error) =>
        throwError(() =>
          error instanceof HttpErrorResponse
            ? error
            : new HttpErrorResponse({
                status: 507,
                error: {
                  detail:
                    error.message ||
                    'No se pudo completar la operación. Revisa los pendientes antes de volver a intentarlo.',
                },
              }),
        ),
      ),
    );
  }
  if (!navigator.onLine && req.method !== 'GET' && !path.startsWith('/sync/'))
    return throwError(
      () =>
        new HttpErrorResponse({
          status: 0,
          error: {
            detail:
              'Esta acción necesita conexión. Los cambios compatibles se guardan automáticamente como pendientes.',
          },
        }),
    );
  const response$ = !navigator.onLine && cacheable
    ? throwError(() => new HttpErrorResponse({ status: 0 })) : next(req);
  return response$.pipe(
    timeout(15000),
    tap((event) => {
      if (event instanceof HttpResponse) {
        store.setOnline(true);
        if (cacheable && store.owner === owner)
          void store
            .cache(req.urlWithParams, event.body, scope)
            .catch(() =>
              store.message.set(
                'No se pudo actualizar la copia offline. Revisa el espacio del navegador.',
              ),
            );
      }
    }),
    switchMap(event => {
      const root = resourcePath(path);
      if (event instanceof HttpResponse && root && !store.snapshotActive && store.operations().some(op => op.scope === scope && resourcePath(op.path) === root && op.state !== 'SYNCED'))
        return from(repository.read(req.urlWithParams)).pipe(switchMap(local => from(Promise.resolve(local ? event.clone({ body: local.data }) : event))));
      return from(Promise.resolve(event));
    }),
    catchError((error) => {
      if (error.status !== 0 && error.name !== 'TimeoutError') {
        store.setOnline(true);
        return throwError(() => error);
      }
      store.setOnline(false);
      if (!cacheable || store.owner !== owner) return throwError(() => error);
      return from(
        (async () => {
          if (resourcePath(path) || path.startsWith('/stocks/') || path.startsWith('/inventory/') || path.startsWith('/catalog/products') || path === '/payments' || path === '/reservations') {
            const local = await repository.read(req.urlWithParams);
            if (local) return local;
          }
          const exact = await store.cached(req.urlWithParams, scope);
          if (path === '/catalog/products') {
            const snapshot = await store.cached(base + '/offline/products', scope);
            if (snapshot)
              return { ...snapshot, data: queryLocalCatalog(snapshot.data, req.urlWithParams) };
          }
          return exact;
        })(),
      ).pipe(
        switchMap((row) => {
          if (!row)
            return throwError(
              () =>
                new HttpErrorResponse({
                  status: 0,
                  error: {
                    detail:
                      'Estos datos todavía no están guardados. Descarga tu catálogo antes de desconectarte.',
                  },
                }),
            );
          if (!store.message().startsWith('Guardado')) store.message.set(
            'Mostrando datos guardados el ' +
              new Date(row.saved_at).toLocaleString() +
              '. Las existencias pueden haber cambiado.',
          );
          return from(
            Promise.resolve(
              new HttpResponse({
                body: row.data,
                status: 200,
                headers: undefined,
              }),
            ),
          );
        }),
      );
    }),
  );
};
