import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  InventoryMovement,
  InventoryMovementCreate,
  BranchInventorySummary,
  VariantBranchAvailability,
  AvailabilityMatrixRow,
} from '../models/inventory.model';

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private readonly inventoryUrl = `${environment.apiUrl}/inventory`;
  private readonly stocksUrl = `${environment.apiUrl}/stocks`;

  constructor(private http: HttpClient) {}

  createMovement(payload: InventoryMovementCreate): Observable<InventoryMovement> {
    return this.http.post<InventoryMovement>(`${this.inventoryUrl}/movements`, payload);
  }

  getMovements(filters?: {
    branch_id?: string;
    type?: string;
    variant_id?: string;
    product_id?: string;
    limit?: number;
    offset?: number;
  }): Observable<InventoryMovement[]> {
    let params = new HttpParams();
    if (filters?.branch_id) params = params.set('branch_id', filters.branch_id);
    if (filters?.type) params = params.set('type', filters.type);
    if (filters?.variant_id) params = params.set('variant_id', filters.variant_id);
    if (filters?.product_id) params = params.set('product_id', filters.product_id);
    if (filters?.limit) params = params.set('limit', filters.limit.toString());
    if (filters?.offset) params = params.set('offset', filters.offset.toString());

    return this.http.get<InventoryMovement[]>(`${this.inventoryUrl}/movements`, { params });
  }

  getMovement(id: string): Observable<InventoryMovement> {
    return this.http.get<InventoryMovement>(`${this.inventoryUrl}/movements/${id}`);
  }

  getBranchSummary(branchId: string): Observable<BranchInventorySummary> {
    return this.http.get<BranchInventorySummary>(`${this.inventoryUrl}/summary/${branchId}`);
  }

  getVariantAvailability(variantId: string): Observable<VariantBranchAvailability[]> {
    return this.http.get<VariantBranchAvailability[]>(`${this.stocksUrl}/variant/${variantId}/availability`);
  }

  getAvailabilityMatrix(productId?: string): Observable<AvailabilityMatrixRow[]> {
    let params = new HttpParams();
    if (productId) params = params.set('product_id', productId);
    return this.http.get<AvailabilityMatrixRow[]>(`${this.stocksUrl}/matrix`, { params });
  }
}
