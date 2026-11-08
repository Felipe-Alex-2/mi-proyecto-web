import { Component, DestroyRef, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SaasService, StoreCompany } from '../servicios/saas.service';

@Component({
  selector: 'app-company-workspace-picker', standalone: true, imports: [FormsModule],
  template: `
    @if(loading()) { <p role="status">Cargando empresas…</p> }
    @if(error()) { <p role="alert">{{error()}}</p><button type="button" (click)="load()">Reintentar</button> }
    <form (ngSubmit)="save()">
      <label>Empresa
        <select name="workspaceCompany" [ngModel]="companyId()" (ngModelChange)="chooseCompany($event)" [disabled]="disabled() || loading()" required>
          <option value="">Selecciona una empresa</option>
          @for(company of companies(); track company.id) { <option [value]="company.id">{{company.name}}</option> }
        </select>
      </label>
      <label>Sucursal (opcional)
        <select name="workspaceBranch" [ngModel]="branchId()" (ngModelChange)="branchId.set($event)" [disabled]="disabled() || loading() || !company()?.branches?.length">
          <option value="">Sin sucursal · administrar empresa</option>
          @for(branch of company()?.branches || []; track branch.id) { <option [value]="branch.id">{{branch.name}} · {{branch.city}}</option> }
        </select>
      </label>
      @if(company() && !company()?.branches?.length) {
        <p>Esta empresa todavía no tiene sucursales. Puedes guardar la selección y crear su primera sucursal desde Sucursales.</p>
      }
      <p class="hint">Los cambios se aplican al guardar. El catálogo, el inventario y las nuevas operaciones pertenecen a la empresa elegida.</p>
      <button type="submit" [disabled]="disabled() || loading() || !!error() || !company() || !changed()">{{disabled() ? 'Guardando…' : 'Guardar selección'}}</button>
    </form>
  `,
  styles: [`form{display:grid;gap:16px;margin-top:20px}label{display:flex;flex-direction:column;gap:8px;font-size:14px;font-weight:600}select{font:inherit;font-weight:400;width:100%;min-width:0;min-height:46px;padding:12px;border:1px solid #d9c7b8;border-radius:10px;background:#fcfaf7;color:#302720}button{justify-self:start;min-height:44px;padding:12px 20px;border:0;border-radius:10px;background:#a54d34;color:#fff;font:inherit;font-weight:600;cursor:pointer}button:disabled,select:disabled{opacity:.6;cursor:not-allowed}button:focus-visible,select:focus-visible{outline:2px solid #934832;outline-offset:3px}p{font-size:14px;line-height:1.6;margin:0;color:#65554b}.hint{font-size:13px}[role=alert]{color:#a12e24}`],
})
export class SelectorEmpresaTrabajoComponent implements OnInit {
  private api = inject(SaasService);
  private destroy = inject(DestroyRef);
  selectedCompany = input<string|null|undefined>();
  selectedBranch = input<string|null|undefined>();
  disabled = input(false);
  selection = output<{tenant_id:string;branch_id:string|null}>();
  companies = signal<StoreCompany[]>([]);
  loading = signal(false); error = signal('');
  companyId = signal(''); branchId = signal('');
  company = computed(() => this.companies().find(row => row.id === this.companyId()));
  changed = computed(() => this.companyId() !== (this.selectedCompany() || '') || this.branchId() !== (this.selectedBranch() || ''));
  constructor() {
    effect(() => {
      this.companyId.set(this.selectedCompany() || '');
      this.branchId.set(this.selectedBranch() || '');
    });
  }
  ngOnInit() { this.load(); }
  chooseCompany(id:string) { this.companyId.set(id); this.branchId.set(''); }
  save() {
    if(this.disabled() || this.loading() || this.error() || !this.company() || !this.changed()) return;
    this.selection.emit({tenant_id:this.companyId(),branch_id:this.branchId() || null});
  }
  load() {
    this.loading.set(true);this.error.set('');
    this.api.directory().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: rows => {this.companies.set(rows);this.loading.set(false);},
      error: () => {this.loading.set(false);this.error.set('No se pudieron cargar las empresas. Revisa tu conexión.');},
    });
  }
}
