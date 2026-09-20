import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RecommendationResponse } from '../../core/models/recommendation.model';
import { RecommendationService } from '../../core/services/recommendation.service';

@Component({
  selector: 'app-recommendations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './recommendations.component.html',
  styleUrls: ['./recommendations.component.css'],
})
export class RecommendationsComponent {
  message = '';
  response = signal<RecommendationResponse | null>(null);
  loading = signal(false);
  error = signal('');

  constructor(private recommendationService: RecommendationService) {}

  askAssistant(): void {
    const text = this.message.trim();
    if (!text) return;
    this.loading.set(true);
    this.error.set('');
    this.recommendationService.recommend(text).subscribe({
      next: (result) => {
        this.response.set(result);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.detail || 'No se pudo consultar al asistente.');
        this.loading.set(false);
      },
    });
  }

  useExample(example: string): void {
    this.message = example;
    this.askAssistant();
  }
}
