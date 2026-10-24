import { Component, computed, inject, input } from '@angular/core';
import { AlmacenSinConexion } from '../sin_conexion/almacen-sin-conexion.service';

@Component({
  selector: 'app-local-state',
  template: `@if(state() === 'PENDING' || state() === 'CONFLICT') { <small role="status" [class.conflict]="state() === 'CONFLICT'">{{state() === 'CONFLICT' ? 'Conflicto · revisar en mi perfil' : 'Pendiente de sincronizar'}}</small> }`,
  styles: [`small{display:inline-block;margin:5px 0;padding:4px 8px;border-radius:8px;background:#f4e8ca;color:#735821;font-size:.7rem}.conflict{background:#fae3df;color:#9a392c}`],
})
export class EstadoLocalComponent {
  readonly record = input.required<any>();
  private readonly store = inject(AlmacenSinConexion);
  readonly state = computed(() => this.store.operations().filter(row => row.scope === this.store.scope && row.preview.id === this.record()?.id).at(-1)?.state || this.record()?.sync_status);
}
