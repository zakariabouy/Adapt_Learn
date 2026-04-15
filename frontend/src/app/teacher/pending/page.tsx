'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, X as RejectIcon, Pencil, Clock, FileText, Compass, GraduationCap, Bot } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { PendingAction, PendingActionStatus, PendingActionType } from '@/types/models';

// ─── Helpers ────────────────────────────────────────────────────────────────

const ACTION_META: Record<PendingActionType, { label: string; icon: React.ReactNode; blurb: string }> = {
  exam_generation: {
    label: 'Examination',
    icon: <GraduationCap size={16} strokeWidth={1.5} />,
    blurb: 'An AI-composed assessment awaits your editorial approval.',
  },
  orientation_report: {
    label: 'Orientation',
    icon: <Compass size={16} strokeWidth={1.5} />,
    blurb: 'A long-form advisory report destined for the student\'s guardians.',
  },
  iep_report: {
    label: 'Individualised Plan',
    icon: <FileText size={16} strokeWidth={1.5} />,
    blurb: 'A weekly learning plan drafted overnight by the scheduler.',
  },
  content_adaptation: {
    label: 'Adaptation',
    icon: <FileText size={16} strokeWidth={1.5} />,
    blurb: 'A content rewrite proposed by the adaptation agent.',
  },
};

