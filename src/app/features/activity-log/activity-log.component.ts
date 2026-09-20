import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ActivityLog } from '../../core/models/activity-log.model';
import { ActivityLogService } from '../../core/services/activity-log.service';

@Component({
  selector: 'app-activity-log',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './activity-log.component.html',
  styleUrls: ['./activity-log.component.css'],
})
export class ActivityLogComponent implements OnInit {
  logs = signal<ActivityLog[]>([]);
  total = signal(0);
  loading = signal(true);
  error = signal('');
  page = 1;
  pageSize = 25;
  action = '';
  category = '';
  search = '';

  constructor(private activityLogService: ActivityLogService) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.loading.set(true);
    this.error.set('');
    this.activityLogService.list({
      page: this.page,
      pageSize: this.pageSize,
      action: this.action,
      category: this.category,
      search: this.search.trim(),
    }).subscribe({
      next: (response) => {
        this.logs.set(response.items);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.detail || 'No se pudo cargar la bitácora.');
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadLogs();
  }

  clearFilters(): void {
    this.action = '';
    this.category = '';
    this.search = '';
    this.applyFilters();
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  previousPage(): void {
    if (this.page > 1) {
      this.page -= 1;
      this.loadLogs();
    }
  }

  nextPage(): void {
    if (this.page < this.pageCount) {
      this.page += 1;
      this.loadLogs();
    }
  }
}
