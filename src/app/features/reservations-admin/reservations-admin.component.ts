import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReservationService } from '../../core/services/reservation.service';
import { BranchService } from '../../core/services/branch.service';
import { AuthService } from '../../core/services/auth.service';
import { Reservation, ReservationStatus, ReservationStats } from '../../core/models/reservation.model';
import { Branch } from '../../core/models/branch.model';

@Component({
  selector: 'app-reservations-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reservations-admin.component.html',
  styleUrls: ['./reservations-admin.component.css'],
})
export class ReservationsAdminComponent implements OnInit {
  reservations = signal<Reservation[]>([]);
  stats = signal<ReservationStats | null>(null);
  branches = signal<Branch[]>([]);
  isLoading = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);

  selectedStatusFilter = signal<string>('');
  selectedBranchFilter = signal<string>('');

  // Status change modal
  isStatusModalOpen = signal<boolean>(false);
  selectedReservation = signal<Reservation | null>(null);
  statusForm: FormGroup;

  feedbackMessage = signal<string>('');
  feedbackType = signal<'success' | 'error'>('success');

  constructor(
    private fb: FormBuilder,
    private reservationService: ReservationService,
    private branchService: BranchService,
    public authService: AuthService
  ) {
    this.statusForm = this.fb.group({
      status: ['CONFIRMED', Validators.required],
      staff_notes: ['', [Validators.required, Validators.minLength(5)]],
      payment_method: ['EFECTIVO', Validators.required],
      payment_status: ['PENDING', Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadBranches();
    this.loadStats();
    this.loadReservations();
  }

  loadBranches(): void {
    this.branchService.getBranches(undefined, true).subscribe({
      next: (b) => {
        this.branches.set(b);
        const user = this.authService.currentUser();
        if (user?.branch_id) {
          this.selectedBranchFilter.set(user.branch_id);
        }
      },
    });
  }

  loadStats(): void {
    const branchId = this.selectedBranchFilter() || undefined;
    this.reservationService.getStats(branchId).subscribe({
      next: (s) => this.stats.set(s),
    });
  }

  loadReservations(): void {
    this.isLoading.set(true);
    this.reservationService
      .getReservations({
        branch_id: this.selectedBranchFilter() || undefined,
        status: this.selectedStatusFilter() || undefined,
      })
      .subscribe({
        next: (list) => {
          this.reservations.set(list);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  onFilterChange(): void {
    this.loadStats();
    this.loadReservations();
  }

  openStatusModal(r: Reservation, targetStatus: ReservationStatus): void {
    this.selectedReservation.set(r);
    this.statusForm.reset({
      status: targetStatus,
      staff_notes: '',
      payment_method: r.payment_method || 'EFECTIVO',
      payment_status: r.payment_status || (targetStatus === 'COMPLETED' ? 'PAID' : 'PENDING'),
    });
    this.isStatusModalOpen.set(true);
  }

  closeStatusModal(): void {
    this.isStatusModalOpen.set(false);
    this.selectedReservation.set(null);
  }

  onSubmitStatus(): void {
    const r = this.selectedReservation();
    if (!r) return;

    if (this.statusForm.invalid) {
      this.statusForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.feedbackMessage.set('');
    const val = this.statusForm.value;

    this.reservationService
      .updateStatus(r.id, {
        status: val.status as ReservationStatus,
        staff_notes: val.staff_notes.trim(),
        payment_method: val.payment_method,
        payment_status: val.payment_status,
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          try {
            this.closeStatusModal();
            const extraInfo = (val.status === 'CONFIRMED' || val.status === 'COMPLETED')
              ? ' (movimiento de stock registrado automáticamente)'
              : '';
            this.showToast(`Reserva ${r.reservation_code} actualizada a ${val.status}${extraInfo}`, 'success');
            this.loadStats();
            this.loadReservations();
          } catch (e) {
            console.error('Error al recargar reservas:', e);
          }
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.showToast(err.error?.detail || 'Error al actualizar el estado de la reserva', 'error');
        },
      });
  }

  quickConfirm(r: Reservation): void {
    this.feedbackMessage.set('');
    this.reservationService
      .updateStatus(r.id, {
        status: 'CONFIRMED',
        staff_notes: 'Reserva confirmada por el personal de tienda',
      })
      .subscribe({
        next: () => {
          try {
            this.showToast(`Reserva ${r.reservation_code} confirmada y registrada en movimientos de stock`, 'success');
            this.loadStats();
            this.loadReservations();
          } catch (e) {
            console.error('Error al recargar reservas tras confirmación:', e);
          }
        },
        error: (err) => {
          this.showToast(err.error?.detail || 'Error al confirmar reserva', 'error');
        },
      });
  }

  showToast(msg: string, type: 'success' | 'error'): void {
    this.feedbackMessage.set(msg);
    this.feedbackType.set(type);
    setTimeout(() => this.feedbackMessage.set(''), 4500);
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'badge-pending';
      case 'CONFIRMED':
        return 'badge-confirmed';
      case 'COMPLETED':
        return 'badge-completed';
      case 'CANCELLED':
        return 'badge-cancelled';
      case 'EXPIRED':
        return 'badge-expired';
      default:
        return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'Pendiente';
      case 'CONFIRMED':
        return 'Confirmada';
      case 'COMPLETED':
        return 'Completada';
      case 'CANCELLED':
        return 'Cancelada';
      case 'EXPIRED':
        return 'Vencida';
      default:
        return status;
    }
  }

  getPaymentBadgeClass(paymentStatus?: string): string {
    return paymentStatus === 'PAID' ? 'badge-paid' : 'badge-pending-pay';
  }

  getPaymentLabel(r: Reservation): string {
    const method = r.payment_method === 'PAYPAL' ? 'PayPal' : 'Efectivo';
    return r.payment_status === 'PAID' ? `Pagado (${method})` : `Pendiente (${method})`;
  }
}
