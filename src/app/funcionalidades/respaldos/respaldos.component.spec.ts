import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RespaldosComponent } from './respaldos.component';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { environment } from '../../../environments/environment';

describe('Backup review and missing-record recovery', () => {
  const base = environment.apiUrl + '/backups';
  const reviewed = { company_id: 'company', company_name: 'Moda', created_at: '2026-10-23T10:00:00Z', missing: 3, existing: 8, skipped: 0,
    review_token: 'reviewed-file', tables: [{ table: 'products', total: 4, missing: 3, existing: 1, skipped: 0 }], issues: [] };
  function setup() {
    TestBed.configureTestingModule({ imports: [RespaldosComponent], providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: AutenticacionService, useValue: { currentUser: signal({ tenant_id: 'company', role: 'ADMIN' }) } }],
    });
    const fixture = TestBed.createComponent(RespaldosComponent), http = TestBed.inject(HttpTestingController);
    http.expectOne(base + '?tenant_id=company').flush({ backups: [] });
    return { fixture, http, component: fixture.componentInstance };
  }
  it('analyzes a dropped file without restoring until the user presses the recovery button', async () => {
    const { fixture, http, component } = setup();
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    component.drop({ preventDefault() {}, dataTransfer: { files: [file] } } as unknown as DragEvent);
    const request = http.expectOne(r => r.url === base + '/preview');
    expect(request.request.body).toBe(file);
    http.expectNone(base + '/restore');
    request.flush(reviewed);
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Recuperar 3 registros faltantes');
    const saving = component.restore();
    component.restore();
    const restore = http.expectOne(base + '/restore?tenant_id=company');
    expect(restore.request.headers.get('X-Vesta-Backup-Review')).toBe('reviewed-file');
    restore.flush({ restored: 3 });
    await saving;
    expect(component.success()).toContain('3 registros añadidos');
    expect(component.review()).toBeNull();
    fixture.destroy(); http.verify();
  });
  it('clears the previous review when changing company and rejects invalid file types', async () => {
    const { fixture, http, component } = setup();
    component.review.set(reviewed);
    component.companyId = 'other'; component.changeCompany();
    http.expectOne(base + '?tenant_id=other').flush({ backups: [] });
    expect(component.review()).toBeNull();
    await component.inspectFile(new File(['oops'], 'backup.rar'));
    expect(component.error()).toContain('.json');
    await component.restore(); http.expectNone(r => r.url.endsWith('/restore'));
    fixture.destroy(); http.verify();
  });
  it('creates a backup and downloads a plain JSON file immediately', async () => {
    const { fixture, http, component } = setup();
    const previousCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const previousRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:backup') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    let filename = '';
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function(this: HTMLAnchorElement) { filename = this.download; });
    const creating = component.create();
    http.expectOne(base + '?tenant_id=company').flush({ id: 'backup-id', created_at: '2026-10-23T10:00:00Z' });
    await new Promise(resolve => setTimeout(resolve, 0));
    http.expectOne(base + '/backup-id/download?tenant_id=company').flush(new Blob(['{}'], { type: 'application/json' }));
    await new Promise(resolve => setTimeout(resolve, 0));
    http.expectOne(base + '?tenant_id=company').flush({ backups: [] });
    await creating;
    expect(filename).toBe('vesta-backup-2026-10-23-backup-id.json');
    click.mockRestore();
    if (previousCreate) Object.defineProperty(URL, 'createObjectURL', previousCreate); else Reflect.deleteProperty(URL, 'createObjectURL');
    if (previousRevoke) Object.defineProperty(URL, 'revokeObjectURL', previousRevoke); else Reflect.deleteProperty(URL, 'revokeObjectURL');
    fixture.destroy(); http.verify();
  });
});
