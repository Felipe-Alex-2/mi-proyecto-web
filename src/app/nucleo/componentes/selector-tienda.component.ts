import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SaasService, StoreCompany } from '../servicios/saas.service';

@Component({
  selector:'app-store-picker', standalone:true,
  template:`
    <section class="store-picker">
      <h2>Tu empresa y sucursal</h2><p>El catálogo y la disponibilidad dependen de la tienda elegida.</p>
      @if (loading()) { <p role="status">Cargando empresas…</p> }
      @if (error()) { <p class="error" role="alert">{{error()}}</p><button type="button" (click)="load()">Reintentar</button> }
      @for (company of companies(); track company.id) {
        <details [open]="company.id === selectedCompany()">
          <summary>{{company.name}} <span>{{company.branches.length}} sucursal(es)</span></summary>
          @for (branch of company.branches; track branch.id) {
            <label><input type="radio" [name]="'store-'+pickerId" [checked]="selectedCompany()===company.id && selectedBranch()===branch.id"
              [disabled]="disabled()" (change)="selection.emit({tenant_id:company.id,branch_id:branch.id})" />
              <span>{{branch.name}}<small>{{branch.city}}</small></span></label>
          } @empty { <p>Esta empresa todavía no tiene sucursales disponibles.</p> }
        </details>
      }
    </section>`,
  styles:[`.store-picker{background:#fff;border:1px solid #eaded4;border-radius:20px;padding:24px;margin:20px 0;color:#302720}h2{font-size:18px;margin:0 0 8px}p{font-size:14px;color:#82746c;line-height:1.5}details{border:1px solid #eaded4;border-radius:12px;margin-top:12px;overflow:hidden}summary{cursor:pointer;padding:16px;background:#faf7f2;font-weight:600}summary span{float:right;font-size:12px;font-weight:400;color:#82746c}label{display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer;border-top:1px solid #f0e9e0}input{accent-color:#a84e3c;width:18px;height:18px;flex-shrink:0}small{display:block;color:#82746c;margin-top:4px}.error{color:#b42318}button{border:1px solid #eaded4;padding:8px 16px;border-radius:8px;background:#faf7f2}`],
})
export class SelectorTiendaComponent {
  private api = inject(SaasService);
  private destroyRef = inject(DestroyRef);
  private static nextId = 0;
  readonly pickerId = SelectorTiendaComponent.nextId++;
  selectedCompany = input<string|null|undefined>();
  selectedBranch = input<string|null|undefined>();
  disabled = input(false);
  selection = output<{tenant_id:string;branch_id:string}>();
  companies = signal<StoreCompany[]>([]); loading = signal(false); error = signal('');
  constructor() { this.load(); }
  load() { this.loading.set(true); this.error.set(''); this.api.directory().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
    next: rows=>{this.companies.set(rows);this.loading.set(false);},
    error:()=>{this.loading.set(false);this.error.set('No se pudieron cargar las empresas. Revisa tu conexión.');},
  }); }
}
