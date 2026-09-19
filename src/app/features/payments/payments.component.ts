import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentService } from '../../core/services/payment.service';
import { BranchService } from '../../core/services/branch.service';
import { AuthService } from '../../core/services/auth.service';
import { StockService } from '../../core/services/stock.service';
import { Branch } from '../../core/models/branch.model';
import { BranchInventoryItem } from '../../core/models/stock.model';
import {
  Payment,
  PaymentItem,
  PaymentStatus,
  PaymentType,
  PendingReservationOption,
} from '../../core/models/payment.model';
import { TokenService } from '../../core/services/token.service';
import { environment } from '../../../environments/environment';

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
  branchInventory = signal<BranchInventoryItem[]>([]);

  // Cart for direct POS sale
  cartItems = signal<PaymentItem[]>([]);
  selectedVariantId = signal<string>('');
  selectedItemQuantity = signal<number>(1);

  isLoading = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  isDownloadingInvoice = signal<string | null>(null);
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

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private paymentService: PaymentService,
    private branchService: BranchService,
    private stockService: StockService,
    private tokenService: TokenService,
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

  selectedBranchItem = computed(() =>
    this.branchInventory().find((i) => i.variant_id === this.selectedVariantId())
  );

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
    this.cartItems.set([]);
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

    this.loadBranchInventory(bId);
  }

  loadBranchInventory(branchId: string): void {
    this.stockService.getBranchInventory(branchId).subscribe({
      next: (items) => {
        this.branchInventory.set(items);
        if (items.length > 0 && (!this.selectedVariantId() || !items.some(i => i.variant_id === this.selectedVariantId()))) {
          this.selectedVariantId.set(items[0].variant_id);
        }
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

    this.cartItems.set([]);
    this.posForm.patchValue({
      customer_name: res.customer_name,
      customer_email: res.customer_email || '',
      concept: `Reserva ${res.reservation_code}: ${res.items_summary}`,
      amount: res.total_amount,
    });
  }

  // Cart Management for Direct Sale
  addCartItem(): void {
    const item = this.selectedBranchItem();
    if (!item) {
      this.showToast('Selecciona un producto del inventario', 'error');
      return;
    }
    const qty = Number(this.selectedItemQuantity());
    if (qty <= 0) {
      this.showToast('La cantidad debe ser mayor a 0', 'error');
      return;
    }
    if (qty > item.quantity) {
      this.showToast(`Stock insuficiente en sucursal (Disponible: ${item.quantity})`, 'error');
      return;
    }

    const currentCart = [...this.cartItems()];
    const existingIndex = currentCart.findIndex((c) => c.variant_id === item.variant_id);

    if (existingIndex >= 0) {
      const newTotalQty = currentCart[existingIndex].quantity + qty;
      if (newTotalQty > item.quantity) {
        this.showToast(`No puedes superar el stock disponible en tienda (${item.quantity})`, 'error');
        return;
      }
      currentCart[existingIndex].quantity = newTotalQty;
      currentCart[existingIndex].subtotal = Math.round(newTotalQty * item.price * 100) / 100;
    } else {
      currentCart.push({
        variant_id: item.variant_id,
        product_name: item.product_name,
        sku: item.sku,
        size: item.size_code || item.size_name,
        color: item.color_name,
        quantity: qty,
        unit_price: item.price,
        subtotal: Math.round(qty * item.price * 100) / 100,
      });
    }

    this.cartItems.set(currentCart);
    this.updateTotalsFromCart();
    this.selectedItemQuantity.set(1);
    this.showToast(`✓ Agregado: ${qty}x ${item.product_name}`, 'success');
  }

  removeCartItem(index: number): void {
    const currentCart = [...this.cartItems()];
    currentCart.splice(index, 1);
    this.cartItems.set(currentCart);
    this.updateTotalsFromCart();
  }

  updateCartItemQty(index: number, delta: number): void {
    const currentCart = [...this.cartItems()];
    const item = currentCart[index];
    const stockItem = this.branchInventory().find((b) => b.variant_id === item.variant_id);
    const maxStock = stockItem ? stockItem.quantity : 999;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      this.removeCartItem(index);
      return;
    }
    if (newQty > maxStock) {
      this.showToast(`Stock máximo disponible alcanzado (${maxStock})`, 'error');
      return;
    }

    item.quantity = newQty;
    item.subtotal = Math.round(newQty * item.unit_price * 100) / 100;
    this.cartItems.set(currentCart);
    this.updateTotalsFromCart();
  }

  updateTotalsFromCart(): void {
    const cart = this.cartItems();
    if (cart.length === 0) {
      this.posForm.patchValue({ amount: 0, concept: '' });
      return;
    }
    const total = cart.reduce((acc, itm) => acc + itm.subtotal, 0);
    const concept = cart.map((i) => `${i.quantity}x ${i.product_name}`).join(', ');
    this.posForm.patchValue({
      amount: Math.round(total * 100) / 100,
      concept: `Venta: ${concept}`,
    });
  }

  // Invoice PDF Download
  downloadInvoice(p: Payment): void {
    this.isDownloadingInvoice.set(p.id);
    this.paymentService.downloadInvoicePdf(p.id).subscribe({
      next: (blob) => {
        this.isDownloadingInvoice.set(null);
        if (!blob || blob.size === 0) {
          this.fallbackDirectInvoiceDownload(p);
          return;
        }
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `factura_${p.payment_code}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.showToast(`✓ Factura #${p.payment_code} descargada con éxito`, 'success');
      },
      error: (err) => {
        console.warn('Fallo en descarga Blob, intentando descarga directa con token:', err);
        this.fallbackDirectInvoiceDownload(p);
      },
    });
  }

  private fallbackDirectInvoiceDownload(p: Payment): void {
    this.isDownloadingInvoice.set(null);
    const token = this.tokenService.getAccessToken();
    const directUrl = `${environment.apiUrl}/payments/${p.id}/invoice-pdf${token ? '?token=' + token : ''}`;
    try {
      window.open(directUrl, '_blank');
      this.showToast(`✓ Abriendo Factura #${p.payment_code} en nueva pestaña`, 'success');
    } catch {
      this.showToast('Error al generar o descargar la factura PDF', 'error');
    }
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
      items: this.cartItems().length > 0 ? this.cartItems() : undefined,
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
    this.cartItems.set([]);
    this.selectedItemQuantity.set(1);
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
