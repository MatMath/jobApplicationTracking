/** Shape returned by public.dashboard_stats() - see supabase/003_dashboard.sql. */
export type DashboardStats = {
  totals: { applied: number; responded: number; active: number; offers: number };
  weekly: { week_start: string; applications: number }[];
  by_platform: { platform: string; applied: number; responded: number }[];
  by_type: {
    application_type: string;
    applied: number;
    responded: number;
    interviewed: number;
  }[];
  rounds: { applications_with_rounds: number; avg_rounds: number };
};

export function rate(part: number, whole: number): string {
  if (!whole) return '—';
  return `${Math.round((part / whole) * 100)}%`;
}
