import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ReportRequest, ReportResponse, VoiceReportResponse } from '../modelos/reporte.model';

@Injectable({
  providedIn: 'root',
})
export class ReporteService {
  private readonly baseUrl = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) {}

  branches(): Observable<any[]> {return this.http.get<any[]>(`${this.baseUrl}/branches`);}

  generate(request: ReportRequest): Observable<ReportResponse> {
    return this.http.post<ReportResponse>(`${this.baseUrl}/generate`, request);
  }

  generateFromVoice(transcript: string, branchId?: string, allCompanies=true, emailTo?:string): Observable<VoiceReportResponse> {
    return this.http.post<VoiceReportResponse>(`${this.baseUrl}/voice`, { transcript, branch_id: branchId, all_companies:allCompanies, email_to:emailTo });
  }
  email(id:string,emailTo:string) {return this.http.post<ReportResponse>(`${this.baseUrl}/${id}/email`,{email_to:emailTo});}
  pdf(id:string) {return this.http.get(`${this.baseUrl}/${id}/pdf`,{responseType:'blob'});}

}
