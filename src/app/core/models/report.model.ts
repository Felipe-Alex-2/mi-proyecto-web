export interface ReportRequest {
  report_type: string;
  branch_id?: string;
  category_id?: string;
  season_id?: string;
  supplier_id?: string;
  status?: string;
  search?: string;
  low_stock_threshold?: number;
}

export interface ReportResponse {
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
