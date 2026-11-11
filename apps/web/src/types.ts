export interface User { user_id: string; email: string }
export interface LoginResponse { expires_in: number }
export interface MFAChallenge { mfa_required: true; challenge_token: string; expires_in: number }
export type LoginResult = LoginResponse | MFAChallenge;
export interface MFAStatus { enabled: boolean; available: boolean; recovery_codes_remaining: number }
export interface MFAEnrollment { secret: string; otpauth_uri: string; enrollment_token: string; expires_in: number }
export type ScanKind = 'url' | 'file';
export interface ScanResponse {
  result: {
    malicious?: boolean;
    phishing?: boolean;
    confidence?: number;
    reason?: string;
    vendor_positives?: number;
    total_vendors?: number;
    report_url?: string;
  };
}
export interface ScanData {
  is_malicious: boolean;
  is_phishing: boolean;
  confidence_score: number | null;
  vendor_positives?: number;
  total_vendors?: number;
  details?: string;
  targetUrl?: string;
  filename?: string;
  report_url?: string;
}
export type AnalysisResult = { type: ScanKind; data: ScanData } | { type: 'error'; message: string };
export interface ScanRecord {
  _id?: string | { $oid: string };
  id?: string;
  reportId?: string;
  report_id?: string;
  type?: ScanKind;
  scan_type?: ScanKind;
  target?: string;
  url?: string;
  filename?: string;
  name?: string;
  input?: string;
  created_at?: string;
  createdAt?: string;
  timestamp?: string;
  time?: string;
  date?: string;
  is_malicious?: boolean;
  is_phishing?: boolean;
  result?: { risk_level?: string; malicious?: boolean; phishing?: boolean };
}
export interface HistoryPage { items: ScanRecord[]; next_cursor: string | null }
export interface Report {
  id?: string;
  reportId?: string;
  report_id?: string;
  scanId?: string;
  scan_id?: string;
}
export interface ServiceHealth { name: string; status: 'healthy' | 'unhealthy' | 'unavailable'; message: string }
export const errorMessage = (error: unknown, fallback = 'Something went wrong'): string =>
  error instanceof Error ? error.message : fallback;
export const scanId = (item: ScanRecord): string | undefined =>
  (typeof item._id === 'string' ? item._id : item._id?.$oid) || item.id;
export const historyPage = (data: HistoryPage | ScanRecord[]): HistoryPage =>
  Array.isArray(data) ? { items: data, next_cursor: null } : data;
