import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GeneradorSinteticoComponent } from '../analitica/generador-sintetico.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subscription } from 'rxjs';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { BOLIVIA_DEPARTMENTS, normalizeLocation } from '../../nucleo/datos/ubicaciones-bolivia';
import {
  SaasService,
  CompanySubscription,
  SaasPlan,
  SubscriptionPayment,
} from '../../nucleo/servicios/saas.service';
import {
  longitudMinimaSinEspacios,
  seguridadContrasenaValidator,
  sinEspaciosVaciosValidator,
} from '../../nucleo/validadores/validadores-personalizados';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, GeneradorSinteticoComponent],
  templateUrl: './saas.component.html',
  styleUrl: './saas.component.css',
})
export class SaasComponent {
  readonly departments = BOLIVIA_DEPARTMENTS;
  readonly departmentValidator = (control: { value: string }) =>
    this.departments.some(name => normalizeLocation(name) === normalizeLocation(control.value || ''))
      ? null : { department: true };
  readonly auth = inject(AutenticacionService);
  private api = inject(SaasService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  readonly platform = this.route.snapshot.data['platform'] === true;
  companies = signal<CompanySubscription[]>([]);
  syntheticCompany = signal<CompanySubscription | null>(null);
  plans = signal<SaasPlan[]>([]);
  current = signal<CompanySubscription | null>(null);
  payments = signal<SubscriptionPayment[]>([]);
  selectedPayment = signal<SubscriptionPayment | null>(null);
  isDownloadingInvoice = signal(false);
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  success = signal('');
  paymentError = signal('');
  paymentSuccess = signal('');
  billingCycle = signal<'monthly' | 'annual'>('monthly');
  showCreate = signal(false);
  showCreatePlan = signal(false);
  private fb = inject(FormBuilder);
  planForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, longitudMinimaSinEspacios(2), Validators.maxLength(80)]],
    price_usd: [50, [Validators.required, Validators.min(.01), Validators.max(100000), Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    duration_days: [30, [Validators.required, Validators.min(1), Validators.max(365), Validators.pattern(/^\d+$/)]],
    branch_limit: [25, [Validators.required, Validators.min(1), Validators.max(1000), Validators.pattern(/^\d+$/)]],
    ai_reports: [true],
  });
  form = this.fb.nonNullable.group({
    department: ['', [Validators.required, this.departmentValidator]],
    name: [
      '',
      [
        Validators.required,
        longitudMinimaSinEspacios(2),
        Validators.maxLength(150),
        sinEspaciosVaciosValidator(),
      ],
    ],
    slug: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(80),
        Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      ],
    ],
    admin_name: [
      '',
      [
        Validators.required,
        longitudMinimaSinEspacios(2),
        Validators.maxLength(100),
        sinEspaciosVaciosValidator(),
      ],
    ],
    admin_email: ['', [Validators.required, Validators.email]],
    admin_password: ['', [Validators.required, seguridadContrasenaValidator()]],
  });
  constructor() {
    this.load();
    const paymentUpdated = (event: StorageEvent) => {
      if (event.key === 'vesta_subscription_paid') {
        this.load();
        try {
          const parsed = JSON.parse(event.newValue || '{}');
          if (parsed.order_id) {
            this.refreshPayments(parsed.order_id);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', paymentUpdated);
    this.destroyRef.onDestroy(() => window.removeEventListener('storage', paymentUpdated));
    const checkout = this.route.snapshot.queryParamMap.get('checkout');
    const token = this.route.snapshot.queryParamMap.get('token');
    const isNewTab = this.route.snapshot.queryParamMap.get('newtab') === '1';

    if (!this.platform && checkout === 'return' && token) {
      if (isNewTab) {
        // Redirigir la pestaña de pago a la cuenta PayPal Sandbox y notificar la pestaña principal
        this.api.capture(token).subscribe({
          next: (row) => {
            localStorage.setItem(
              'vesta_subscription_paid',
              JSON.stringify({ company: row.id, at: Date.now(), order_id: token }),
            );
            window.location.replace('https://sandbox.paypal.com/myaccount/summary?intl=0');
          },
          error: () => {
            window.location.replace('https://sandbox.paypal.com/myaccount/summary?intl=0');
          },
        });
      } else {
        this.capture(token);
      }
    }
    if (checkout === 'cancel') this.success.set('Pago cancelado. Tu plan no ha cambiado.');
  }

  assignDepartment(company: CompanySubscription, department: string) {
    if (this.busy()) return;
    if (!this.departments.some(name => normalizeLocation(name) === normalizeLocation(department))) {
      this.error.set('Selecciona uno de los nueve departamentos de Bolivia.');
      return;
    }
    this.busy.set(true);
    this.api.setDepartment(company.id, department).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: updated => {
        this.companies.update(rows => rows.map(row => row.id === updated.id ? updated : row));
        this.error.set('');
        this.success.set('Departamento asignado. Las nuevas sucursales usarán sus ciudades/municipios.');
      },
      error: error => this.fail(error),
    });
  }
  private loads: Subscription[] = [];
  load(selectOrderId?: string) {
    this.loads.forEach((request) => request.unsubscribe());
    this.loads = [];
    this.loading.set(true);
    this.loads.push(
      this.api
        .plans()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (rows) => this.plans.set(rows), error: (e) => this.fail(e) }),
    );
    if (this.platform) {
      this.loads.push(
        this.api
          .companies()
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            finalize(() => this.loading.set(false)),
          )
          .subscribe({ next: (rows) => this.companies.set(rows), error: (e) => this.fail(e) }),
      );
    } else {
      this.loads.push(
        this.api
          .subscription()
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            finalize(() => this.loading.set(false)),
          )
          .subscribe({ next: (row) => this.current.set(row), error: (e) => this.fail(e) }),
      );
      if (this.auth.currentUser()?.role === 'ADMIN') {
        this.loads.push(
          this.api
            .payments()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (rows) => {
                this.payments.set(rows);
                if (selectOrderId) {
                  const target = rows.find(
                    (p) => p.order_id === selectOrderId || p.capture_id === selectOrderId,
                  );
                  if (target) this.selectedPayment.set(target);
                }
              },
              error: (e) => this.fail(e),
            }),
        );
      }
    }
  }

  refreshPayments(selectOrderId?: string) {
    if (this.auth.currentUser()?.role === 'ADMIN') {
      this.api
        .payments()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (rows) => {
            this.payments.set(rows);
            if (selectOrderId) {
              const target = rows.find(
                (p) => p.order_id === selectOrderId || p.capture_id === selectOrderId,
              );
              if (target) this.selectedPayment.set(target);
            }
          },
          error: () => {},
        });
    }
  }

  cleanAndRefreshPayments() {
    this.resetMessages();
    this.selectedPayment.set(null);
    this.refreshPayments();
  }

  selectPayment(p: SubscriptionPayment) {
    this.selectedPayment.set(p);
  }

  downloadReceiptPdf(paymentId: string) {
    if (this.isDownloadingInvoice()) return;
    this.isDownloadingInvoice.set(true);
    this.api
      .downloadSubscriptionInvoice(paymentId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isDownloadingInvoice.set(false)),
      )
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `recibo_suscripcion_${paymentId.slice(0, 8)}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          this.error.set('No se pudo descargar el comprobante en PDF.');
        },
      });
  }

  printReceipt() {
    window.print();
  }

  fail(e: any) {
    this.error.set(
      typeof e?.error?.detail === 'string'
        ? e.error.detail
        : 'No se pudo completar la operación. Revisa los datos y tu conexión.',
    );
  }
  resetMessages() {
    this.error.set('');
    this.success.set('');
    this.paymentError.set('');
    this.paymentSuccess.set('');
  }
  create() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.resetMessages();
    this.busy.set(true);
    this.api
      .createCompany(this.form.getRawValue())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          this.showCreate.set(false);
          this.form.reset();
          this.success.set(
            'Empresa y administrador creados con 2 sucursales permitidas. Ya pueden iniciar sesión con el correo y la contraseña registrados.',
          );
          this.load();
        },
        error: (e) => this.fail(e),
      });
  }
  toggleCompany(company: CompanySubscription) {
    if (this.busy()) return;
    this.resetMessages();
    this.busy.set(true);
    this.api
      .status(company.id, !company.is_active)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          this.success.set('Estado de la empresa actualizado.');
          this.load();
        },
        error: (e) => this.fail(e),
      });
  }
  savePlan(plan: SaasPlan) {
    if (
      this.busy() ||
      !Number.isInteger(plan.branch_limit) ||
      plan.branch_limit < 1 ||
      plan.branch_limit > 1000
    )
      return;
    this.resetMessages();
    this.busy.set(true);
    this.api
      .updatePlan(plan.code, { branch_limit: plan.branch_limit, ai_reports: plan.ai_reports })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          this.success.set('Configuración del plan guardada.');
          this.load();
        },
        error: (e) => this.fail(e),
      });
  }
  createPlan() {
    if (!this.auth.currentUser()?.is_saas_admin || this.busy()) return;
    this.planForm.markAllAsTouched();
    if (this.planForm.invalid) return;
    this.resetMessages(); this.busy.set(true);
    this.api.createPlan(this.planForm.getRawValue()).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: plan => {
        this.plans.update(rows => [...rows, plan].sort((a,b) => Number(a.price_usd) - Number(b.price_usd)));
        this.showCreatePlan.set(false);
        this.planForm.reset({name:'', price_usd:50, duration_days:30, branch_limit:25, ai_reports:true});
        this.success.set(`Plan ${plan.name} creado. Ya está disponible para contratar.`);
      }, error: e => this.fail(e),
    });
  }
  checkout(planCode = 'PRO') {
    if (this.busy()) return;
    this.resetMessages();
    this.busy.set(true);
    const paymentTab = window.open('about:blank', '_blank');
    if (!paymentTab) {
      this.busy.set(false);
      this.error.set('Permite abrir una nueva pestaña para continuar con PayPal.');
      return;
    }
    paymentTab.opener = null;
    this.api
      .checkout(planCode === 'PRO' ? this.billingCycle() : 'monthly', planCode)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (result) => {
          try {
            const url = new URL(result.approval_url);
            if (
              url.protocol !== 'https:' ||
              !(url.hostname === 'paypal.com' || url.hostname.endsWith('.paypal.com'))
            )
              throw new Error();
            paymentTab.location.href = url.href;
            this.success.set(
              'PayPal Sandbox se abrió en otra pestaña. Autoriza el pago en PayPal y vuelve aquí para verificar el pago.',
            );
          } catch {
            paymentTab.close();
            this.error.set('PayPal no devolvió un enlace de pago válido.');
          }
        },
        error: (e) => {
          paymentTab.close();
          this.fail(e);
        },
      });
  }
  capture(orderId: string) {
    if (this.busy()) return;
    this.resetMessages();
    this.busy.set(true);
    this.api
      .capture(orderId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (row) => {
          this.current.set(row);
          this.paymentSuccess.set(
            `¡Pago confirmado! Tu plan ${row.plan_name} está activo con hasta ${row.branch_limit} sucursales.`,
          );
          localStorage.setItem(
            'vesta_subscription_paid',
            JSON.stringify({ company: row.id, at: Date.now(), order_id: orderId }),
          );
          if (this.route.snapshot.queryParamMap.get('newtab') === '1') {
            window.location.replace('https://sandbox.paypal.com/myaccount/summary?intl=0');
          } else {
            this.refreshPayments(orderId);
          }
        },
        error: (e) => {
          const detail =
            typeof e?.error?.detail === 'string'
              ? e.error.detail
              : 'PayPal no confirmó el pago. Puedes volver a verificarlo sin duplicar el cobro.';
          this.paymentError.set(detail);
        },
      });
  }

  cancelPayment(paymentId: string) {
    if (this.busy()) return;
    this.resetMessages();
    this.busy.set(true);
    this.api
      .cancelPayment(paymentId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          this.paymentSuccess.set('Pago pendiente cancelado.');
          if (this.selectedPayment()?.id === paymentId) {
            this.selectedPayment.set(null);
          }
          this.refreshPayments();
        },
        error: (e) => {
          const detail =
            typeof e?.error?.detail === 'string'
              ? e.error.detail
              : 'No se pudo cancelar el pago.';
          this.paymentError.set(detail);
        },
      });
  }

  deletePayment(paymentId: string) {
    if (this.busy()) return;
    this.resetMessages();
    this.busy.set(true);
    this.api
      .deletePayment(paymentId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          this.paymentSuccess.set('Registro de pago eliminado del historial.');
          if (this.selectedPayment()?.id === paymentId) {
            this.selectedPayment.set(null);
          }
          this.refreshPayments();
        },
        error: (e) => {
          const detail =
            typeof e?.error?.detail === 'string'
              ? e.error.detail
              : 'No se pudo eliminar el registro de pago.';
          this.paymentError.set(detail);
        },
      });
  }

  statusLabel(status: string) {
    return (
      (
        {
          ACTIVE: 'Activa',
          EXPIRED: 'Vencida',
          SUSPENDED: 'Suspendida',
          PENDING: 'Pendiente',
          PAID: 'Pagado',
          CANCELLED: 'Cancelado',
        } as Record<string, string>
      )[status] ?? status
    );
  }
}
