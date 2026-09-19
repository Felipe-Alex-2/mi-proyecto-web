import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ReservationService } from '../../core/services/reservation.service';

@Component({
  selector: 'app-paypal-return',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="paypal-return-container">
      <div class="paypal-return-card">
        <div *ngIf="loading()" class="status-box">
          <div class="spinner"></div>
          <h2>Procesando pago con PayPal...</h2>
          <p>Estamos confirmando la transacción con PayPal Sandbox. Por favor espera un momento.</p>
        </div>

        <div *ngIf="success()" class="status-box success">
          <div class="icon-circle success">✓</div>
          <h2>¡Pago y Reserva Confirmados!</h2>
          <p>{{ successDetail() }}</p>
          <div class="redirect-notice">Redirigiendo a Gestión de Reservas...</div>
        </div>

        <div *ngIf="errorMsg()" class="status-box error">
          <div class="icon-circle error">✕</div>
          <h2>Error al capturar el pago</h2>
          <p>{{ errorMsg() }}</p>
          <button class="btn-back" (click)="goToReservations()">Volver a Reservas</button>
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
      max-width: 480px;
      width: 100%;
      border-radius: 16px;
      padding: 2.5rem 2rem;
      box-shadow: 0 10px 30px rgba(44, 24, 16, 0.08);
      text-align: center;
      border: 1px solid #EFEAE1;
    }

    .status-box h2 {
      color: #2C1810;
      font-size: 1.4rem;
      margin: 1rem 0 0.5rem 0;
      font-weight: 700;
    }

    .status-box p {
      color: #7A6956;
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 1.5rem;
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
      width: 60px;
      height: 60px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.8rem;
      font-weight: bold;
      margin: 0 auto;
    }

    .icon-circle.success {
      background: #E8F5E9;
      color: #2E7D32;
    }

    .icon-circle.error {
      background: #FFEBEE;
      color: #C62828;
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reservationService: ReservationService
  ) {}

  ngOnInit(): void {
    const orderId = this.route.snapshot.queryParamMap.get('token');

    if (!orderId) {
      this.loading.set(false);
      this.errorMsg.set('No se recibió el identificador de orden de PayPal.');
      return;
    }

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

  goToReservations(): void {
    this.router.navigate(['/reservations']);
  }
}
