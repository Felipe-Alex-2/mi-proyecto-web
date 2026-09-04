import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Season, SeasonCreate, SeasonUpdate } from '../models/season.model';

@Injectable({
  providedIn: 'root',
})
export class SeasonService {
  private readonly baseUrl = `${environment.apiUrl}/seasons`;

  constructor(private http: HttpClient) {}

  getSeasons(isActive?: boolean): Observable<Season[]> {
    let params = new HttpParams();
    if (isActive !== undefined && isActive !== null) {
      params = params.set('is_active', isActive.toString());
    }
    return this.http.get<Season[]>(this.baseUrl, { params });
  }

  getSeasonById(id: string): Observable<Season> {
    return this.http.get<Season>(`${this.baseUrl}/${id}`);
  }

  createSeason(payload: SeasonCreate): Observable<Season> {
    return this.http.post<Season>(this.baseUrl, payload);
  }

  updateSeason(id: string, payload: SeasonUpdate): Observable<Season> {
    return this.http.put<Season>(`${this.baseUrl}/${id}`, payload);
  }

  toggleSeasonStatus(id: string): Observable<Season> {
    return this.http.patch<Season>(`${this.baseUrl}/${id}/toggle-status`, {});
  }
}