const STATUS_META: Record<PendingActionStatus, { label: string; className: string }> = {
  pending:  { label: 'Awaiting review', className: 'ed-chip-pending' },
  approved: { label: 'Approved',        className: 'ed-chip-approved' },
  rejected: { label: 'Rejected',        className: 'ed-chip-rejected' },
  modified: { label: 'Edited',          className: 'ed-chip-modified' },
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'moments ago';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatVolume(n: number | undefined): string {
  if (n === undefined || n === null) return '00';
  return String(n).padStart(2, '0');
}

// ─── Payload renderers ──────────────────────────────────────────────────────

function ExamPreview({ payload }: { payload: Record<string, unknown> }) {
  const exam = (payload.exam ?? {}) as Record<string, unknown>;
  const title = String(exam.title ?? payload.content_title ?? 'Untitled Exam');
  const subject = String(exam.subject ?? '—');
  const gradeLevel = Number(exam.grade_level ?? payload.grade_level ?? 0);
  const duration = Number(exam.duration_minutes ?? 0);
  const totalPoints = Number(exam.total_points ?? 0);
  const instructions = String(exam.instructions ?? '');
  const questions = Array.isArray(exam.questions) ? exam.questions : [];

  return (
    <article className="space-y-10">
      <header className="space-y-6">
        <div className="flex items-baseline justify-between gap-6">
          <p className="ed-small-caps text-xs" style={{ color: 'var(--ed-ink-faint)' }}>
            Examination · Grade {gradeLevel} · {subject}
          </p>
          <p className="ed-small-caps text-xs tabular-nums" style={{ color: 'var(--ed-ink-faint)' }}>
            {duration} min · {totalPoints} pts
          </p>
        </div>
        <h2 className="ed-display text-5xl leading-[0.95]" style={{ color: 'var(--ed-ink)' }}>{title}</h2>
        <hr className="ed-rule" />
      </header>

      {instructions && (
        <p className="ed-drop-cap text-lg leading-relaxed" style={{ color: 'var(--ed-ink-muted)' }}>
          {instructions}
        </p>
      )}

      <ol className="space-y-8" style={{ listStyle: 'none', padding: 0 }}>
        {questions.map((q, i) => {
          const question = q as Record<string, unknown>;
          const num = Number(question.question_number ?? i + 1);
          const text = String(question.text ?? '');
          const type = String(question.question_type ?? 'mcq');
          const options = Array.isArray(question.options) ? question.options : [];
          const correctAnswer = String(question.correct_answer ?? '');
          const explanation = String(question.explanation ?? '');
          const topic = String(question.topic ?? '');
          const difficulty = Number(question.difficulty ?? 0);

          return (
            <li key={i} className="relative pl-16">
              <div
                className="absolute left-0 top-0 ed-display text-4xl tabular-nums"
                style={{ color: 'var(--ed-vermilion)' }}
              >
                {formatVolume(num)}
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3 ed-small-caps text-[0.7rem]" style={{ color: 'var(--ed-ink-faint)' }}>
                  <span>{type === 'mcq' ? 'Multiple choice' : 'Open response'}</span>
                  {topic && <><span>·</span><span>{topic}</span></>}
                  <span>·</span>
                  <span className="tabular-nums">θ {difficulty.toFixed(2)}</span>
                </div>
                <p className="text-lg leading-relaxed" style={{ color: 'var(--ed-ink)' }}>{text}</p>

                {type === 'mcq' && options.length > 0 && (
                  <ul className="space-y-2 pl-4" style={{ listStyle: 'none' }}>
                    {options.map((opt, oi) => {
                      const o = opt as Record<string, unknown>;
                      const id = String(o.id ?? oi);
                      const label = String(o.label ?? o.text ?? '');
                      const isCorrect = id === correctAnswer;
                      return (
                        <li
                          key={oi}
                          className="flex items-start gap-3 text-base"
                          style={{ color: isCorrect ? 'var(--ed-sage)' : 'var(--ed-ink-muted)' }}
                        >
                          <span className="ed-display tabular-nums w-5 shrink-0">
                            {String.fromCharCode(97 + oi)}.
                          </span>
                          <span className={isCorrect ? 'ed-underline font-medium' : ''}>{label}</span>
                          {isCorrect && <span className="ed-small-caps text-[0.65rem] ml-2">Key</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {type !== 'mcq' && correctAnswer && (
                  <div className="pl-4 border-l-2 space-y-1" style={{ borderColor: 'var(--ed-sage)' }}>
                    <p className="ed-small-caps text-[0.65rem]" style={{ color: 'var(--ed-sage)' }}>Model answer</p>
                    <p className="italic" style={{ color: 'var(--ed-ink-muted)' }}>{correctAnswer}</p>
                  </div>
                )}

                {explanation && (
                  <p className="text-sm italic pl-4" style={{ color: 'var(--ed-ink-faint)' }}>
                    — {explanation}
                  </p>
                )}
              </div>
              {i < questions.length - 1 && <hr className="ed-rule-dotted mt-8" />}
            </li>
          );
        })}
      </ol>
    </article>
  );
}

function OrientationPreview({ payload }: { payload: Record<string, unknown> }) {
  const report = (payload.report ?? payload) as Record<string, unknown>;
  const asString = (v: unknown) => (v == null ? '' : String(v));

  const sections: { label: string; body: string }[] = [];
  const pushIf = (label: string, key: string) => {
    const val = report[key];
    if (val != null && String(val).trim()) sections.push({ label, body: asString(val) });
  };

  pushIf('Strengths observed', 'strengths');
  pushIf('Areas for growth', 'areas_for_growth');
  pushIf('Recommended path', 'recommended_path');
  pushIf('Guardian notes', 'parent_notes');
  pushIf('Narrative', 'narrative');
  pushIf('Summary', 'summary');

  // Fallback: dump all string fields if none of the known keys exist.
  if (sections.length === 0) {
    Object.entries(report).forEach(([k, v]) => {
      if (typeof v === 'string' && v.trim()) {
        sections.push({ label: k.replace(/_/g, ' '), body: v });
      }
    });
  }

  const title = asString(report.title ?? 'Orientation Advisory');

  return (
    <article className="space-y-10">
      <header className="space-y-6">
        <p className="ed-small-caps text-xs" style={{ color: 'var(--ed-ink-faint)' }}>
          Orientation Report · For the student's guardians
        </p>
        <h2 className="ed-display text-5xl leading-[0.95]" style={{ color: 'var(--ed-ink)' }}>{title}</h2>
        <hr className="ed-rule" />
      </header>

      {sections.length > 0 ? (
        sections.map((s, i) => (
          <section key={i} className="space-y-3">
            <h3 className="ed-small-caps text-xs" style={{ color: 'var(--ed-vermilion)' }}>{s.label}</h3>
            <p className={i === 0 ? 'ed-drop-cap text-lg leading-relaxed' : 'text-base leading-relaxed'} style={{ color: 'var(--ed-ink-muted)' }}>
              {s.body}
            </p>
            {i < sections.length - 1 && <hr className="ed-rule-dotted mt-6" />}
          </section>
        ))
      ) : (
        <pre className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--ed-ink-muted)', fontFamily: 'var(--font-ibm-plex-sans)' }}>
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
    </article>
  );
}

function IEPPreview({ payload }: { payload: Record<string, unknown> }) {
  const markdown = String(payload.markdown ?? '');
  const autoGenerated = Boolean(payload.auto_generated);

  return (
    <article className="space-y-8">
      <header className="space-y-6">
        <div className="flex items-center gap-3">
          <p className="ed-small-caps text-xs" style={{ color: 'var(--ed-ink-faint)' }}>
            Individualised Education Plan
          </p>
          {autoGenerated && (
            <span className="inline-flex items-center gap-1.5 ed-small-caps text-[0.65rem] px-2 py-0.5" style={{ background: 'var(--ed-amber-soft)', color: 'var(--ed-amber)' }}>
              <Bot size={10} /> Scheduler draft
            </span>
          )}
        </div>
        <h2 className="ed-display text-5xl leading-[0.95]" style={{ color: 'var(--ed-ink)' }}>Weekly Learning Plan</h2>
        <hr className="ed-rule" />
      </header>

      <div
        className="text-base leading-relaxed space-y-4"
        style={{ color: 'var(--ed-ink-muted)' }}
      >
        {markdown.split('\n').map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={i} className="h-2" />;
          if (trimmed.startsWith('### ')) {
            return <h4 key={i} className="ed-small-caps text-xs pt-4" style={{ color: 'var(--ed-vermilion)' }}>{trimmed.slice(4)}</h4>;
          }
          if (trimmed.startsWith('## ')) {
            return <h3 key={i} className="ed-display text-2xl pt-6" style={{ color: 'var(--ed-ink)' }}>{trimmed.slice(3)}</h3>;
          }
          if (trimmed.startsWith('# ')) {
            return <h2 key={i} className="ed-display text-3xl pt-8" style={{ color: 'var(--ed-ink)' }}>{trimmed.slice(2)}</h2>;
          }
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return <p key={i} className="pl-6 relative"><span className="absolute left-2" style={{ color: 'var(--ed-vermilion)' }}>·</span>{trimmed.slice(2)}</p>;
          }
          return <p key={i}>{trimmed}</p>;
        })}
      </div>
    </article>
  );
}

function PayloadPreview({ action }: { action: PendingAction }) {
  switch (action.action_type) {
    case 'exam_generation':     return <ExamPreview payload={action.payload} />;
    case 'orientation_report':  return <OrientationPreview payload={action.payload} />;
    case 'iep_report':          return <IEPPreview payload={action.payload} />;
    default:
      return (
        <pre className="whitespace-pre-wrap text-sm" style={{ color: 'var(--ed-ink-muted)' }}>
          {JSON.stringify(action.payload, null, 2)}
        </pre>
      );
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | PendingActionStatus;
type TypeFilter = 'all' | PendingActionType;

export default function PendingReviewPage() {
  const router = useRouter();
  const [items, setItems] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingJson, setEditingJson] = useState(false);
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchItems = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    try {
      const res = await axios.get<PendingAction[]>(`${API_URL}/teacher/pending`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 100 },
      });
      setItems(res.data);
      if (!selectedId && res.data.length > 0) setSelectedId(res.data[0].id);
    } catch (err) {
      console.error('Failed to load pending actions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (statusFilter !== 'all' && it.status !== statusFilter) return false;
      if (typeFilter !== 'all' && it.action_type !== typeFilter) return false;
      return true;
    });
  }, [items, statusFilter, typeFilter]);

  const selected = useMemo(
    () => filtered.find((it) => it.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  );

  useEffect(() => {
    setNotes(selected?.reviewer_notes ?? '');
    setEditingJson(false);
    setJsonError(null);
    if (selected) setJsonDraft(JSON.stringify(selected.payload, null, 2));
  }, [selected?.id]);

  const pendingCount = items.filter((i) => i.status === 'pending').length;

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const doAction = async (
    verb: 'approve' | 'reject' | 'modify',
    body?: Record<string, unknown>
  ) => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post<PendingAction>(
        `${API_URL}/teacher/pending/${selected.id}/${verb}`,
        body ?? { reviewer_notes: notes || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setItems((prev) => prev.map((it) => (it.id === selected.id ? res.data : it)));
      flash(
        verb === 'approve' ? 'Signed and approved.' :
        verb === 'reject'  ? 'Returned with notes.' :
        'Edits committed.'
      );
      if (verb === 'modify') setEditingJson(false);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      const detail = axiosErr.response?.data?.detail ?? 'Action failed.';
      flash(detail);
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = () => doAction('approve', { reviewer_notes: notes || null });
  const handleReject = () => {
    if (!notes.trim()) {
      flash('A rejection requires a note.');
      return;
    }
    doAction('reject', { reviewer_notes: notes });
  };
  const handleStartEdit = () => {
    if (!selected) return;
    setJsonDraft(JSON.stringify(selected.payload, null, 2));
    setEditingJson(true);
    setJsonError(null);
  };
  const handleCommitEdit = () => {
    try {
      const parsed = JSON.parse(jsonDraft);
      doAction('modify', { payload: parsed, reviewer_notes: notes || null });
    } catch {
      setJsonError('Invalid JSON — check your syntax.');
    }
  };

  return (
    <div className="editorial-scope ed-grain min-h-screen relative">
      {/* Top bar — oversized masthead */}
      <header className="px-10 lg:px-16 pt-10 pb-8">
        <div className="flex items-center justify-between mb-10">
          <button
            onClick={() => router.push('/teacher/dashboard')}
            className="flex items-center gap-2 ed-small-caps text-xs ed-underline"
            style={{ color: 'var(--ed-ink-muted)' }}
          >
            <ArrowLeft size={14} /> Return to dashboard
          </button>
          <div className="flex items-center gap-3 ed-small-caps text-[0.65rem]" style={{ color: 'var(--ed-ink-faint)' }}>
            <span>Vol. I</span>
            <span>·</span>
            <span>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>

        <div className="flex items-end justify-between gap-12 flex-wrap">
          <div>
            <p className="ed-small-caps text-xs mb-3" style={{ color: 'var(--ed-vermilion)' }}>
              The review desk
            </p>
            <h1 className="ed-display text-[4.5rem] leading-[0.88] tracking-tight max-w-3xl" style={{ color: 'var(--ed-ink)' }}>
              Decisions the agent<br />would rather you made.
            </h1>
          </div>
          <div className="text-right space-y-1">
            <div className="ed-display text-7xl tabular-nums leading-none" style={{ color: pendingCount > 0 ? 'var(--ed-vermilion)' : 'var(--ed-ink-faint)' }}>
              {formatVolume(pendingCount)}
            </div>
            <p className="ed-small-caps text-xs" style={{ color: 'var(--ed-ink-faint)' }}>
              Awaiting the editor
            </p>
          </div>
        </div>

        <hr className="ed-rule mt-10" style={{ borderTopWidth: '2px' }} />
      </header>

      {/* Filters */}
      <div className="px-10 lg:px-16 py-5 flex items-center gap-8 flex-wrap">
        <div className="flex items-center gap-5 ed-small-caps text-[0.7rem]">
          <span style={{ color: 'var(--ed-ink-faint)' }}>Status:</span>
          {(['pending', 'approved', 'rejected', 'modified', 'all'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={statusFilter === s ? 'ed-underline' : ''}
              style={{ color: statusFilter === s ? 'var(--ed-ink)' : 'var(--ed-ink-faint)' }}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-5 ed-small-caps text-[0.7rem]">
          <span style={{ color: 'var(--ed-ink-faint)' }}>Kind:</span>
          {(['all', 'exam_generation', 'orientation_report', 'iep_report'] as TypeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={typeFilter === t ? 'ed-underline' : ''}
              style={{ color: typeFilter === t ? 'var(--ed-ink)' : 'var(--ed-ink-faint)' }}
            >
              {t === 'all' ? 'all' : ACTION_META[t as PendingActionType]?.label ?? t}
            </button>
          ))}
        </div>
      </div>

      <hr className="ed-hairline" />

      {/* Body: asymmetric split */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr] min-h-[70vh]">
        {/* Left rail — list of pending items */}
        <aside className="border-r px-6 py-8" style={{ borderColor: 'var(--ed-rule-faint)' }}>
          {loading ? (
            <p className="ed-small-caps text-xs" style={{ color: 'var(--ed-ink-faint)' }}>Fetching the queue…</p>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <p className="ed-display text-2xl" style={{ color: 'var(--ed-ink-muted)' }}>The desk is clear.</p>
              <p className="text-sm" style={{ color: 'var(--ed-ink-faint)' }}>No items match these filters.</p>
            </div>
          ) : (
            <ul className="space-y-1" style={{ listStyle: 'none', padding: 0 }}>
              <AnimatePresence initial={false}>
                {filtered.map((it, i) => {
                  const meta = ACTION_META[it.action_type];
                  const isActive = selected?.id === it.id;
                  return (
                    <motion.li
                      key={it.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.35 }}
                    >
                      <button
                        onClick={() => setSelectedId(it.id)}
                        className="w-full text-left px-4 py-4 transition-colors"
                        style={{
                          background: isActive ? 'var(--ed-paper-raised)' : 'transparent',
                          borderLeft: isActive ? '2px solid var(--ed-vermilion)' : '2px solid transparent',
                        }}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="ed-small-caps text-[0.65rem] flex items-center gap-1.5" style={{ color: 'var(--ed-ink-faint)' }}>
                            {meta.icon}
                            {meta.label}
                          </span>
                          <span className="text-[0.65rem] tabular-nums" style={{ color: 'var(--ed-ink-faint)' }}>
                            {relativeTime(it.created_at)}
                          </span>
                        </div>
                        <div className="ed-display text-xl leading-tight mb-2" style={{ color: 'var(--ed-ink)' }}>
                          {it.student_name ?? it.student_email?.split('@')[0] ?? 'Unknown student'}
                        </div>
                        {it.content_title && (
                          <p className="text-xs italic mb-3" style={{ color: 'var(--ed-ink-muted)' }}>
                            “{it.content_title}”
                          </p>
                        )}
                        <span className={`inline-block px-2 py-0.5 ed-small-caps text-[0.6rem] ${STATUS_META[it.status].className}`}>
                          {STATUS_META[it.status].label}
                        </span>
                      </button>
                      {i < filtered.length - 1 && <hr className="ed-rule-dotted my-1" />}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </aside>

        {/* Right — the artifact */}
        <section className="px-10 lg:px-16 py-12">
          {!selected ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3 max-w-md">
                <Clock size={32} strokeWidth={1} style={{ color: 'var(--ed-ink-faint)' }} className="mx-auto" />
                <p className="ed-display text-3xl" style={{ color: 'var(--ed-ink-muted)' }}>Nothing to review just now.</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ed-ink-faint)' }}>
                  When an agent drafts an exam, orientation report, or weekly plan, it will appear here for your editorial approval.
                </p>
              </div>
            </div>
          ) : (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
              className="max-w-3xl mx-auto space-y-12"
            >
              {/* Byline */}
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div>
                  <p className="ed-small-caps text-[0.7rem] mb-2" style={{ color: 'var(--ed-ink-faint)' }}>
                    Drafted by the AI agent · Filed {relativeTime(selected.created_at)}
                  </p>
                  <p className="ed-display italic text-lg" style={{ color: 'var(--ed-ink-muted)' }}>
                    On behalf of{' '}
                    <span className="not-italic font-semibold" style={{ color: 'var(--ed-ink)' }}>
                      {selected.student_name ?? 'a student'}
                    </span>
                  </p>
                </div>
                <span className={`inline-block px-3 py-1 ed-small-caps text-[0.65rem] ${STATUS_META[selected.status].className}`}>
                  {STATUS_META[selected.status].label}
                </span>
              </div>

              {/* Preview OR JSON editor */}
              {editingJson ? (
                <div className="space-y-3">
                  <p className="ed-small-caps text-xs" style={{ color: 'var(--ed-vermilion)' }}>Editing payload</p>
                  <textarea
                    value={jsonDraft}
                    onChange={(e) => { setJsonDraft(e.target.value); setJsonError(null); }}
                    spellCheck={false}
                    className="w-full min-h-[500px] p-5 font-mono text-sm leading-relaxed"
                    style={{
                      background: 'var(--ed-paper-raised)',
                      color: 'var(--ed-ink)',
                      border: `1px solid ${jsonError ? 'var(--ed-vermilion)' : 'var(--ed-rule)'}`,
                      outline: 'none',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    }}
                  />
                  {jsonError && (
                    <p className="text-xs italic" style={{ color: 'var(--ed-vermilion)' }}>{jsonError}</p>
                  )}
                  <div className="flex gap-4">
                    <button
                      onClick={handleCommitEdit}
                      disabled={busy}
                      className="ed-btn-edit ed-small-caps text-xs px-3 py-1.5"
                    >
                      Commit edits
                    </button>
                    <button
                      onClick={() => setEditingJson(false)}
                      className="ed-small-caps text-xs"
                      style={{ color: 'var(--ed-ink-faint)' }}
                    >
                      cancel
                    </button>
                  </div>
                </div>
              ) : (
                <PayloadPreview action={selected} />
              )}

              <hr className="ed-rule" />

              {/* Reviewer notes */}
              <div className="space-y-3">
                <p className="ed-small-caps text-xs" style={{ color: 'var(--ed-ink-faint)' }}>Marginalia</p>
                <textarea
                  className="ed-notes"
                  rows={3}
                  placeholder="Write a note in the margin…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Action bar */}
              {selected.status === 'pending' || selected.status === 'modified' ? (
                <div className="flex items-center gap-8 flex-wrap pt-4">
                  <button
                    disabled={busy}
                    onClick={handleApprove}
                    className="ed-btn-approve ed-small-caps text-xs px-3 py-2 flex items-center gap-2"
                  >
                    <Check size={14} /> Sign &amp; approve
                  </button>
                  {!editingJson && selected.status === 'pending' && (
                    <button
                      disabled={busy}
                      onClick={handleStartEdit}
                      className="ed-btn-edit ed-small-caps text-xs px-3 py-2 flex items-center gap-2"
                    >
                      <Pencil size={14} /> Edit the draft
                    </button>
                  )}
                  {selected.status === 'pending' && (
                    <button
                      disabled={busy}
                      onClick={handleReject}
                      className="ed-btn-reject ed-small-caps text-xs px-3 py-2 flex items-center gap-2"
                    >
                      <RejectIcon size={14} /> Return with notes
                    </button>
                  )}
                </div>
              ) : (
                <div className="pt-4">
                  <p className="ed-small-caps text-[0.7rem]" style={{ color: 'var(--ed-ink-faint)' }}>
                    Reviewed {selected.reviewed_at ? relativeTime(selected.reviewed_at) : '—'}
                  </p>
                </div>
              )}

              {/* Audit trail */}
              {selected.original_payload && (
                <details className="pt-6 border-t" style={{ borderColor: 'var(--ed-rule-faint)' }}>
                  <summary className="ed-small-caps text-[0.7rem] cursor-pointer ed-underline inline-block" style={{ color: 'var(--ed-ink-faint)' }}>
                    Show original AI draft
                  </summary>
                  <pre className="mt-4 p-4 text-xs leading-relaxed overflow-x-auto" style={{ background: 'var(--ed-paper-sunken)', color: 'var(--ed-ink-muted)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    {JSON.stringify(selected.original_payload, null, 2)}
                  </pre>
                </details>
              )}
            </motion.div>
          )}
        </section>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-3 ed-small-caps text-xs z-50"
            style={{ background: 'var(--ed-ink)', color: 'var(--ed-paper)' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
