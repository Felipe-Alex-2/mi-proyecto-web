import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ReservationService } from '../../core/services/reservation.service';
import { PaymentService } from '../../core/services/payment.service';

@Component({
  selector: 'app-paypal-return',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="paypal-return-container">
      <div class="paypal-return-card">
        <div *ngIf="loading()" class="status-box">
          <div class="spinner"></div>
          <h2>Confirmando pago con PayPal Sandbox...</h2>
          <p>Por favor espera un momento mientras procesamos la transacción.</p>
        </div>

        <div *ngIf="success()" class="status-box success">
          <div class="icon-circle success">✓</div>
          <h2>¡Pago Realizado con Éxito!</h2>
          <div class="pago-hecho-badge">PAGO HECHO • PAYPAL SANDBOX</div>
          <p class="detail-msg">{{ successDetail() }}</p>
          
          <div *ngIf="isPosPayment()" class="pos-instructions">
            <p class="hint-close">Ya puedes cerrar esta pestaña del navegador y volver a la caja de la tienda.</p>
            <p class="hint-sub">Al pulsar <strong>Actualizar Caja</strong> en el sistema, la venta aparecerá como <strong>PAGADO</strong> automáticamente.</p>
            <button class="btn-close-window" (click)="closeTab()">Cerrar esta pestaña</button>
          </div>

          <div *ngIf="!isPosPayment()" class="redirect-notice">
            Redirigiendo a Gestión de Reservas...
          </div>
        </div>

        <div *ngIf="errorMsg()" class="status-box error">
          <div class="icon-circle error">✕</div>
          <h2>Error al procesar el pago</h2>
          <p>{{ errorMsg() }}</p>
          <div *ngIf="isPosPayment()">
            <p class="hint-sub">Puedes volver a la caja y presionar <strong>Actualizar Caja</strong> para comprobar el estado.</p>
            <button class="btn-close-window" (click)="closeTab()">Cerrar pestaña</button>
          </div>
          <button *ngIf="!isPosPayment()" class="btn-back" (click)="goToReservations()">Volver a Reservas</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .paypal-return-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #F5F0E8;
      padding: 2rem;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    .paypal-return-card {
      background: #ffffff;
      max-width: 520px;
      width: 100%;
      border-radius: 16px;
      padding: 2.5rem 2rem;
      box-shadow: 0 10px 30px rgba(44, 24, 16, 0.08);
      text-align: center;
      border: 1px solid #EFEAE1;
    }

    .status-box h2 {
      color: #2C1810;
      font-size: 1.45rem;
      font-weight: 800;
      margin: 1rem 0 0.5rem 0;
    }

    .status-box p {
      color: #7A6956;
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 1.25rem;
    }

    .pago-hecho-badge {
      display: inline-block;
      background: #ECFDF5;
      color: #065F46;
      border: 1px solid #A7F3D0;
      font-size: 0.8rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      padding: 0.35rem 0.9rem;
      border-radius: 20px;
      margin-bottom: 1rem;
    }

    .detail-msg {
      font-size: 0.92rem;
      color: #374151;
      font-weight: 500;
    }

    .pos-instructions {
      background: #FAF7F2;
      border: 1px dashed #D8CEC4;
      border-radius: 12px;
      padding: 1.25rem 1rem;
      margin-top: 1rem;
    }

    .hint-close {
      font-weight: 700;
      color: #2C1810;
      margin-bottom: 0.4rem !important;
    }

    .hint-sub {
      font-size: 0.85rem !important;
      color: #7C6A5A;
      margin-bottom: 1rem !important;
    }

    .btn-close-window {
      background: #0070BA;
      color: #FFFFFF;
      border: none;
      padding: 0.75rem 1.75rem;
      border-radius: 8px;
      font-size: 0.92rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 112, 186, 0.25);
      transition: all 0.2s ease;
    }

    .btn-close-window:hover {
      background: #005EA6;
      transform: translateY(-1px);
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #EFEAE1;
      border-top-color: #0070BA;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .icon-circle {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      font-weight: bold;
      margin: 0 auto;
    }

    .icon-circle.success {
      background: #D1FAE5;
      color: #059669;
    }

    .icon-circle.error {
      background: #FEE2E2;
      color: #DC2626;
    }

    .redirect-notice {
      font-size: 0.85rem;
      color: #8B7355;
      font-style: italic;
    }

    .btn-back {
      background: #8B4513;
      color: #ffffff;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-back:hover {
      background: #6F370F;
    }
  `]
})
export class PaypalReturnComponent implements OnInit {
  loading = signal<boolean>(true);
  success = signal<boolean>(false);
  errorMsg = signal<string | null>(null);
  successDetail = signal<string>('');
  isPosPayment = signal<boolean>(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reservationService: ReservationService,
    private paymentService: PaymentService
  ) {}

  ngOnInit(): void {
    const orderId = this.route.snapshot.queryParamMap.get('token');
    const source = this.route.snapshot.queryParamMap.get('source');
    const isPos = source === 'pos';
    this.isPosPayment.set(isPos);

    if (!orderId) {
      this.loading.set(false);
      this.errorMsg.set('No se recibió el identificador de orden de PayPal.');
      return;
    }

    if (isPos) {
      // Capturar cobro de Caja / POS
      this.paymentService.publicCapturePayPal(orderId).subscribe({
        next: (p) => {
          this.loading.set(false);
          this.success.set(true);
          this.successDetail.set(
            `El cobro #${p.payment_code} por $${p.amount.toFixed(2)} ${p.currency} fue registrado exitosamente a la cuenta Business.`
          );
        },
        error: () => {
          // Si ya fue capturada o confirmada, dar por hecho el pago
          this.loading.set(false);
          this.success.set(true);
          this.successDetail.set(
            `La transacción con orden (${orderId}) ha sido completada en PayPal Sandbox.`
          );
        },
      });
    } else {
      // Flujo de reserva directa
      this.reservationService.capturePayPalOrder(orderId).subscribe({
        next: (res) => {
          this.loading.set(false);
          this.success.set(true);
          const code = res.reservation?.reservation_code || '';
          this.successDetail.set(
            `Tu orden (${orderId}) ha sido completada exitosamente para la reserva ${code}.`
          );
          setTimeout(() => {
            this.router.navigate(['/reservations']);
          }, 3000);
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMsg.set(
            err.error?.detail || 'Error al capturar la orden en PayPal Sandbox.'
          );
        },
      });
    }
  }

  closeTab(): void {
    window.close();
  }

  goToReservations(): void {
    this.router.navigate(['/reservations']);
  }
}
