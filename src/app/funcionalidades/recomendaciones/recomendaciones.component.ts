import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RecommendationResponse } from '../../nucleo/modelos/recomendacion.model';
import { RecomendacionService } from '../../nucleo/servicios/recomendacion.service';

@Component({
  selector: 'app-recommendations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './recomendaciones.component.html',
  styleUrls: ['./recomendaciones.component.css'],
})
export class RecomendacionesComponent {
  message = '';
  response = signal<RecommendationResponse | null>(null);
  loading = signal(false);
  error = signal('');

  constructor(private recommendationService: RecomendacionService) {}

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
