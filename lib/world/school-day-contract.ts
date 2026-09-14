import type { SchoolDayWorld } from './school-day-world';

export type DayScene = 'classroom' | 'campus' | 'city' | 'home';
export type DayGradeIssue =
  | string
  | { code?: string; message?: string; reason?: string; subject?: string };
export type DayGrade = {
  grade_level: number;
  label: string;
  stage: string;
  school_kind: 'primary' | 'middle' | 'high';
  teaching_building_id: string;
  classroom_id: string;
  classroom_name: string;
  floor?: number;
  available: boolean;
  issues?: DayGradeIssue[];
  reason?: string;
};
export type DayGradeSchedule = {
  available: boolean;
  issues: DayGradeIssue[];
  warnings?: DayGradeIssue[];
  grade_level: number;
  term: string;
  days: number;
  start_day: number;
  version: string;
  source_snapshot_id: string;
  day_timing?: {
    depart_home: number;
    school_start: number;
    school_end: number;
    bedtime: number;
  };
  weekly_schedule: {
    weekday: number;
    period: number;
    start_minute: number;
    end_minute: number;
    subject: string;
  }[];
  schedule: {
    day: number;
    period: number;
    subject: string;
    book_id: string;
    lesson_id: string;
    title: string;
    book_title: string;
    grade_level: number;
    start_minute?: number;
    end_minute?: number;
    source?: Record<string, unknown>;
  }[];
};
export type DayBook = {
  id: string;
  title: string;
  revision?: string;
  stage?: string;
  subject: string;
  edition?: string;
  grade: string | number;
  term?: string;
  design_count?: number;
};
export type DayLesson = {
  id: string;
  title: string;
  unit_id?: string;
  unit_title?: string;
  sequence?: number;
  source_status?: string;
  goals?: string[] | string;
  teaching_focus?: string;
  source?: Record<string, unknown>;
};
export type DayCatalogNode = {
  id: string;
  title: string;
  depth?: number;
  children: DayCatalogNode[];
  resource_ids?: string[];
};
export type DayQuestion = {
  id: string;
  type: string;
  prompt: string;
  context?: string;
  options?: { id: string; text: string }[];
  max_score: number;
  score_scale?: 'one_point_per_item' | 'source_points';
  objective_ids?: string[];
};
export type DayPlan = {
  id: string;
  book_id: string;
  lesson_id: string;
  title: string;
  subject: string;
  grade: string | number;
  source?: Record<string, unknown>;
  objectives: { id: string; text: string }[];
  activities: {
    id: string;
    title: string;
    minutes: number;
    teacher_script: string;
    objective_ids?: string[];
  }[];
  examples: DayQuestion[];
  classwork: DayQuestion[];
  homework: { id: string; title: string; items: DayQuestion[] };
  requirements?: {
    media?: {
      id: string;
      kind: string;
      source_terms?: string[];
      material_needed: string;
      evidence_needed: string;
      status: string;
    }[];
    scope_conditions?: string[];
  };
  execution_limits?: {
    requirement_id: string;
    kind: string;
    description: string;
    evidence_needed: string;
    status: string;
  }[];
};
export type DayAnswer = {
  item_id: string;
  response_kind?: string;
  answer?: unknown;
  text?: string;
  steps?: string[] | string;
};
export type DayReview = {
  item_id: string;
  correct: boolean | null;
  score?: number | null;
  max_score?: number;
  explanation?: string;
  step_findings?: unknown[];
};
export type DayTurn = {
  id: string;
  role: 'student' | 'assistant';
  text: string;
  item_id?: string;
  assignment_id?: string;
};
export type DayAssignment = {
  origin?: 'uploaded_material';
  material_id?: string;
  score_scale?: 'one_point_per_item' | 'source_points' | 'mixed';
  assignment_id: string;
  title?: string;
  day?: number;
  lesson_id?: string;
  book_id?: string;
  status: string;
  items: DayQuestion[];
  answers: DayAnswer[];
  submission?: Record<string, unknown>;
  review?: { items: DayReview[]; summary?: string | Record<string, unknown> };
};
export type DayStudent = {
  id: string;
  name: string;
  color: string;
  grade_level?: number;
  classroom_id?: string;
  teaching_building_id?: string;
  appearance?: { skin: string; hair: string; clothing: string; height: number };
  school_building_id: string;
  home_building_id: string;
  location: {
    scene: DayScene;
    place_id: string;
    x: number;
    z: number;
    heading?: number;
    pose?: string;
    facility_id?: string;
    classroom_id?: string;
    floor?: number;
  };
  journey?: {
    points: { x: number; z: number }[];
    progress: number;
    direction?: 'school' | 'home';
    scene?: DayScene;
  };
  speech?: string;
  app_active?: boolean;
  classwork: (
    | DayAnswer
    | {
        lesson_key: string;
        lesson_id: string;
        items: DayQuestion[];
        answers: DayAnswer[];
        feedback_history?: unknown[];
      }
  )[];
  homework?: DayAssignment;
  assignments?: DayAssignment[];
  app_session?: { id: string; transcript: DayTurn[]; status?: string };
  app_memory?: Record<string, unknown>;
  truth?: Record<string, unknown>;
};
export type DayEvent = {
  id?: string;
  seq?: number;
  type?: string;
  kind?: string;
  phase?: string;
  student_id?: string;
  text?: string;
  content?: string;
  sim_time?: number;
  day?: number;
  activity_id?: string;
  item_id?: string;
  [key: string]: unknown;
};
export type SchoolDayState = {
  run_id: string;
  version: number;
  status: 'ready' | 'preparing' | 'running' | 'paused' | 'complete' | 'error';
  phase: string;
  grade_level?: number;
  term?: string;
  days?: number;
  grade_setup?: DayGradeSchedule & Partial<DayGrade>;
  settings?: {
    student_count?: number;
    grade_level?: number;
    term?: string;
    days?: number;
    start_day?: number;
    seed?: number;
    concurrency?: number;
    tutoring_turns?: number;
    homework_count?: number;
  };
  day: number;
  sim_time: number;
  plan?: DayPlan | null;
  plans?: DayPlan[];
  students: DayStudent[];
  events: DayEvent[];
  requests?: unknown[];
  pending_messages?: {
    student_id: string;
    assignment_id: string;
    item_id?: string;
    status: string;
  }[];
  summary?: Record<string, unknown>;
  error?: string | { code?: string; message: string; detail?: string };
  world?: SchoolDayWorld;
  schedule?: {
    book_id: string;
    lesson_id: string;
    day: number;
    period?: number;
  }[];
};
