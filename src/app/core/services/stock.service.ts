import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BranchInventoryItem,
  StockAdjustRequest,
  StockResponse,
} from '../models/stock.model';

@Injectable({
  providedIn: 'root',
})
export class StockService {
  private readonly baseUrl = `${environment.apiUrl}/stocks`;

  constructor(private http: HttpClient) {}

  getBranchInventory(
    branchId: string,
    search?: string,
    lowStockOnly?: boolean
  ): Observable<BranchInventoryItem[]> {
    let params = new HttpParams();
    if (search) {
      params = params.set('search', search);
    }
    if (lowStockOnly) {
      params = params.set('low_stock_only', 'true');
    }
    return this.http.get<BranchInventoryItem[]>(
      `${this.baseUrl}/branch/${branchId}`,
      { params }
    );
  }

  adjustStock(payload: StockAdjustRequest): Observable<StockResponse> {
    return this.http.post<StockResponse>(`${this.baseUrl}/adjust`, payload);
  }
}
