import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Branch } from '../modelos/sucursal.model';

@Component({
  selector: 'app-branch-selector',
  standalone: true,
  template: `
    <div class="branch-scope">
      <span class="branch-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 10 8h-3v10h-5v-6h-4v6H5V11H2z" /></svg></span>
      <label><span>{{ label }}</span>
        <select [value]="value" (change)="valueChange.emit($any($event.target).value)" [disabled]="!branches.length || !allowAll && branches.length === 1">
          @if (allowAll) { <option value="">Todas las sucursales</option> }
          @if (!branches.length && !allowAll) { <option value="">Sin sucursal disponible</option> }
          @for (branch of branches; track branch.id) { <option [value]="branch.id">{{ branch.name }} ({{ branch.city }})</option> }
        </select>
      </label>
    </div>`,
  styles: [`
    :host{display:block;min-width:0;margin-bottom:20px}
    .branch-scope{display:flex;align-items:center;gap:14px;padding:18px 20px;border:1px solid var(--vesta-border,#e4d9cb);border-radius:16px;background:#fffdf9}
    .branch-icon{display:grid;place-items:center;flex:0 0 40px;height:40px;border:1px solid #e4d9cb;border-radius:10px;background:#faf7f2;color:#397356}
    svg{width:20px;height:20px}
    label{display:grid;gap:6px;min-width:0;width:min(100%,480px)}
    label>span{font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#806b57}
    select{width:100%;min-height:38px;padding:7px 12px;border:1px solid #e1d3c6;border-radius:8px;background:#faf7f2;color:#2c211d;font:inherit;font-size:.82rem;text-overflow:ellipsis}
    select:focus-visible{outline:2px solid #a34f3d;outline-offset:2px}
    select:disabled{opacity:1;color:#594333;cursor:default}
    @media(max-width:480px){.branch-scope{padding:14px;gap:10px}}
  `],
})
export class SelectorSucursalComponent {
  @Input() branches: Branch[] = [];
  @Input() value = '';
  @Input() allowAll = true;
  @Input() label = 'Sucursal / ámbito de consulta';
  @Output() valueChange = new EventEmitter<string>();
}
