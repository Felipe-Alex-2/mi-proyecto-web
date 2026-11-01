import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SaasService, StoreCompany } from '../servicios/saas.service';

@Component({
  selector:'app-store-picker', standalone:true,
  template:`
    <section class="store-picker" [class.compact]="compact()">
      @if (!compact()) {
        <h2>Tu empresa y sucursal</h2><p>El catálogo y la disponibilidad dependen de la tienda elegida.</p>
      }
      @if (loading()) { <p role="status">Cargando empresas…</p> }
      @if (error()) { <p class="error" role="alert">{{error()}}</p><button type="button" (click)="load()">Reintentar</button> }
      @if (compact() && currentCompany; as company) {
        <div class="company-selection">
          <strong>{{company.name}}</strong><span aria-hidden="true">·</span>
          <button type="button" class="change-company" [disabled]="disabled()" [attr.aria-expanded]="expanded()" [attr.aria-controls]="'store-options-'+pickerId" (click)="expanded.set(!expanded())">{{expanded() ? 'Cerrar selector' : 'Cambiar empresa'}}</button>
        </div>
      }
      @if (!loading() && !error() && !companies().length) {
        <p role="status">No hay empresas disponibles para crear tu cuenta.</p>
      }
      <div [id]="'store-options-'+pickerId" [hidden]="compact() && !!currentCompany && !expanded()">
      @for (company of companies(); track company.id) {
        <details [open]="company.id === selectedCompany()">
          <summary>{{company.name}} <span>{{company.branches.length}} sucursal(es)</span></summary>
          @for (branch of company.branches; track branch.id) {
            <label><input type="radio" [name]="'store-'+pickerId" [checked]="selectedCompany()===company.id && selectedBranch()===branch.id"
              [disabled]="disabled()" (change)="choose(company.id,branch.id)" />
              <span>{{branch.name}}<small>{{branch.city}}</small></span></label>
          } @empty { <p>Esta empresa todavía no tiene sucursales disponibles.</p> }
        </details>
      }
      </div>
    </section>`,
  styles:[`.store-picker.compact{padding:0;border:0;border-radius:0;background:transparent;margin:0 0 24px}.company-selection{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:14px}.company-selection .change-company{padding:0;border:0;border-radius:0;background:transparent;color:#a34f3d;text-decoration:underline;font:inherit;cursor:pointer}.change-company:disabled{opacity:.6;cursor:not-allowed}.change-company:focus-visible{outline:2px solid #a34f3d;outline-offset:4px}.store-picker{background:#fff;border:1px solid #eaded4;border-radius:20px;padding:24px;margin:20px 0;color:#302720}h2{font-size:18px;margin:0 0 8px}p{font-size:14px;color:#82746c;line-height:1.5}details{border:1px solid #eaded4;border-radius:12px;margin-top:12px;overflow:hidden}summary{cursor:pointer;padding:16px;background:#faf7f2;font-weight:600}summary span{float:right;font-size:12px;font-weight:400;color:#82746c}label{display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer;border-top:1px solid #f0e9e0}input{accent-color:#a84e3c;width:18px;height:18px;flex-shrink:0}small{display:block;color:#82746c;margin-top:4px}.error{color:#b42318}button{border:1px solid #eaded4;padding:8px 16px;border-radius:8px;background:#faf7f2}`],
})
export class SelectorTiendaComponent implements OnInit {
  private api = inject(SaasService);
  private destroyRef = inject(DestroyRef);
  private static nextId = 0;
  readonly pickerId = SelectorTiendaComponent.nextId++;
  selectedCompany = input<string|null|undefined>();
  selectedBranch = input<string|null|undefined>();
  disabled = input(false);
  compact = input(false);
  expanded = signal(false);
  selection = output<{tenant_id:string;branch_id:string}>();
  companies = signal<StoreCompany[]>([]); loading = signal(false); error = signal('');
  get currentCompany() { return this.companies().find(company => company.id === this.selectedCompany()); }
  ngOnInit() { this.load(); }
  choose(tenant_id: string, branch_id: string) {
    if (this.disabled()) return;
    this.selection.emit({tenant_id, branch_id});
    this.expanded.set(false);
  }
  load() { this.loading.set(true); this.error.set(''); this.api.directory().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
    next: rows=>{
      this.companies.set(rows);
      this.loading.set(false);
      if (this.compact() && !rows.some(row => row.id === this.selectedCompany() && row.branches.some(branch => branch.id === this.selectedBranch()))) {
        const company = rows.find(row => row.branches.length > 0);
        if (company) this.selection.emit({tenant_id: company.id, branch_id: company.branches[0].id});
      }
    },
    error:()=>{this.loading.set(false);this.error.set('No se pudieron cargar las empresas. Revisa tu conexión.');},
  }); }
}
