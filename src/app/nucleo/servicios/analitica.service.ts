import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface SyntheticParameters {
  request_id: string;
  name: string;
  date_from: string;
  date_to: string;
  customers: number;
  products: number;
  sales: number;
  seed: number;
}
export interface SyntheticDataset {
  id: string;
  tenant_id: string;
  name: string;
  created_at: string;
  status: string;
  parameters: SyntheticParameters;
  summary: {
    customers: number;
    customers_with_purchases: number;
    products: number;
    sales: number;
    returns: number;
    injected_anomalies: number;
    discarded_rows: number;
    weeks: number;
    demand_train: number;
    demand_test: number;
    preprocessing: string;
    assumptions: string[];
    branches: string[];
    categories: string[];
  };
}
export interface ModelRun {
  id: string;
  tenant_id: string;
  dataset_id: string;
  status: 'TRAINING' | 'COMPLETED' | 'FAILED';
  created_at: string;
  completed_at: string | null;
  error: string | null;
  artifact_sha256: string | null;
  parameters: { request_id: string; dataset_id: string; clusters: number };
  metrics: {
    source?: string;
    sklearn_version?: string;
    limitation?: string;
    demand?: {
      mae: number | null;
      rmse: number | null;
      r2: number | null;
      baseline_mae: number | null;
      train_rows: number;
      test_rows: number;
      train_until: string;
      test_from: string;
    };
    clustering?: {
      silhouette: number | null;
      train_silhouette: number | null;
      clusters: number;
      train_rows: number;
      test_rows: number;
    };
    anomalies?: {
      precision: number;
      recall: number;
      f1: number;
      detected: number;
      test_detected: number;
      test_injected: number;
    };
  };
  results?: {
    groups: {
      cluster: number;
      name: string;
      customers: number;
      recency_days: number | null;
      frequency: number | null;
      monetary: number | null;
    }[];
    anomalies: {
      sale_id: string;
      date: string;
      category: string;
      branch: string;
      quantity: number;
      amount: number;
      returned_quantity: number;
      score: number;
      split: string;
    }[];
    forecasts: { week: string; category: string; branch: string; predicted_units: number }[];
    comparisons: {
      week: string;
      category: string;
      branch: string;
      actual: number;
      predicted: number;
    }[];
  };
}

@Injectable({ providedIn: 'root' })
export class AnaliticaService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/analytics`;
  private params(tenant: string) {
    return tenant ? new HttpParams().set('tenant_id', tenant) : new HttpParams();
  }
  generate(tenant: string, payload: SyntheticParameters) {
    return this.http.post<SyntheticDataset>(
      `${environment.apiUrl}/saas/companies/${encodeURIComponent(tenant)}/synthetic-data`,
      payload,
    );
  }
  datasets(tenant = '') {
    return this.http.get<SyntheticDataset[]>(`${this.url}/datasets`, {
      params: this.params(tenant),
    });
  }
  runs(tenant = '') {
    return this.http.get<ModelRun[]>(`${this.url}/runs`, { params: this.params(tenant) });
  }
  train(tenant: string, payload: { request_id: string; dataset_id: string; clusters: number }) {
    return this.http.post<ModelRun>(`${this.url}/train`, payload, { params: this.params(tenant) });
  }
  detail(id: string, tenant = '') {
    return this.http.get<ModelRun>(`${this.url}/runs/${id}`, { params: this.params(tenant) });
  }
  download(id: string, tenant = '') {
    return this.http.get(`${this.url}/datasets/${id}/download`, {
      params: this.params(tenant),
      responseType: 'blob',
    });
  }
}
