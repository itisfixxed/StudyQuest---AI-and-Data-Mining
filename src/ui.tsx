import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  Activity, ArrowDownToLine, ArrowUpFromLine, BadgeCheck, Binary, Blocks, BookOpen, Bookmark, CalendarDays, ChartNoAxesCombined,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, Clock3, Cpu, Crosshair, Fingerprint, Flag,
  Flame, Globe2, GraduationCap, Hexagon, History, House, KeyRound, Layers3, Lightbulb, LockKeyhole, Map, Menu,
  Moon, NotebookPen, Play, Radar, RotateCcw, ScanLine, Search, Settings, Shield, ShieldCheck, Shuffle, Sparkles,
  Sun, Swords, Target, Timer, Trophy, Users, Wallet, X, Zap
} from 'lucide-react';
import katex from 'katex';
import type { Source } from './types.ts';

const glyphs = {
  activity: Activity, upload: ArrowUpFromLine, download: ArrowDownToLine, badge: BadgeCheck, binary: Binary, blocks: Blocks,
  book: BookOpen, bookmark: Bookmark, calendar: CalendarDays, chart: ChartNoAxesCombined, check: Check, chevron: ChevronRight,
  chevronDown: ChevronDown, back: ChevronLeft, help: CircleHelp, clipboard: ClipboardList, clock: Clock3, cpu: Cpu, crosshair: Crosshair,
  fingerprint: Fingerprint, flag: Flag, flame: Flame, globe: Globe2, grad: GraduationCap, hex: Hexagon, history: History, home: House,
  key: KeyRound, layers: Layers3, bulb: Lightbulb, lock: LockKeyhole, map: Map, menu: Menu, moon: Moon, notebook: NotebookPen,
  play: Play, radar: Radar, reset: RotateCcw, scan: ScanLine, search: Search, settings: Settings, shield: Shield, shieldCheck: ShieldCheck,
  shuffle: Shuffle, sparkles: Sparkles, sun: Sun, swords: Swords, target: Target, timer: Timer, trophy: Trophy, users: Users,
  wallet: Wallet, close: X, bolt: Zap
};
export function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  const Component = glyphs[name as keyof typeof glyphs] ?? Shield;
  return <Component aria-hidden="true" size={size} strokeWidth={1.9} className={className} />;
}
export function Bubble({ icon, color = 'indigo', large = false }: { icon: string; color?: string; large?: boolean }) {
  return <span className={'bubble ' + color + (large ? ' large' : '')}><Icon name={icon} size={large ? 24 : 20} /></span>;
}
export function ProgressBar({ value, label, color = 'indigo' }: { value: number; label: string; color?: string }) {
  const normalized = Math.max(0, Math.min(100, value));
  return <div className={'progress ' + color} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(normalized)}>
    <span style={{ width: normalized + '%' }} />
  </div>;
}
export function Ring({ value, caption, color = '', display }: { value: number; caption: string; color?: string; display?: string }) {
  const text = display ?? value + '%';
  return <div className={'ring ' + color} aria-label={caption + ' ' + text} style={{ '--ring-value': value + '%' } as CSSProperties}>
    <div className="ring-center"><strong>{text}</strong><small>{caption}</small></div>
  </div>;
}
export function Pill({ children, color = '' }: { children: ReactNode; color?: string }) {
  return <span className={'pill ' + color}>{children}</span>;
}
export function Empty({ icon, title, children, action }: { icon: string; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="panel empty"><Bubble icon={icon} large /><h2>{title}</h2><p>{children}</p>{action}</div>;
}
export function PageTitle({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="page-title"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
export function SectionTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="section-title"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>;
}
export function MathBlock({ expression }: { expression: string }) {
  const math = katex.renderToString(expression, { throwOnError: false, displayMode: true, trust: false, output: 'htmlAndMathml' });
  return <div className="math-block" dangerouslySetInnerHTML={{ __html: math }} />;
}
export function SourceNote({ source }: { source: Source }) {
  return <span className="source-note"><Icon name="book" size={14} />{[source.year && (source.year + (source.semester ? " Semester " + source.semester : "")), source.question && 'Q' + source.question, source.file, source.page && (typeof source.page === "string" && /[–,]/.test(source.page) ? "pp. " : "p. ") + source.page].filter(Boolean).join(' · ')}</span>;
}
export function formatDate(date: string) {
  return date ? new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(date + 'T12:00:00')) : 'Set exam date';
}
export function elapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return [minutes, seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
}
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog className="modal" ref={dialog} onCancel={event => { event.preventDefault(); onClose(); }} aria-label={title}>
    <div className="row spread"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </dialog>;
}

