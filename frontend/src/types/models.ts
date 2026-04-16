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

// Human-in-the-loop review queue
export type PendingActionType =
  | 'exam_generation'
  | 'orientation_report'
  | 'iep_report'
  | 'content_adaptation';

export type PendingActionStatus = 'pending' | 'approved' | 'rejected' | 'modified';

export interface PendingAction {
  id: string;
  action_type: PendingActionType;
  student_id: string | null;
  teacher_id: string;
  content_id: string | null;
  payload: Record<string, unknown>;
  original_payload: Record<string, unknown> | null;
  status: PendingActionStatus;
  reviewer_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  student_name?: string | null;
  student_email?: string | null;
  content_title?: string | null;
}
