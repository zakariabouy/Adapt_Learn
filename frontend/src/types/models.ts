export interface TelemetryEvent {
  studentId: string;
  timestamp: number;
  scrollVelocity: number;
  scrollProgress: number;
  clickCount: number;
  tabFocused: boolean;
  timeOnPage: number;
  event_type: string;
  responseLatency?: number | null;
}

export interface AdaptationCommand {
  action: string;
  data?: Record<string, any> | null;
  reason?: string | null;
}
