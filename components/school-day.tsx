'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Download,
  Home,
  MapPin,
  Maximize2,
  MessageCircle,
  Navigation,
  Pause,
  Play,
  School,
  Settings2,
  Users,
  X,
} from 'lucide-react';
import { createCity3D, type CitySnapshot } from '@/lib/world/scene3d';
import { createSchool3D } from '@/lib/world/school3d';
import {
  createCampus,
  isSchoolKind,
  SCHOOL_META,
  type SchoolKind,
} from '@/lib/world/school-model';
import { createWorld } from '@/lib/world/model';
import { createSchoolDayWorld } from '@/lib/world/school-day-world';
import { createSchoolDayInterior3D } from '@/lib/world/school-day-interior3d';
import {
  SchoolDayMotionQueue,
  type DayMotionFrame,
} from '@/lib/world/school-day-motion';
import type {
  DayGrade,
  DayGradeIssue,
  DayGradeSchedule,
  DayEvent,
  DayScene,
  DayPlan,
  SchoolDayState,
} from '@/lib/world/school-day-contract';
import SchoolDayPhone, {
  answerText,
  QuestionContent,
} from './school-day-phone';
import StudyMarkdown from './study-markdown';
import LearningProfile from './learning-profile';
import {
  EDUCATION_API as API,
  educationRequest as api,
} from '@/lib/education-api';
import { TeachingApiSettings } from './teaching-api-settings';
import './school-day.css';

