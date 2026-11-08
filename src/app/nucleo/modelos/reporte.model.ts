export interface ReportRequest {
  all_companies?: boolean;
  email_to?: string;
  email_self?: boolean;
  report_type: string;
  branch_id?: string;
  category_id?: string;
  season_id?: string;
  supplier_id?: string;
  status?: string;
  search?: string;
  low_stock_threshold?: number;
  date_from?: string;
  date_to?: string;
}

export interface ReportResponse {
  report_id?: string;
  narration?: string;
  email_status?: string;
  email_message?: string;
  report_type: string;
  title: string;
  generated_by: string;
  summary: Record<string, string | number>;
  columns: string[];
  rows: Record<string, string | number | null>[];
}

export interface VoiceReportResponse {
  transcript: string;
  interpretation: ReportRequest;
  report: ReportResponse;
}
