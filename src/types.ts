export type Difficulty = 'easy' | 'medium' | 'hard' | 'exam';
export type Kind = 'choice' | 'multi' | 'truefalse' | 'number' | 'expression' | 'blank' | 'short' | 'structured';
export type Answer = string | string[];
export interface Source { file: string; page?: number | string; year?: string; semester?: number; question?: string }
export interface Concept {
  id: string;
  name: string;
  intuition: string;
  formal: string;
  cue: string;
  source: Source;
  formulas: string[];
  pitfall: string;
  example: string;
  check: [prompt: string, correct: string, distractor: string, distractor: string];
  apply: [prompt: string, response: string, criterion: string, criterion: string];
}
export interface Topic {
  id: string; name: string; short: string; icon: string; color: string;
  summary: string; prerequisites: string[]; sources: Source[];
  concepts: Concept[]; difficulty: number; revision: boolean;
}
export interface Reference {
  id: string; title: string; topic: string; expression?: string; parameters?: string;
  purpose: string; assumptions: string; example: string; variation: string; mistake: string;
  recall?: [prompt: string, answer: string]; source: Source;
}
export interface Criterion { text: string; points: number }
export interface Step {
  prompt: string; options?: string[]; answer: string | number;
  why: string; retry: string;
  /** Absolute tolerance for numeric step answers. */
  tolerance?: number;
  /** Extra accepted spellings for text step answers. */
  accept?: string[];
}
/** How much a hint discloses: 1 recall/formula, 2 method/setup, 3 intermediate working, 4 answer plan. 5 is the full solution. */
export type Aid = 1 | 2 | 3 | 4;
export interface HintStep {
  kind: 'concept' | 'formula' | 'calculation' | 'reasoning' | 'assemble';
  title: string;
  /** The hint itself, shown when the level opens. */
  text: string;
  aid: Aid;
  formulas?: string[];
  /** Optional MCQ (options) or typed check on this step. */
  check?: Step;
  /** Worked result for this step, shown after the check passes or on "Show this step". */
  worked?: string;
  /** Disclosure tier of the worked result (defaults to 3). */
  workedAid?: Aid;
}
export interface Guidance {
  recall: string; direction: string; scaffold: Step; walkthrough: Step[];
  /** Variable-length (1-10) step-by-step ladder; questions without one use the legacy four-level flow. */
  ladder?: HintStep[];
}
export interface Question {
  id: string; topic: string; subtopic: string; title: string; prompt: string;
  difficulty: Difficulty; kind: Kind; answer: Answer; options?: string[];
  optionFeedback?: string[]; tolerance?: number; relative?: number;
  figures?: { src: string; alt: string }[];
  marks: number; minutes: number; objective: string; formulas: string[];
  source: Source; origin: 'generated' | 'original' | 'adapted' | 'exercise';
  explanation: string; misconception: string; guidance: Guidance;
  rubric?: Criterion[]; solution?: string[];
}
export interface PaperPart {
  label: string; marks: number; page: number; topic: string; related?: string[]; pattern: string;
  questionId: string;
}
export interface Paper { id: string; year: string; semester: number; file: string; duration: number; parts: PaperPart[] }
export interface Attempt {
  id: string; question: string; answer: Answer; score: number; max: number;
  assistance: number; retries: number; confidence: number; seconds: number; at: number;
  reviewAssistance?: number;
  mode: 'practice' | 'review' | 'boss' | 'exam'; graded: 'auto' | 'self'; xp: number;
}
export interface LessonRecord { id: string; at: number; minutes: number }
export interface Review { due: number; box: number; last: number }
export interface ExamResult {
  id: string; title: string; mode: 'boss' | 'exam'; at: number;
  questions: string[]; answers: Record<string, Answer>; assistance: Record<string, number>; scores: Record<string, number>;
  marked: string[]; strict: boolean; seconds: number; finalized: boolean;
}
export interface ActiveExam {
  id: string; title: string; mode: 'boss' | 'exam'; questions: string[]; strict: boolean;
  started: number; deadline: number | null; index: number; answers: Record<string, Answer>;
  flags: string[]; assistance: Record<string, number>;
}
export interface Progress {
  version: 1; module: string; settings: { goal: number; examDate: string; theme: 'light' | 'dark' };
  attempts: Attempt[]; lessons: LessonRecord[]; reviews: Record<string, Review>;
  bookmarks: string[]; overrides: string[]; results: ExamResult[]; activeExam: ActiveExam | null;
  /** Guided-lecture scene checks passed, keyed by topic id. Optional so older backups still load. */
  lectures?: Record<string, number[]>;
}


export interface ModuleInfo { id: string; name: string; examDate: string }
export interface LectureScene {
  concept: string; title: string; setup?: string; content: string;
  table: { columns: string[]; rows: string[][] };
  check: { prompt: string; options: string[]; right: number; hint: string; feedback: string };
}
export interface Lecture { goal: string; explain: string; model: string; points: string[]; scenes: LectureScene[] }