const sceneNames: Record<DayScene, string> = {
  city: '青河市',
  campus: '校园',
  classroom: '教室',
  home: '家中学习',
};
const phaseNames: Record<string, string> = {
  app_review: '作业批改',
  app_dialogue: '交流与订正',
  resuming: '继续学习',
  paused: '已暂停',
  ready: '准备学习',
  preparing: '备课中',
  planning: '备课中',
  class: '课堂教学',
  classroom: '课堂教学',
  teaching: '课堂教学',
  classwork: '随堂练习',
  assignment: '布置作业',
  homework_assigned: '布置作业',
  after_school: '放学回家',
  commute: '放学回家',
  going_to_school: '出发上学',
  commute_to_school: '沿街道上学',
  arrive_school: '到校入班',
  school_arrival: '到校入班',
  break: '课间休息',
  lunch: '午间休息',
  recess: '课间休息',
  homework: '完成作业',
  submission: '提交作业',
  review: '作业批改',
  grading: '作业批改',
  app_grading: '作业批改',
  tutoring: '交流与订正',
  memory: '学习回顾',
  materials: '处理学习材料',
  overnight: '次日准备',
  complete: '本次学习完成',
};
const statusNames: Record<string, string> = {
  ready: '等待开始',
  preparing: '正在备课',
  running: '运行中',
  paused: '已暂停',
  complete: '已完成',
  error: '运行待处理',
};
const eventNames: Record<string, string> = {
  lesson_started: '开始上课',
  teacher_instruction: '课堂讲授',
  teacher_feedback: '教师反馈',
  student_answer: '学生作答',
  classwork_answer: '随堂作答',
  homework_answer: '家庭作业原答',
  student_work_shared: '分享作业',
  homework_assigned: '布置作业',
  homework_submitted: '整份作业提交',
  school_dismissed: '放学',
  student_moved: '步行途中',
  school_arrived: '到校入班',
  home_arrived: '到家',
  arrived_home: '到家',
  entered_classroom: '进入课堂',
  app_work_graded: 'APP 批改',
  app_review: 'APP 批改',
  app_dialogue: 'APP 交流',
  app_message: 'APP 交流',
  student_dialogue: '学生表达',
  student_message: '学生表达',
  app_memory_updated: 'APP 学习记录',
  day_completed: '当天学习完成',
  manual_request_budget_reserved: '准备本次交流',
};
function timelineLabel(event: DayEvent) {
  const kind = event.kind || event.type || '';
  if (kind === 'student_answer') {
    if (event.stage === 'classwork') return '随堂作答';
    if (event.stage === 'homework') return '家庭作业原答';
  }
  return eventNames[kind] || phaseNames[event.phase || ''] || '学习活动';
}
function timelineText(event: DayEvent) {
  const kind = event.kind || event.type;
  const value = event.text ?? event.content ?? '';
  if (kind === 'student_answer') {
    if (event.response && typeof event.response === 'object') {
      const response = event.response as Record<string, unknown>;
      if (response.answer !== null && response.answer !== undefined)
        return answerText(response.answer);
      if (typeof response.text === 'string') return response.text;
    }
    if (typeof value === 'string') {
      try {
        return answerText(JSON.parse(value));
      } catch {
        return value;
      }
    }
  }
  return answerText(value);
}
function gradeLevel(value: string | number, stage: string) {
  const match = String(value).match(
    /12|11|10|[1-9]|十二|十一|十|[一二三四五六七八九]/,
  )?.[0];
  const names: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
    十一: 11,
    十二: 12,
  };
  let number = match ? Number(match) || names[match] : 0;
  if (number <= 3 && stage === '初中') number += 6;
  if (number <= 3 && stage === '高中') number += 9;
  return number;
}
function formatTime(value: number) {
  const minutes = Math.floor(value || 0);
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
function extractState(
  payload: SchoolDayState | { state?: SchoolDayState } | null,
): SchoolDayState | null {
  if (!payload) return null;
  if ('run_id' in payload) return payload;
  return payload.state || null;
}
type RenderEngine = {
  dispose: () => void;
  focus: () => void;
  focusStudent?: (id: string) => void;
  snapshot?: () => CitySnapshot;
};
function LessonRequirements({ plan }: { plan: DayPlan }) {
  const media = plan.requirements?.media || [],
    limits = plan.execution_limits || [];
  if (!media.length && !limits.length) return null;
  const names: Record<string, string> = {
    audio: '朗读与语音',
    handwriting: '书写',
    diagram: '图形与图表',
    physical_objects: '实物操作',
    external_sources: '资料来源',
    source_text: '阅读材料',
  };
  return (
    <section className="sd-lesson-requirements" aria-label="教学材料与观察证据">
      <h3>教学材料与观察证据</h3>
      {media.map((requirement) => (
        <article key={requirement.id}>
          <header>
            <strong>{names[requirement.kind] || '教学材料'}</strong>
            <span>
              {requirement.status === 'pending_external_evidence'
                ? '待补充材料或观察'
                : requirement.status}
            </span>
          </header>
          <div>
            <small>材料</small>
            <StudyMarkdown text={requirement.material_needed} />
          </div>
          <div>
            <small>观察证据</small>
            <StudyMarkdown text={requirement.evidence_needed} />
          </div>
        </article>
      ))}
      {limits.map((limit, index) => (
        <div
          className="sd-evidence-condition"
          key={`${limit.requirement_id}-${index}`}
        >
          <StudyMarkdown text={limit.description} />
          {!media.some((item) => item.id === limit.requirement_id) && (
            <StudyMarkdown text={limit.evidence_needed} />
          )}
        </div>
      ))}
      {plan.requirements?.scope_conditions?.map((condition, index) => (
        <p className="sd-evidence-condition" key={index}>
          {condition}
        </p>
      ))}
    </section>
  );
}
function issueText(issue: DayGradeIssue) {
  return typeof issue === 'string'
    ? issue
    : issue.message || issue.reason || `${issue.subject || '课程'}资料需要补充`;
}
export default function SchoolDay({
  onExit,
  city,
  onCityChange,
}: {
  onExit: (kind?: SchoolKind) => void;
  city?: CitySnapshot;
  onCityChange?: (city: CitySnapshot) => void;
}) {
  const cityRef = useRef(city);
  const [initialWorld] = useState(() => city?.world ?? createWorld());
  const [state, setState] = useState<SchoolDayState | null>(null);
  const stateRef = useRef<SchoolDayState | null>(null);
  const runEpoch = useRef(0);
  const motion = useRef(new SchoolDayMotionQueue());
  const replayRun = useRef('');
  const [motionView, setMotionView] = useState<DayMotionFrame | null>(null);
  const [initialExplicitRun] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('run') &&
      new URLSearchParams(window.location.search).get('setup') !== '1',
  );
  const explicitRun = useRef(initialExplicitRun);
  const [gradeCatalog, setGradeCatalog] = useState<DayGrade[]>([]);
  const [gradeChoice, setGradeChoice] = useState(1);
  const [term, setTerm] = useState('上册');
  const [days, setDays] = useState(1);
  const [studentCount, setStudentCount] = useState(6);
  const [seed, setSeed] = useState(2417);
  const [gradeSchedule, setGradeSchedule] = useState<DayGradeSchedule | null>(
    null,
  );
  const [loadedPreview, setLoadedPreview] = useState('');
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [catalogError, setCatalogError] = useState('');
  const previewKey = `${gradeChoice}:${term}:${days}`;
  const loadingSchedule = loadedPreview !== previewKey;
  const selectedGrade = gradeCatalog.find(
    (row) => row.grade_level === gradeChoice,
  );
  const selectedKind: SchoolKind =
    gradeChoice >= 10 ? 'high' : gradeChoice >= 7 ? 'middle' : 'primary';
  const initialMap = useMemo(
    () =>
      createSchoolDayWorld(
        initialWorld,
        selectedKind,
        gradeChoice,
        studentCount,
      ),
    [initialWorld, selectedKind, gradeChoice, studentCount],
  );
  const world = state?.world || initialMap;
  const buildingKind = initialWorld.buildings.find(
    (building) => building.id === world.school.id,
  )?.kind;
  const schoolKind =
    world.school.kind ||
    (buildingKind && isSchoolKind(buildingKind) ? buildingKind : selectedKind);
  const campus = useMemo(() => createCampus(schoolKind), [schoolKind]);
  const gradeNumber =
    state?.grade_setup?.grade_level ||
    state?.grade_level ||
    world.grade_level ||
    (state?.plan
      ? gradeLevel(state.plan.grade, SCHOOL_META[schoolKind].level)
      : gradeChoice);
  const gradeName = `${['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'][gradeNumber] || gradeNumber}年级`;
  const sceneLabels = {
    ...sceneNames,
    campus: world.school.name,
    classroom: world.classroom?.name || `${gradeName}教室`,
  };
  const [connectionError, setConnectionError] = useState('');
  const [actionError, setActionError] = useState('');
  const [selectedId, setSelectedId] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : new URLSearchParams(window.location.search).get('student') || '',
  );
  const [observedView, setView] = useState<DayScene>('home');
  const [follow, setFollow] = useState(true);
  const [planner, setPlanner] = useState(() => !initialExplicitRun);
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [concurrency, setConcurrency] = useState(32);
  const [homeworkCount, setHomeworkCount] = useState(15);
  const [turns, setTurns] = useState(2);
  const [runs, setRuns] = useState<
    { run_id: string; status?: string; title?: string }[]
  >([]);
  const [activeRun, setActiveRun] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : new URLSearchParams(window.location.search).get('run') || '',
  );
  const [panel, setPanel] = useState<
    'lesson' | 'classwork' | 'journey' | 'evidence'
  >('lesson');
  const [phoneFocus, setPhoneFocus] = useState<{
    runId: string;
    studentId: string;
    assignmentId: string;
    itemId?: string;
    nonce: number;
  } | null>(null);
  const [renderError, setRenderError] = useState('');
  const sceneMount = useRef<HTMLDivElement>(null),
    overlay = useRef<HTMLCanvasElement>(null),
    mini = useRef<HTMLCanvasElement>(null);
  const engine = useRef<RenderEngine | null>(null);
  const students = state?.students || [];
  const selected = students.find((s) => s.id === selectedId) || students[0];
  const homeId = selected?.home_building_id || world.homes[0].id;
  const live = useRef({ state, selected, homeId, world });
  const visibleMotion =
    motionView?.identity === `${state?.run_id}:${selected?.id}`
      ? motionView
      : null;
  const view =
    follow && selected
      ? visibleMotion?.location.scene || selected.location.scene
      : observedView;
  const sceneAriaLabel = `${sceneLabels[view]}三维场景`;
  const interiorHomeId = view === 'home' ? homeId : '';
  const classroomId =
    selected?.location.classroom_id ||
    selected?.classroom_id ||
    world.classroom?.id ||
    '';
  const classroomSize =
    view === 'classroom'
      ? students.filter(
          (student) =>
            !classroomId ||
            !student.classroom_id ||
            student.classroom_id === classroomId,
        ).length
      : 0;
  const classroomGeometryKey = JSON.stringify(world.classroom || null);
  const displayedJourney = visibleMotion?.moving
    ? visibleMotion.journey
    : selected?.journey;
  const movementLabel = displayedJourney
    ? displayedJourney.direction === 'school'
      ? view === 'home'
        ? '准备出门上学'
        : view === 'classroom'
          ? '进入本班教室'
          : '步行上学'
      : '放学回家'
    : '';
  useEffect(() => {
    live.current = { state, selected, homeId, world };
  }, [state, selected, homeId, world]);
  useEffect(() => {
    if (!state?.run_id || !selected) motion.current.clear();
    else {
      motion.current.ingest(
        state.run_id,
        selected,
        state.events,
        replayRun.current === state.run_id,
      );
      replayRun.current = '';
    }
  }, [state, selected]);
  useEffect(() => {
    let raf = 0,
      previous = '';
    const render = (now: number) => {
      const frame = motion.current.advance(now);
      const key = frame
        ? `${frame.identity}:${frame.location.scene}:${frame.moving}:${frame.replaying}:${frame.journey?.direction || ''}`
        : '';
      if (key !== previous) {
        previous = key;
        setMotionView(frame);
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);
  const accept = useCallback((next: SchoolDayState | null) => {
    if (!next) return;
    const previous = stateRef.current;
    if (previous?.run_id === next.run_id && next.version < previous.version)
      return;
    stateRef.current = next;
    setState(next);
    setConnectionError('');
    setSelectedId((id) =>
      next.students.some((s) => s.id === id) ? id : next.students[0]?.id || '',
    );
  }, []);
  useEffect(() => {
    if (!activeRun) return;
    const url = new URL(window.location.href);
    url.searchParams.set('run', activeRun);
    url.searchParams.delete('teaching');
    window.history.replaceState(null, '', url);
  }, [activeRun]);
  useEffect(() => {
    if (!state?.run_id || !selected?.id) return;
    const url = new URL(window.location.href);
    url.searchParams.set('student', selected.id);
    window.history.replaceState(null, '', url);
  }, [state?.run_id, selected?.id]);

  useEffect(() => {
    const controller = new AbortController();
    void api<{ grades: DayGrade[] }>(
      `/grades?term=${encodeURIComponent(term)}`,
      undefined,
      controller.signal,
    )
      .then((payload) => {
        if (!controller.signal.aborted) {
          setGradeCatalog(payload.grades || []);
          setCatalogError('');
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setCatalogError(error.message);
      });
    return () => controller.abort();
  }, [term, catalogRetry]);
  useEffect(() => {
    const controller = new AbortController();
    const key = `${gradeChoice}:${term}:${days}`;
    void api<DayGradeSchedule>(
      `/timetable?grade_level=${gradeChoice}&term=${encodeURIComponent(term)}&days=${days}&start_day=1`,
      undefined,
      controller.signal,
    )
      .then((payload) => {
        if (!controller.signal.aborted) {
          setGradeSchedule(payload);
          setLoadedPreview(key);
          setCatalogError('');
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setGradeSchedule(null);
          setLoadedPreview(key);
          setCatalogError(error.message);
        }
      });
    return () => controller.abort();
  }, [gradeChoice, term, days, catalogRetry]);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      const epoch = runEpoch.current;
      try {
        const payload = await api<
          SchoolDayState | { state?: SchoolDayState } | null
        >(
          `/state${activeRun ? `?run_id=${encodeURIComponent(activeRun)}` : ''}`,
          undefined,
          controller.signal,
        );
        if (!cancelled && epoch === runEpoch.current) {
          const next = extractState(payload);
          const firstRun = !!next?.run_id && !stateRef.current?.run_id;
          accept(next);
          if (next?.run_id && !activeRun) setActiveRun(next.run_id);
          if (firstRun && explicitRun.current) setPlanner(false);
        }
      } catch (error) {
        if (!cancelled)
          setConnectionError(
            error instanceof Error ? error.message : '连接学习服务失败',
          );
      }
      if (!cancelled) timer = setTimeout(poll, 650);
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeRun, accept]);
  useEffect(() => {
    let active = true;
    void api<{ runs: { run_id: string; status?: string; title?: string }[] }>(
      '/runs',
    )
      .then((payload) => {
        if (active) setRuns(payload.runs || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [state?.run_id, state?.status]);
  const navigate = useCallback((scene: DayScene) => {
    setFollow(false);
    setView(scene);
    setRenderError('');
  }, []);
  const selectStudent = useCallback((id: string) => setSelectedId(id), []);
  useEffect(() => {
    if (!sceneMount.current || !overlay.current || !mini.current) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'sd-world-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', sceneAriaLabel);
    sceneMount.current.appendChild(canvas);
    let active = true;
    const displayedStudent = () => {
      const student = live.current.selected,
        frame = motion.current.frame;
      return student &&
        frame?.identity === `${live.current.state?.run_id}:${student.id}`
        ? { ...student, location: frame.location, journey: frame.journey }
        : student;
    };
    const actorSource = {
      students: () =>
        (live.current.state?.students || []).map((student) =>
          student.id === live.current.selected?.id
            ? displayedStudent() || student
            : student,
        ),
      selected: () => live.current.selected?.id || '',
      simTime: () => live.current.state?.sim_time ?? 510,
      onSelect: selectStudent,
      homeId: () => live.current.homeId,
      schoolId: () => live.current.world.school.id,
      exactPosition: (id: string) =>
        id === live.current.selected?.id &&
        motion.current.frame?.identity ===
          `${live.current.state?.run_id}:${id}` &&
        motion.current.frame.moving,
      classroomId: () =>
        live.current.selected?.location.classroom_id ||
        live.current.selected?.classroom_id ||
        live.current.world.classroom?.id ||
        '',
      route: () => {
        const current = displayedStudent();
        if (current?.location.scene === view && current.journey?.points.length)
          return current.journey.points;
        return view === 'city'
          ? live.current.world.routes.find(
              (r) => r.home_id === live.current.homeId,
            )?.points || []
          : view === 'campus'
            ? live.current.world.campus_route
            : [];
      },
    };
    const options = () => ({
      tool: 'explore' as const,
      paused: live.current.state?.status === 'paused',
      speed: 1,
      labels: true,
      grid: false,
      night: false,
    });
    const common = {
      canvas,
      mini: mini.current,
      overlay: overlay.current,
      options,
      dayActors: actorSource,
      announce: () => {},
      onClock: () => {},
      onZoom: () => {},
      onCoords: () => {},
      onStats: () => {},
      onPause: () => {},
      onTool: () => {},
      onError: setRenderError,
    };
    try {
      if (view === 'city')
        engine.current = createCity3D({
          ...common,
          saved: cityRef.current,
          onSelect: (building) => {
            if (building.id === live.current.world.school.id)
              navigate('campus');
            else if (building.kind === 'home') {
              const resident = live.current.state?.students.find(
                (s) => s.home_building_id === building.id,
              );
              if (resident) {
                setSelectedId(resident.id);
                navigate('home');
              }
            }
          },
        });
      else if (view === 'campus')
        engine.current = createSchool3D({
          ...common,
          campus,
          onSelect: (facility) => {
            if (
              facility.id ===
              (live.current.world.teaching_building?.id || 'teaching-b')
            )
              navigate('classroom');
            if (facility.id === 'gate') navigate('city');
          },
        });
      else
        engine.current = createSchoolDayInterior3D({
          canvas,
          overlay: overlay.current,
          frame: view,
          schoolTitle: `${world.school.name} · ${world.teaching_building?.name || gradeName}`,
          classroom: live.current.world.classroom,
          actors: actorSource,
          title: () =>
            view === 'classroom'
              ? `${live.current.state?.plan?.title || '今日课堂'}\n观察 · 表达 · 交流`
              : `${live.current.selected?.name || ''} · 家中学习`,
          onError: setRenderError,
          onExit: () => navigate(view === 'home' ? 'city' : 'campus'),
        });
      queueMicrotask(() => {
        if (active) setRenderError('');
      });
    } catch (error) {
      queueMicrotask(() => {
        if (active)
          setRenderError(
            error instanceof Error ? error.message : '无法创建3D画面',
          );
      });
    }
    const currentEngine = engine.current;
    return () => {
      active = false;
      if (view === 'city' && currentEngine?.snapshot) {
        cityRef.current = currentEngine.snapshot();
        onCityChange?.(cityRef.current);
      }
      currentEngine?.dispose();
      canvas.remove();
      if (engine.current === currentEngine) engine.current = null;
    };
  }, [
    view,
    state?.run_id,
    sceneAriaLabel,
    interiorHomeId,
    classroomSize,
    classroomId,
    schoolKind,
    campus,
    gradeName,
    world.school.name,
    classroomGeometryKey,
    world.teaching_building?.name,
    navigate,
    selectStudent,
    onCityChange,
  ]);
  const openRun = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('run', id);
    url.searchParams.delete('student');
    url.searchParams.delete('setup');
    window.history.pushState(null, '', url);
    runEpoch.current++;
    motion.current.clear();
    replayRun.current = '';
    explicitRun.current = true;
    stateRef.current = null;
    setState(null);
    setActiveRun(id);
    setSelectedId('');
    setPhoneFocus(null);
    setActionError('');
    setConnectionError('');
    setPlanner(false);
    setFollow(true);
  };
  const start = async () => {
    if (!gradeSchedule?.available || loadingSchedule || busy) return;
    setBusy(true);
    setActionError('');
    try {
      const payload = await api<SchoolDayState | { state?: SchoolDayState }>(
        '/start',
        {
          grade_level: gradeChoice,
          term,
          days,
          start_day: 1,
          seed,
          student_count: studentCount,
          homework_count: homeworkCount,
          concurrency,
          tutoring_turns: turns,
          world: createSchoolDayWorld(
            initialWorld,
            selectedKind,
            gradeChoice,
            studentCount,
          ),
        },
      );
      const next = extractState(payload);
      if (next) {
        replayRun.current = next.run_id;
        motion.current.clear();
        const url = new URL(window.location.href);
        url.searchParams.delete('setup');
        window.history.replaceState(null, '', url);
        runEpoch.current++;
        stateRef.current = null;
        accept(next);
        setActiveRun(next.run_id);
      }
      setPlanner(false);
      setFollow(true);
      setView('home');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '课程启动失败');
    } finally {
      setBusy(false);
    }
  };
  const control = async () => {
    if (!state || busy) return;
    const runId = state.run_id;
    setBusy(true);
    setActionError('');
    try {
      const next = extractState(
        await api<SchoolDayState | { state?: SchoolDayState }>('/control', {
          run_id: state.run_id,
          action:
            state.status === 'paused' || state.status === 'error'
              ? 'resume'
              : 'pause',
        }),
      );
      if (stateRef.current?.run_id === runId) accept(next);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };
  const send = async (text: string, itemId?: string, assignmentId?: string) => {
    if (!state || !selected) return;
    setMessageBusy(true);
    const runId = state.run_id,
      studentId = selected.id;
    try {
      const payload = await api<SchoolDayState | { state?: SchoolDayState }>(
        '/message',
        {
          run_id: runId,
          student_id: studentId,
          text,
          item_id: itemId,
          assignment_id: assignmentId,
        },
      );
      if (stateRef.current?.run_id === runId) accept(extractState(payload));
    } finally {
      setMessageBusy(false);
    }
  };
  const plannedEntries = gradeSchedule?.schedule || [];
  const scheduleIssues = gradeSchedule?.issues || selectedGrade?.issues || [];
  const schedulePeriods = [
    ...new Set((gradeSchedule?.weekly_schedule || []).map((row) => row.period)),
  ].sort((a, b) => a - b);
  const teacherEvents =
    state?.events?.filter(
      (event) =>
        !event.student_id &&
        ['teacher_instruction', 'teacher_feedback'].includes(
          event.kind || '',
        ) &&
        (event.text || event.content),
    ) || [];
  const lastTeacher = teacherEvents.at(-1);
  const teachingRecordLabel =
    state?.status === 'running' &&
    ['class', 'classroom', 'teaching'].includes(state.phase)
      ? lastTeacher?.kind === 'teacher_feedback'
        ? '课堂反馈'
        : '老师的讲解'
      : lastTeacher?.kind === 'teacher_feedback'
        ? '课堂反馈记录'
        : '课堂讲授记录';
  const time = formatTime(state?.sim_time ?? 510);
  const sceneTime = formatTime(
    follow && visibleMotion?.moving
      ? (visibleMotion.sim_time ?? state?.sim_time ?? 510)
      : (state?.sim_time ?? 510),
  );
  const classroomAnswers = (selected?.classwork || []).flatMap((group) =>
    'answers' in group
      ? group.lesson_id === state?.plan?.lesson_id
        ? group.answers
        : []
      : [group],
  );
  const errorDetail =
    !actionError && !connectionError && typeof state?.error === 'object'
      ? state.error?.detail
      : undefined;
  return (
    <main className="school-day" data-run-id={state?.run_id || ''}>
      <header className="sd-header">
        <button
          className="sd-back"
          onClick={() => onExit(schoolKind)}
          aria-label={`返回${world.school.name}`}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="sd-brand">
          <School size={25} />
          <div>
            <h1>
              {world.school.name} <span>学习的一天</span>
            </h1>
            <p>{state?.plan?.title || '从家出发，在青河市度过学习的一天'}</p>
          </div>
        </div>
        <div className="sd-run-badge">
          <span className={`sd-dot ${state?.status || ''}`} />
          {state ? statusNames[state.status] : '等待开始'}
          {state && (
            <b>
              第 {state.day || 1} 天 · {time}
            </b>
          )}
        </div>
        <div className="sd-header-actions">
          <button onClick={() => setPlanner(true)}>
            <BookOpen size={15} />
            开始学校日
          </button>
          <button onClick={() => setSettings(true)} aria-label="模型设置">
            <Settings2 size={17} />
          </button>
        </div>
      </header>
      {(connectionError || actionError || state?.error) && (
        <div className="sd-error" role="alert">
          {actionError ||
            connectionError ||
            (typeof state?.error === 'string'
              ? state.error
              : state?.error?.message)}
          {errorDetail && (
            <details
              key={`${state?.run_id}:${errorDetail}`}
              className="sd-error-detail"
            >
              <summary>查看失败详情</summary>
              <pre>{errorDetail}</pre>
            </details>
          )}
        </div>
      )}
      <div className="sd-layout">
        <section className="sd-observation">
          <div className="sd-world-bar">
            <nav aria-label="观察场景">
              {(['city', 'campus', 'classroom', 'home'] as DayScene[]).map(
                (scene) => (
                  <button
                    key={scene}
                    onClick={() => navigate(scene)}
                    className={view === scene ? 'active' : ''}
                  >
                    {scene === 'home' ? (
                      <Home size={14} />
                    ) : scene === 'city' ? (
                      <MapPin size={14} />
                    ) : (
                      <School size={14} />
                    )}{' '}
                    {sceneLabels[scene]}
                  </button>
                ),
              )}
            </nav>
            <div>
              <button
                className={follow ? 'active' : ''}
                onClick={() => {
                  setFollow((v) => !v);
                  if (selected) {
                    setView(selected.location.scene);
                    engine.current?.focusStudent?.(selected.id);
                  }
                }}
              >
                <Navigation size={14} />
                跟随学生
              </button>
              <button
                className={visibleMotion?.replaying ? 'active' : ''}
                disabled={
                  !selected ||
                  !state?.events.some(
                    (event) =>
                      event.kind === 'student_moved' &&
                      event.student_id === selected.id &&
                      (event.day ?? 1) === (state.day || 1),
                  )
                }
                onClick={() => {
                  if (!state || !selected) return;
                  if (motion.current.frame?.replaying) {
                    motion.current.clear();
                    motion.current.ingest(state.run_id, selected, state.events);
                  } else
                    motion.current.replay(
                      state.run_id,
                      selected,
                      state.events,
                      state.day || 1,
                    );
                  setMotionView(motion.current.frame);
                  setFollow(true);
                }}
              >
                <Play size={14} />
                {visibleMotion?.replaying ? '回到当前状态' : '回看当天路线'}
              </button>
              <button
                aria-label="场景全景"
                onClick={() => engine.current?.focus()}
              >
                <Maximize2 size={15} />
              </button>
            </div>
          </div>
          <div
            className="sd-scene"
            data-location={view}
            data-motion-pending={visibleMotion?.moving ? 'true' : 'false'}
          >
            <div ref={sceneMount} className="sd-world-mount" />
            <canvas ref={overlay} className="sd-world-overlay" />
            <canvas
              ref={mini}
              className={`sd-minimap ${view === 'city' || view === 'campus' ? '' : 'hidden'}`}
              width={240}
              height={170}
            />
            <div className="sd-scene-caption">
              <span>
                {view === 'home'
                  ? world.homes.find((h) => h.id === homeId)?.name || '家中'
                  : sceneLabels[view]}
              </span>
              <strong>
                {state
                  ? movementLabel || phaseNames[state.phase] || state.phase
                  : '选择年级，开始今天的学习'}
              </strong>
              <small>
                {visibleMotion?.replaying
                  ? `回看第 ${state?.day || 1} 天路线`
                  : visibleMotion?.moving
                    ? '行进中 · 按已发生的路线展示'
                    : '拖动旋转 · 滚轮缩放'}
              </small>
            </div>
            {renderError && (
              <div className="sd-render-error" role="alert">
                {renderError}
              </div>
            )}
            {!!state?.run_id && (
              <div className="sd-world-control">
                <span>{sceneTime}</span>
                <button
                  disabled={busy || state.status === 'complete'}
                  onClick={() => void control()}
                >
                  {state.status === 'paused' || state.status === 'error' ? (
                    <Play size={15} />
                  ) : (
                    <Pause size={15} />
                  )}{' '}
                  {state.status === 'paused' || state.status === 'error'
                    ? '继续'
                    : '暂停'}
                </button>
              </div>
            )}
          </div>
          <div className="sd-student-rail" aria-label="观察学生">
            {students.length ? (
              students.map((student) => (
                <button
                  key={student.id}
                  className={selected?.id === student.id ? 'active' : ''}
                  onClick={() => setSelectedId(student.id)}
                >
                  <span style={{ background: student.color }}>
                    {student.name.slice(-1)}
                  </span>
                  <div>
                    <strong>{student.name}</strong>
                    <small>{sceneLabels[student.location.scene]}</small>
                  </div>
                </button>
              ))
            ) : (
              <div className="sd-students-empty">
                <Users size={18} /> 选择年级后，学生将从各自家中出发
              </div>
            )}
          </div>
          <div className="sd-learning-panel">
            <div className="sd-panel-tabs">
              <button
                className={panel === 'lesson' ? 'active' : ''}
                onClick={() => setPanel('lesson')}
              >
                课堂内容
              </button>
              <button
                className={panel === 'classwork' ? 'active' : ''}
                onClick={() => setPanel('classwork')}
              >
                随堂作答{' '}
                {classroomAnswers.length ? `· ${classroomAnswers.length}` : ''}
              </button>
              <button
                className={panel === 'journey' ? 'active' : ''}
                onClick={() => setPanel('journey')}
              >
                学习历程
              </button>
              <button
                className={panel === 'evidence' ? 'active' : ''}
                onClick={() => setPanel('evidence')}
              >
                学情与证据
              </button>
            </div>
            <div className="sd-panel-body">
              {panel === 'lesson' ? (
                state?.plan ? (
                  <>
                    <div className="sd-lesson-heading">
                      <small>
                        {state.plan.subject} · {state.plan.grade}
                      </small>
                      <h2>{state.plan.title}</h2>
                    </div>
                    <div className="sd-objectives">
                      {state.plan.objectives?.map((goal) => (
                        <span key={goal.id}>{goal.text}</span>
                      ))}
                    </div>
                    <LessonRequirements plan={state.plan} />
                    {lastTeacher && (
                      <div className="sd-teacher-speech">
                        <strong>{teachingRecordLabel}</strong>
                        <StudyMarkdown
                          text={String(
                            lastTeacher.text || lastTeacher.content || '',
                          )}
                        />
                      </div>
                    )}
                    <div className="sd-activities">
                      {state.plan.activities?.map((activity, index) => (
                        <details key={activity.id} open={index === 0}>
                          <summary>
                            <span>{String(index + 1).padStart(2, '0')}</span>
                            {activity.title}
                            <small>{activity.minutes} 分钟</small>
                          </summary>
                          <StudyMarkdown text={activity.teacher_script} />
                        </details>
                      ))}
                    </div>
                    {!!state.plan.examples?.length && (
                      <details className="sd-example-list">
                        <summary>
                          课堂例题 · {state.plan.examples.length}
                        </summary>
                        {state.plan.examples.map((question) => (
                          <article key={question.id}>
                            <QuestionContent question={question} />
                          </article>
                        ))}
                      </details>
                    )}
                  </>
                ) : (
                  <div className="sd-panel-empty">
                    <BookOpen size={24} />
                    <h2>今天，从家中出发</h2>
                    <p>
                      选择年级、学生人数和天数，按课表观察上学、课堂与居家学习。
                    </p>
                    <button
                      className="sd-primary"
                      onClick={() => setPlanner(true)}
                    >
                      选择年级与天数
                    </button>
                  </div>
                )
              ) : panel === 'classwork' ? (
                <>
                  {state?.plan?.classwork?.length ? (
                    state.plan.classwork.map((question, index) => {
                      const answer = classroomAnswers.find(
                        (a) => a.item_id === question.id,
                      );
                      return (
                        <article
                          className="sd-classwork-item"
                          key={question.id}
                        >
                          <small>随堂练习 {index + 1}</small>
                          <QuestionContent question={question} />
                          <div className="sd-classwork-answer">
                            <strong>{selected?.name}的作答</strong>
                            <StudyMarkdown
                              text={
                                answer
                                  ? answerText(answer.answer ?? answer.text) ||
                                    '本题保留空白'
                                  : '等待本题作答'
                              }
                            />
                            {answer?.steps && (
                              <StudyMarkdown
                                text={
                                  Array.isArray(answer.steps)
                                    ? answer.steps.join('\n')
                                    : answer.steps
                                }
                              />
                            )}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p className="sd-muted">随堂练习会随本课教学展开。</p>
                  )}
                </>
              ) : panel === 'evidence' ? (
                state && selected ? (
                  <LearningProfile
                    key={`${state.run_id}:${selected.id}`}
                    api={API}
                    runId={state.run_id}
                    student={selected}
                    version={state.version}
                    onDiscussMaterial={(assignmentId, itemId) => {
                      const runId = state.run_id,
                        studentId = selected.id;
                      void api<SchoolDayState>(
                        `/state?run_id=${encodeURIComponent(runId)}`,
                      )
                        .then((next) => {
                          if (stateRef.current?.run_id !== runId) return;
                          const current = extractState(next);
                          const target = current?.students
                            .find((row) => row.id === studentId)
                            ?.assignments?.find(
                              (row) => row.assignment_id === assignmentId,
                            );
                          if (
                            current?.run_id !== runId ||
                            !target?.items.some((row) => row.id === itemId)
                          ) {
                            throw new Error('该学习任务尚未就绪，请稍后重试。');
                          }
                          accept(current);
                          setPhoneFocus({
                            runId,
                            studentId,
                            assignmentId,
                            itemId,
                            nonce: Date.now(),
                          });
                        })
                        .catch((error) => {
                          if (stateRef.current?.run_id === runId)
                            setActionError(error.message);
                        });
                    }}
                  />
                ) : (
                  <p className="sd-muted">选择课程与学生后查看学习证据。</p>
                )
              ) : (
                <ol className="sd-timeline">
                  {(state?.events || [])
                    .filter(
                      (event) =>
                        !event.student_id || event.student_id === selected?.id,
                    )
                    .slice(-80)
                    .reverse()
                    .map((event, index) => (
                      <li key={event.id || `${event.seq}-${index}`}>
                        <time>
                          {formatTime(event.sim_time ?? state?.sim_time ?? 0)}
                        </time>
                        <div>
                          <strong>{timelineLabel(event)}</strong>
                          <StudyMarkdown text={timelineText(event)} />
                        </div>
                      </li>
                    ))}
                </ol>
              )}
            </div>
          </div>
        </section>
        <aside className="sd-app-panel">
          <div className="sd-app-panel-heading">
            <MessageCircle size={16} />
            <span>个人学习 APP</span>
            <select
              aria-label="APP 学生"
              value={selected?.id || ''}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </div>
          <SchoolDayPhone
            student={selected}
            runId={state?.run_id || ''}
            time={time}
            focus={
              phoneFocus?.runId === state?.run_id &&
              phoneFocus?.studentId === selected?.id
                ? phoneFocus
                : undefined
            }
            onSend={send}
            disabled={
              !selected ||
              selected.location.scene !== 'home' ||
              !!selected.journey ||
              state?.status === 'preparing' ||
              state?.status === 'paused' ||
              state?.status === 'error'
            }
            disabledReason={
              state?.status === 'paused' || state?.status === 'error'
                ? '继续学习后再交流'
                : '到家后开始交流'
            }
            busy={
              messageBusy ||
              (state?.status === 'running' &&
                (!!state.pending_messages?.some(
                  (message) => message.student_id === selected?.id,
                ) ||
                  selected?.app_session?.transcript.at(-1)?.role === 'student'))
            }
          />
        </aside>
      </div>
      <footer className="sd-footer">
        <span>
          青河市 ·{' '}
          {state
            ? `${students.length} 位学生 · ${state.schedule?.length || Number(state.summary?.lessons_expected) || state.plans?.length || 1} 个课时`
            : '校园学习'}
        </span>
        {!!state?.run_id && (
          <a
            href={`${API}/api/school-day/export?run_id=${encodeURIComponent(state.run_id)}`}
            target="_blank"
            rel="noreferrer"
          >
            <Download size={13} />
            学习记录
          </a>
        )}
      </footer>
      {planner && (
        <div className="sd-modal-backdrop">
          <dialog
            open
            className="sd-planner"
            aria-modal="true"
            aria-label="年级与课表"
          >
            <header>
              <div>
                <small>{SCHOOL_META[selectedKind].name} · 学习安排</small>
                <h2>选择年级，查看学校日课表</h2>
              </div>
              <button
                aria-label="关闭年级与课表"
                onClick={() => setPlanner(false)}
              >
                <X size={20} />
              </button>
            </header>
            <div className="sd-planner-content sd-grade-planner-content">
              <section className="sd-grade-curriculum">
                <div className="sd-grade-selectors">
                  <label>
                    年级
                    <select
                      aria-label="年级"
                      value={gradeChoice}
                      onChange={(e) => setGradeChoice(Number(e.target.value))}
                    >
                      {(gradeCatalog.length
                        ? gradeCatalog
                        : Array.from({ length: 12 }, (_, i) => ({
                            grade_level: i + 1,
                            label: `${i + 1}年级`,
                          }))
                      ).map((row) => (
                        <option key={row.grade_level} value={row.grade_level}>
                          {row.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    学期
                    <select
                      aria-label="学期"
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                    >
                      <option>上册</option>
                      <option>下册</option>
                    </select>
                  </label>
                </div>
                <div className="sd-campus-address">
                  <School size={20} />
                  <div>
                    <strong>{initialMap.school.name}</strong>
                    <span>
                      {initialMap.teaching_building?.name} ·{' '}
                      {initialMap.classroom?.floor} 楼 ·{' '}
                      {selectedGrade?.classroom_name ||
                        initialMap.classroom?.name}
                    </span>
                  </div>
                </div>
                <div className="sd-schedule-title">
                  <CalendarDays size={18} />
                  <h3>每周课表</h3>
                  <span>{selectedGrade?.label || gradeName}</span>
                </div>
                {loadingSchedule ? (
                  <p className="sd-muted">正在读取年级课表…</p>
                ) : (
                  <div className="sd-weekly-scroll">
                    <table className="sd-weekly-table">
                      <thead>
                        <tr>
                          <th>时间</th>
                          {[
                            '星期一',
                            '星期二',
                            '星期三',
                            '星期四',
                            '星期五',
                          ].map((day) => (
                            <th key={day}>{day}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {schedulePeriods.map((period) => {
                          const first = gradeSchedule?.weekly_schedule.find(
                            (row) => row.period === period,
                          );
                          return (
                            <tr key={period}>
                              <th>
                                第 {period} 节
                                <small>
                                  {first
                                    ? `${formatTime(first.start_minute)}–${formatTime(first.end_minute)}`
                                    : ''}
                                </small>
                              </th>
                              {[1, 2, 3, 4, 5].map((weekday) => (
                                <td key={weekday}>
                                  {gradeSchedule?.weekly_schedule.find(
                                    (row) =>
                                      row.period === period &&
                                      row.weekday === weekday,
                                  )?.subject || '—'}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {gradeSchedule?.day_timing && (
                  <div className="sd-day-timing">
                    <span>
                      {formatTime(gradeSchedule.day_timing.depart_home)}{' '}
                      从家出发
                    </span>
                    <span>
                      {formatTime(gradeSchedule.day_timing.school_start)} 到校
                    </span>
                    <span>
                      {formatTime(gradeSchedule.day_timing.school_end)} 放学回家
                    </span>
                  </div>
                )}
                {catalogError && (
                  <div className="sd-error" role="alert">
                    {catalogError}
                    <button onClick={() => setCatalogRetry((v) => v + 1)}>
                      重新读取
                    </button>
                  </div>
                )}
                {!!scheduleIssues.length && (
                  <output className="sd-course-issues">
                    <strong>课程资料</strong>
                    {scheduleIssues.map((issue, index) => (
                      <p key={index}>{issueText(issue)}</p>
                    ))}
                  </output>
                )}
                {!!gradeSchedule?.warnings?.length && (
                  <output className="sd-course-issues">
                    <strong>课程说明</strong>
                    {gradeSchedule.warnings.map((warning, index) => (
                      <p key={index}>{issueText(warning)}</p>
                    ))}
                  </output>
                )}
                <details className="sd-course-sources">
                  <summary>
                    本次课程与教材 · {plannedEntries.length} 课时
                  </summary>
                  <ol>
                    {plannedEntries.map((lesson, index) => (
                      <li key={`${lesson.day}:${lesson.period}:${index}`}>
                        <small>
                          第 {lesson.day} 天 · 第 {lesson.period} 节 ·{' '}
                          {lesson.subject}
                        </small>
                        <strong>{lesson.title}</strong>
                        <span>{lesson.book_title}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              </section>
              <aside className="sd-schedule">
                <div className="sd-schedule-title">
                  <Users size={18} />
                  <h3>开始学校日</h3>
                </div>
                <div className="sd-run-settings">
                  <label>
                    学生人数
                    <input
                      aria-label="学生人数"
                      type="number"
                      min={1}
                      max={200}
                      value={studentCount}
                      onChange={(e) =>
                        setStudentCount(
                          Math.min(
                            200,
                            Math.max(
                              1,
                              Math.trunc(Number(e.target.value)) || 1,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    运行天数
                    <input
                      aria-label="运行天数"
                      type="number"
                      min={1}
                      max={30}
                      value={days}
                      onChange={(e) =>
                        setDays(
                          Math.min(
                            30,
                            Math.max(
                              1,
                              Math.trunc(Number(e.target.value)) || 1,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  <details>
                    <summary>
                      运行设置 <ChevronDown size={14} />
                    </summary>
                    <label>
                      作业题量
                      <input
                        aria-label="作业题量"
                        type="number"
                        min={12}
                        max={20}
                        value={homeworkCount}
                        onChange={(e) =>
                          setHomeworkCount(
                            Math.min(
                              20,
                              Math.max(
                                12,
                                Math.trunc(Number(e.target.value)) || 12,
                              ),
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      同时请求
                      <input
                        aria-label="同时请求"
                        type="number"
                        min={1}
                        max={200}
                        value={concurrency}
                        onChange={(e) =>
                          setConcurrency(
                            Math.min(
                              200,
                              Math.max(
                                1,
                                Math.trunc(Number(e.target.value)) || 1,
                              ),
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      辅导轮次
                      <input
                        aria-label="辅导轮次"
                        type="number"
                        min={0}
                        max={6}
                        value={turns}
                        onChange={(e) =>
                          setTurns(
                            Math.min(
                              6,
                              Math.max(
                                0,
                                Math.trunc(Number(e.target.value)) || 0,
                              ),
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      人物种子
                      <input
                        aria-label="人物种子"
                        type="number"
                        min={0}
                        max={2147483647}
                        value={seed}
                        onChange={(e) =>
                          setSeed(
                            Math.min(
                              2147483647,
                              Math.max(
                                0,
                                Math.trunc(Number(e.target.value)) || 0,
                              ),
                            ),
                          )
                        }
                      />
                    </label>
                    <p className="sd-muted">
                      相同种子会生成相同的学生初始设定。
                    </p>
                  </details>
                </div>
                <div className="sd-start-summary">
                  <strong>
                    {selectedGrade?.label || `${gradeChoice}年级`}
                  </strong>
                  <span>
                    {studentCount} 位学生 · {days} 天 · {plannedEntries.length}{' '}
                    课时
                  </span>
                </div>
                {actionError && (
                  <div className="sd-error" role="alert">
                    {actionError}
                  </div>
                )}
                <button
                  className="sd-primary sd-start"
                  disabled={
                    busy ||
                    loadingSchedule ||
                    !gradeSchedule?.available ||
                    !plannedEntries.length
                  }
                  onClick={() => void start()}
                >
                  <Play size={16} />
                  {busy ? '正在准备学校日…' : '开始学校日'}
                </button>
                <ol className="sd-route-preview">
                  <li>从家中出发</li>
                  <li>沿青河市街道上学</li>
                  <li>进入校园、教学楼和教室</li>
                  <li>按年级课表学习</li>
                  <li>放学回家，完成作业与 APP 交流</li>
                </ol>
                {!!runs.length && (
                  <label className="sd-history-select">
                    继续查看学习记录
                    <select
                      value={activeRun}
                      onChange={(e) => {
                        if (e.target.value) openRun(e.target.value);
                      }}
                    >
                      <option value="">选择记录</option>
                      {runs.map((run) => (
                        <option key={run.run_id} value={run.run_id}>
                          {run.title || run.run_id} ·{' '}
                          {statusNames[run.status || ''] || run.status}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </aside>
            </div>
          </dialog>
        </div>
      )}
      {settings && (
        <div className="sd-modal-backdrop">
          <dialog
            open
            className="sd-settings-modal"
            aria-modal="true"
            aria-label="模型设置"
          >
            <header>
              <h2>模型设置</h2>
              <button
                onClick={() => setSettings(false)}
                aria-label="关闭模型设置"
              >
                <X size={20} />
              </button>
            </header>
            <TeachingApiSettings
              api={API}
              running={
                state?.status === 'running' || state?.status === 'preparing'
              }
              onSaved={() => setSettings(false)}
              onClose={() => setSettings(false)}
            />
          </dialog>
        </div>
      )}
    </main>
  );
}
