import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentService } from '../../core/services/payment.service';
import { BranchService } from '../../core/services/branch.service';
import { AuthService } from '../../core/services/auth.service';
import { Branch } from '../../core/models/branch.model';
import {
  Payment,
  PaymentStatus,
  PaymentType,
  PendingReservationOption,
} from '../../core/models/payment.model';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './payments.component.html',
  styleUrls: ['./payments.component.css'],
})
export class PaymentsComponent implements OnInit {
  branches = signal<Branch[]>([]);
  selectedBranchId = signal<string>('');
  payments = signal<Payment[]>([]);
  pendingReservations = signal<PendingReservationOption[]>([]);

  isLoading = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  activeFilter = signal<'ALL' | 'EFECTIVO' | 'PAYPAL' | 'PAID' | 'PENDING'>('ALL');
  searchTerm = signal<string>('');

  // Form
  posForm: FormGroup;
  selectedPaymentType = signal<PaymentType>('EFECTIVO');

  // Cash quick confirm modal
  isCashConfirmModalOpen = signal<boolean>(false);
  pendingPaymentToCash = signal<Payment | null>(null);

  // Toast feedback
  toastMessage = signal<string>('');
  toastType = signal<'success' | 'error'>('success');

  // Quick concept templates
  conceptTemplates = [
    { label: 'Prenda Tienda ($25)', concept: 'Compra de Prenda en Tienda', amount: 25 },
    { label: 'Control ($15)', concept: 'Control de Ajuste y Modistería', amount: 15 },
    { label: 'Conjunto ($35)', concept: 'Conjunto de Colección de Temporada', amount: 35 },
    { label: 'Paquete ($50)', concept: 'Paquete Integral de Prendas y Accesorios', amount: 50 },
  ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private paymentService: PaymentService,
    private branchService: BranchService,
    public authService: AuthService
  ) {
    this.posForm = this.fb.group({
      reservation_id: [''],
      customer_name: ['', [Validators.required, Validators.minLength(2)]],
      customer_email: ['', [Validators.email]],
      concept: ['', [Validators.required, Validators.minLength(3)]],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      notes: [''],
    });
  }

  ngOnInit(): void {
    // Si la URL contiene un token de PayPal anterior, limpiarlo para evitar errores
    if (this.route.snapshot.queryParamMap.has('token')) {
      this.router.navigate([], { replaceUrl: true, queryParams: {} });
    }
    this.loadBranches();
  }

  get cashierName(): string {
    const u = this.authService.currentUser();
    return u ? (u.full_name || u.email || 'Cajero') : 'Cajero';
  }

  get selectedBranchName(): string {
    const b = this.branches().find((br) => br.id === this.selectedBranchId());
    return b ? `${b.name} (${b.city})` : 'Seleccionar Sucursal';
  }

  filteredPayments = computed(() => {
    let list = this.payments();
    const filter = this.activeFilter();
    const term = this.searchTerm().trim().toLowerCase();

    if (filter === 'EFECTIVO') {
      list = list.filter((p) => p.payment_type === 'EFECTIVO');
    } else if (filter === 'PAYPAL') {
      list = list.filter((p) => p.payment_type === 'PAYPAL');
    } else if (filter === 'PAID') {
      list = list.filter((p) => p.status === 'PAID');
    } else if (filter === 'PENDING') {
      list = list.filter((p) => p.status === 'PENDING');
    }

    if (term) {
      list = list.filter(
        (p) =>
          p.customer_name.toLowerCase().includes(term) ||
          (p.customer_email && p.customer_email.toLowerCase().includes(term)) ||
          p.concept.toLowerCase().includes(term) ||
          p.payment_code.toLowerCase().includes(term) ||
          (p.reference && p.reference.toLowerCase().includes(term))
      );
    }

    return list;
  });

  loadBranches(): void {
    this.branchService.getBranches(undefined, true).subscribe({
      next: (data) => {
        this.branches.set(data);
        const user = this.authService.currentUser();
        if (user?.branch_id && data.some((b) => b.id === user.branch_id)) {
          this.selectedBranchId.set(user.branch_id);
        } else if (data.length > 0) {
          this.selectedBranchId.set(data[0].id);
        }
        if (this.selectedBranchId()) {
          this.refreshAll();
        }
      },
      error: () => this.showToast('Error al cargar sucursales', 'error'),
    });
  }

  onBranchChange(branchId: string): void {
    this.selectedBranchId.set(branchId);
    this.refreshAll();
  }

  refreshAll(): void {
    const bId = this.selectedBranchId();
    if (!bId) return;

    this.isLoading.set(true);
    this.paymentService.getPayments({ branch_id: bId, limit: 100 }).subscribe({
      next: (list) => {
        this.payments.set(list);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.showToast('Error al obtener cobros de la sucursal', 'error');
      },
    });

    this.paymentService.getPendingReservations(bId).subscribe({
      next: (reservations) => {
        this.pendingReservations.set(reservations);
      },
      error: () => {},
    });
  }

  setFilter(filter: 'ALL' | 'EFECTIVO' | 'PAYPAL' | 'PAID' | 'PENDING'): void {
    this.activeFilter.set(filter);
  }

  setPaymentType(type: PaymentType): void {
    this.selectedPaymentType.set(type);
  }

