import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ReportRequest, ReportResponse, VoiceReportResponse } from '../models/report.model';

@Injectable({
  providedIn: 'root',
})
export class ReportService {
  private readonly baseUrl = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) {}

  generate(request: ReportRequest): Observable<ReportResponse> {
    return this.http.post<ReportResponse>(`${this.baseUrl}/generate`, request);
  }

  generateFromVoice(transcript: string): Observable<VoiceReportResponse> {
    return this.http.post<VoiceReportResponse>(`${this.baseUrl}/voice`, { transcript });
  }
}
