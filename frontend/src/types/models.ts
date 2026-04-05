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
  action: 'simplify_content' | 'switch_modality' | 'summarize_chunk' | 'no_action' | string;
  data?: Record<string, string | number | boolean> | null;
  reason?: string | null;
}

export interface CssConfig {
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: string;
}
