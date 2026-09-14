import type {
  DayAnswer,
  DayAssignment,
  DayEvent,
  DayStudent,
} from './school-day-contract';
import type { KnowledgeGraphData, KnowledgeGraphNode } from './knowledge3d';

export type StudentAppearance = {
  skin: string;
  hair: string;
  clothing: string;
  height: number;
};
export type CharacterSettings = {
  student_index?: number;
  name?: string;
  schema?: string;
  seed?: number;
  gender: 'female' | 'male' | 'unspecified';
  grade: number | string;
  appearance: StudentAppearance;
  learning_rate: number;
  retention: number;
  diligence: number;
  initial_preparation: number;
  help_seeking: number;
  interests: string[];
  learning_style: string;
  task: {
    goal: string;
    daily_practice_minutes: number;
    response_style: string;
  };
  initial_knowledge?: { node_id: string; mastery: number }[];
};
export type LearnerKnowledgeNode = KnowledgeGraphNode & {
  learned: boolean;
  mastery: number;
  stars: number;
  basis?: string;
  source?: {
    path?: string;
    relative_path?: string;
    quote?: string;
    section?: string;
    sha256?: string;
  };
  effective_evidence?: number;
  first_seen?: number;
  updated_at?: number;
};
export type LearnerProfiles = {
  run_id: string;
  student_id: string;
  model_version: string;
  character: CharacterSettings | null;
  rubric: {
    version: string;
    status: string;
    stars: { stars: number; minimum: number; label: string }[];
    truth: {
      description: string;
      initial: string;
      learning: string;
      forgetting: string;
      fatigue: string;
      coefficients?: Record<string, string | number>;
    };
    app: {
      description: string;
      prediction: string;
      recency: string;
      dialogue: string;
      weights?: Record<string, number>;
    };
    validation: string;
  };
  truth: {
    status: string;
    fatigue?: number;
    since_sim_time?: number;
    graph: Omit<KnowledgeGraphData, 'nodes'> & {
      nodes: LearnerKnowledgeNode[];
    };
  };
  app: {
    status: string;
    since_sim_time?: number;
    graph: Omit<KnowledgeGraphData, 'nodes'> & {
      nodes: LearnerKnowledgeNode[];
    };
  };
};

export type PracticePlan = {
  id: string;
  student_id: string;
  skill?: string;
  objective: string;
  purpose: 'continue_learning' | 'consolidation' | 'variation' | 'retention';
  due_day: number;
  status: 'scheduled' | 'completed';
};

export type LearningMemory = {
  id: string;
  item_id?: string;
  assignment_id?: string;
  day?: number;
  judgment: string;
  claim: string;
  next_action?: string;
  evidence_ids: string[];
  knowledge_targets?: {
    node_id: string;
    reason?: string;
    evidence_ids?: string[];
  }[];
};
export type SchoolDayProfile = {
  run_id: string;
  student_id: string;
  version: number;
  learner_profiles?: LearnerProfiles;
  student: Pick<DayStudent, 'id' | 'name' | 'classwork' | 'app_session'> & {
    assignments: DayAssignment[];
    history: {
      day: number;
      lesson_id: string;
      title?: string;
      own_answers?: DayAnswer[];
    }[];
    learning_experiences: {
      stage: string;
      event_id?: string;
      lesson_key?: string;
      answers?: DayAnswer[];
      response?: { text?: string; answer?: unknown };
    }[];
    app_memory: { version: number; summary: string; records: LearningMemory[] };
  };
  events?: DayEvent[];
  knowledge: {
    graph_version?: string;
    nodes: {
      node_id: string;
      name: string;
      mapping_status: string;
      mastery_status: string;
      evidence_ids: string[];
      records?: LearningMemory[];
    }[];
  };
  evaluations?: LearningEvaluation[];
};

export type LearningEvaluation = {
  id: string;
  status: string;
  source_version?: number | string;
  error?: string;
  manifest?: {
    total_jobs?: number;
    student_ids?: string[];
    created_at?: number;
  };
  progress?: {
    total?: number;
    completed?: number;
    pending?: number;
    errors?: number;
    api_calls?: number;
    reported_tokens?: number;
    in_flight?: number;
  };
  results?: {
    job_id: string;
    kind: string;
    student_id?: string;
    result: {
      verdict: string;
      summary?: string;
      observed_progress?: string;
      findings: unknown[];
      items?: {
        item_id: string;
        expected_answer?: unknown;
        expected_score?: number;
        max_score?: number;
        app_grade_agrees?: boolean;
        explanation?: string;
      }[];
    };
  }[];
};
export type MaterialRegion = { page_index: number; bbox?: number[] };
export type MaterialItem = {
  id: string;
  text: string;
  own_answer?: unknown;
  parts?: MaterialItem[];
  source_regions?: MaterialRegion[];
  uncertainties?: { reason: string; source_regions?: MaterialRegion[] }[];
};
export type MaterialMapping = {
  status?: string;
  item_id?: string;
  reason?: string;
  mapped_input?: { text?: string };
  parts?: MaterialMapping[];
  targets?: {
    node_key?: string;
    node_id?: string;
    relation?: string;
    evidence?: string;
    definition_evidence?: string;
    node_definition?: { name?: string };
  }[];
};
export type MaterialAssignment = DayAssignment & {
  material_mapping?: { items?: MaterialMapping[]; status?: string };
};
export type LearningMaterial = {
  id: string;
  run_id: string;
  owner_id: string;
  assignment_id?: string;
  filename?: string;
  status: string;
  file_sha256: string;
  pages: {
    index: number;
    asset?: string;
    text?: string;
    extraction_method?: string;
  }[];
  items: MaterialItem[];
  unresolved_regions?: { reason?: string; page_index?: number }[];
  mapping?: { items?: MaterialMapping[]; status?: string };
  mapping_runs?: { items?: MaterialMapping[]; status?: string }[];
};
export type MaterialJob = {
  id: string;
  status: string;
  material_id?: string;
  assignment_id?: string;
  error?: string;
};