  onSelectPendingReservation(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const resId = select.value;
    if (!resId) return;

    const res = this.pendingReservations().find((r) => r.reservation_id === resId);
    if (!res) return;

    this.posForm.patchValue({
      customer_name: res.customer_name,
      customer_email: res.customer_email || '',
      concept: `Reserva ${res.reservation_code}: ${res.items_summary}`,
      amount: res.total_amount,
    });
  }

  applyTemplate(tpl: { label: string; concept: string; amount: number }): void {
    this.posForm.patchValue({
      concept: tpl.concept,
      amount: tpl.amount,
    });
  }

  // Submit Terminal Form
  onSubmitTerminal(): void {
    if (this.posForm.invalid) {
      this.posForm.markAllAsTouched();
      return;
    }

    const branchId = this.selectedBranchId();
    if (!branchId) {
      this.showToast('Por favor selecciona una sucursal', 'error');
      return;
    }

    this.isSubmitting.set(true);
    const formVal = this.posForm.value;
    const paymentType = this.selectedPaymentType();

    const payload = {
      branch_id: branchId,
      reservation_id: formVal.reservation_id || undefined,
      customer_name: formVal.customer_name.trim(),
      customer_email: formVal.customer_email ? formVal.customer_email.trim() : undefined,
      concept: formVal.concept.trim(),
      amount: parseFloat(formVal.amount),
      currency: 'USD',
      payment_type: paymentType,
      notes: formVal.notes ? formVal.notes.trim() : undefined,
    };

    this.paymentService.createPayment(payload).subscribe({
      next: (payment) => {
        if (paymentType === 'EFECTIVO') {
          // Process cash immediately
          this.paymentService.processCashPayment(payment.id, payload.notes).subscribe({
            next: (paidPayment) => {
              this.isSubmitting.set(false);
              this.showToast(`Cobro en efectivo #${paidPayment.payment_code} registrado con éxito ($${paidPayment.amount.toFixed(2)} USD). Movimiento de inventario registrado.`, 'success');
              this.resetTerminalForm();
              this.refreshAll();
            },
            error: (err) => {
              this.isSubmitting.set(false);
              this.showToast(err.error?.detail || 'Error al procesar pago en efectivo', 'error');
              this.refreshAll();
            },
          });
        } else {
          // PayPal Sandbox Flow: abre checkout y queda en PENDIENTE en caja
          this.paymentService.createPayPalCheckout(payment.id).subscribe({
            next: (orderResp) => {
              this.isSubmitting.set(false);
              this.resetTerminalForm();
              this.refreshAll();

              // Abrir PayPal Sandbox en nueva pestaña
              try {
                window.open(orderResp.approval_url, '_blank');
              } catch (e) {
                console.warn('Pop-up blocker intercepted automatic tab opening:', e);
              }
              this.showToast(`✓ Orden #${payment.payment_code} enviada a PayPal Sandbox. Al completar el pago en la otra pestaña, pulsa "Actualizar Caja".`, 'success');
            },
            error: (err) => {
              this.isSubmitting.set(false);
              const errMsg = err.error?.detail || err.message || 'Error al conectar con PayPal Sandbox';
              this.showToast(errMsg, 'error');
              this.refreshAll();
            },
          });
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.showToast(err.error?.detail || 'Error al crear la orden de cobro', 'error');
      },
    });
  }

  // Quick Action on Pending row: Cobrar Efectivo
  openCashConfirm(p: Payment): void {
    this.pendingPaymentToCash.set(p);
    this.isCashConfirmModalOpen.set(true);
  }

  closeCashConfirm(): void {
    this.isCashConfirmModalOpen.set(false);
    this.pendingPaymentToCash.set(null);
  }

  confirmCashPayment(): void {
    const p = this.pendingPaymentToCash();
    if (!p) return;

    this.isSubmitting.set(true);
    this.paymentService.processCashPayment(p.id, 'Cobrado en efectivo en caja física').subscribe({
      next: (updated) => {
        this.isSubmitting.set(false);
        this.closeCashConfirm();
        this.showToast(`Pago #${updated.payment_code} completado en efectivo ($${updated.amount.toFixed(2)} USD). Movimiento de stock registrado.`, 'success');
        this.refreshAll();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.showToast(err.error?.detail || 'Error al registrar cobro en efectivo', 'error');
      },
    });
  }

  // Quick Action on Pending row: Cobrar PayPal
  initiatePayPalFromRow(p: Payment): void {
    this.isSubmitting.set(true);
    this.paymentService.createPayPalCheckout(p.id).subscribe({
      next: (orderResp) => {
        this.isSubmitting.set(false);
        this.refreshAll();

        try {
          window.open(orderResp.approval_url, '_blank');
        } catch (e) {
          console.warn('Pop-up blocker intercepted automatic tab opening:', e);
        }
        this.showToast(`✓ Abriendo PayPal Sandbox en nueva pestaña... Al completar el pago, pulsa "Actualizar Caja".`, 'success');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const errMsg = err.error?.detail || err.message || 'Error al iniciar checkout PayPal Sandbox';
        this.showToast(errMsg, 'error');
      },
    });
  }

  resetTerminalForm(): void {
    this.posForm.reset({
      reservation_id: '',
      customer_name: '',
      customer_email: '',
      concept: '',
      amount: 0,
      notes: '',
    });
    this.selectedPaymentType.set('EFECTIVO');
  }

  showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage.set(message);
    this.toastType.set(type);
    setTimeout(() => {
      this.toastMessage.set('');
    }, 6000);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
