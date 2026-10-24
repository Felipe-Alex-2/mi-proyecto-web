import 'fake-indexeddb/auto';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TokenService } from '../servicios/token.service';
import { AlmacenSinConexion } from './almacen-sin-conexion.service';
import { SincronizacionSinConexion } from './sincronizacion-sin-conexion.service';
import { CambiosPendientesComponent } from './cambios-pendientes.component';

describe('Review and correct rejected offline operations', () => {
  const sync = { syncing: signal(false), sync: vi.fn(async () => {}) };
  let store: AlmacenSinConexion;
  let component: CambiosPendientesComponent;
  beforeEach(() => {
    sync.sync.mockClear(); sync.syncing.set(false);
    const identity = { id: crypto.randomUUID(), role: 'ADMIN', tenant_id: 'company', branch_id: 'branch' };
    TestBed.configureTestingModule({ providers: [
      { provide: TokenService, useValue: { getIdentity: () => identity } },
      { provide: SincronizacionSinConexion, useValue: sync },
    ] });
    store = TestBed.inject(AlmacenSinConexion);
    component = TestBed.createComponent(CambiosPendientesComponent).componentInstance;
  });
  async function rejected(path = '/reservations') {
    await store.enqueue(path, { branch_id: 'branch', amount: 100, items: [{ variant_id: 'variant', quantity: 2, unit_price: 50, subtotal: 100 }] });
    await store.update({ ...store.operations()[0], state: 'CONFLICT', conflict: { code: 'STOCK_INSUFFICIENT', message: 'Stock insuficiente', variant_id: 'variant', available: 1, requested: 2 } });
    return store.operations()[0];
  }
  it('reduces a rejected cash sale and recalculates totals while preserving its UUID', async () => {
    const row = await rejected('/payments/offline-sale');
    component.edit(row); component.quantities['variant'] = 1;
    await component.correct(row);
    const corrected = store.operations()[0];
    expect(corrected.id).toBe(row.id);
    expect(corrected.state).toBe('PENDING');
    expect(corrected.body.items[0].quantity).toBe(1);
    expect(corrected.body.items[0].subtotal).toBe(50);
    expect(corrected.body.amount).toBe(50);
    expect(corrected.conflict).toBeUndefined();
    expect(sync.sync).toHaveBeenCalledOnce();
  });
  it('rejects empty, fractional or increased quantities and preserves the conflict', async () => {
    const row = await rejected(); component.edit(row);
    for (const quantity of [0, 1.5, 3]) {
      component.quantities['variant'] = quantity; await component.correct(row);
      expect(component.error()).toBeTruthy();
      expect(store.operations()[0].state).toBe('CONFLICT');
    }
    expect(sync.sync).not.toHaveBeenCalled();
  });
  it('does not alter an operation confirmed in another window', async () => {
    const row = await rejected(); component.edit(row); component.quantities['variant'] = 1;
    await store.update({ ...row, state: 'SYNCED', result: { id: 'accepted' } });
    await component.correct(row);
    expect(store.operations()[0].state).toBe('SYNCED');
    expect(store.operations()[0].body.items[0].quantity).toBe(2);
    expect(sync.sync).not.toHaveBeenCalled();
  });
});
