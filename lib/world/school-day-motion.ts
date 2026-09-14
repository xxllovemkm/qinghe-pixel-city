import type { DayEvent, DayStudent } from './school-day-contract';

type Location = DayStudent['location'];
type Journey = DayStudent['journey'];
type Step = { location: Location; journey?: Journey; sim_time?: number };
export type DayMotionFrame = Step & {
  identity: string;
  moving: boolean;
  replaying: boolean;
};

function cloneStep(step: Step): Step {
  return {
    location: { ...step.location },
    journey: step.journey
      ? {
          ...step.journey,
          points: step.journey.points.map((point) => ({ ...point })),
        }
      : undefined,
    sim_time: step.sim_time,
  };
}

function eventStep(event: DayEvent): Step | null {
  if (
    event.kind !== 'student_moved' ||
    !event.location ||
    typeof event.location !== 'object'
  )
    return null;
  const location = event.location as Location;
  if (
    !['home', 'city', 'campus', 'classroom'].includes(location.scene) ||
    !Number.isFinite(location.x) ||
    !Number.isFinite(location.z)
  )
    return null;
  const journey = event.journey as Journey;
  if (
    !journey ||
    !Array.isArray(journey.points) ||
    !journey.points.every(
      (point) => Number.isFinite(point.x) && Number.isFinite(point.z),
    )
  )
    return null;
  return cloneStep({ location, journey, sim_time: event.sim_time });
}

/** Presents committed movements in order while the run state continues independently. */
export class SchoolDayMotionQueue {
  frame: DayMotionFrame | null = null;
  private identity = '';
  private seenCount = 0;
  private pending: Step[] = [];
  private active: {
    from: Location;
    step: Step;
    started: number;
    duration: number;
  } | null = null;
  private latest: Step | null = null;
  private replaying = false;

  get queuedSteps() {
    return this.pending.length + Number(!!this.active);
  }

  clear() {
    this.identity = '';
    this.seenCount = 0;
    this.pending = [];
    this.active = null;
    this.latest = null;
    this.frame = null;
    this.replaying = false;
  }

  ingest(
    runId: string,
    student: DayStudent,
    events: DayEvent[],
    replayNewRun = false,
  ) {
    const identity = `${runId}:${student.id}`;
    const initializing = identity !== this.identity;
    this.latest = cloneStep(student);
    if (initializing) {
      this.identity = identity;
      this.pending = [];
      this.active = null;
      this.replaying = false;
      this.seenCount = replayNewRun ? 0 : events.length;
      this.frame = {
        ...cloneStep(student),
        identity,
        moving: false,
        replaying: false,
      };
    }
    const fresh = events.slice(this.seenCount);
    this.seenCount = events.length;
    for (const event of fresh) {
      if (event.student_id !== student.id) continue;
      const step = eventStep(event);
      if (step) this.pending.push(step);
    }
    if (initializing && replayNewRun && this.pending.length) {
      this.frame = {
        ...cloneStep(this.pending[0]),
        identity,
        moving: true,
        replaying: false,
      };
    }
    if (!this.pending.length && !this.active) {
      this.replaying = false;
      this.frame = {
        ...cloneStep(student),
        identity,
        moving: false,
        replaying: false,
      };
    }
  }

  replay(runId: string, student: DayStudent, events: DayEvent[], day: number) {
    this.clear();
    this.ingest(runId, student, events);
    this.pending = events.flatMap((event) => {
      if (event.student_id !== student.id || (event.day ?? 1) !== day)
        return [];
      const step = eventStep(event);
      return step ? [step] : [];
    });
    if (this.pending.length) {
      this.replaying = true;
      this.frame = {
        ...cloneStep(this.pending[0]),
        identity: this.identity,
        moving: true,
        replaying: true,
      };
    }
  }

  advance(now: number): DayMotionFrame | null {
    if (!this.latest || !this.frame) return null;
    if (!this.active) {
      const step = this.pending.shift();
      if (!step) {
        this.replaying = false;
        this.frame = {
          ...cloneStep(this.latest),
          identity: this.identity,
          moving: false,
          replaying: false,
        };
        return this.frame;
      }
      const sameScene = this.frame.location.scene === step.location.scene;
      const from = sameScene
        ? { ...this.frame.location }
        : { ...step.location };
      const distance = Math.hypot(
        from.x - step.location.x,
        from.z - step.location.z,
      );
      const duration = Math.max(
        180,
        Math.min(650, distance * (step.location.scene === 'city' ? 3 : 10)),
      );
      this.active = { from, step, started: now, duration };
      this.frame = {
        ...cloneStep(step),
        location: from,
        identity: this.identity,
        moving: true,
        replaying: this.replaying,
      };
    }
    const { from, step, started, duration } = this.active;
    const progress = Math.min(1, Math.max(0, (now - started) / duration));
    const dx = step.location.x - from.x,
      dz = step.location.z - from.z;
    this.frame = {
      ...cloneStep(step),
      identity: this.identity,
      moving: true,
      replaying: this.replaying,
      location: {
        ...step.location,
        x: from.x + dx * progress,
        z: from.z + dz * progress,
        heading:
          Math.hypot(dx, dz) > 0 ? Math.atan2(dx, dz) : step.location.heading,
        pose: 'walking',
      },
    };
    // Keep the exact endpoint visible for this frame before entering the next scene.
    if (progress === 1) this.active = null;
    return this.frame;
  }
}
