import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TiendaService } from './tienda.service';
import { SelectorTiendaComponent } from '../../nucleo/componentes/selector-tienda.component';
import { AsistenteTiendaComponent } from './asistente-tienda.component';
import { DialogoTiendaDirective } from './dialogo-tienda.directive';

@Component({
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    FormsModule,
    SelectorTiendaComponent,
    AsistenteTiendaComponent,
    DialogoTiendaDirective,
  ],
  templateUrl: './tienda-layout.component.html',
  styleUrls: ['./tienda.css', './tienda-layout.component.css'],
})
export class TiendaLayoutComponent {
  readonly shop = inject(TiendaService);
  readonly storeOpen = signal(false);
  readonly menuOpen = signal(false);
  search = '';
  searchProducts() {
    this.shop.router.navigate(['/catalog'], {
      queryParams: { search: this.search.trim() || undefined },
    });
    this.menuOpen.set(false);
  }
  choose(selection: { tenant_id: string; branch_id: string }) {
    this.shop.choose(selection);
    this.storeOpen.set(false);
  }
  account(path: string) {
    if (this.shop.requireCustomer(path)) this.shop.router.navigateByUrl(path);
  }
}
