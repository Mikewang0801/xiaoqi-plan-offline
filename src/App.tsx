import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, PointerEvent as ReactPointerEvent } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

type Recurrence = "none" | "daily" | "weekdays" | "weekly" | "monthly";
type Theme = "light" | "dark" | "system";
type ViewName = "today" | "week" | "pomodoro" | "review" | "history" | "stats" | "settings";
type PomodoroMode = "focus" | "short" | "long";

type MindNode = {
  label: string;
  children?: MindNode[];
};

type LearningReview = {
  id: string;
  date: string;
  generatedAt: string;
  headline: string;
  summary: string;
  achievements: string[];
  gaps: string[];
  actions: string[];
  encouragement: string;
  mindMap: MindNode;
};

type PetState = {
  name: string;
  food: number;
  streak: number;
  lastFedDate: string;
  fedTaskIds: string[];
};

type PomodoroState = {
  mode: PomodoroMode;
  remainingSeconds: number;
  running: boolean;
  checkpointAt: string | null;
  focusMinutes: number;
  shortMinutes: number;
  longMinutes: number;
  completedSessions: number;
};

type Task = {
  id: string;
  title: string;
  date: string;
  startMinute: number;
  durationMinute: number;
  category: string;
  color: string;
  completed: boolean;
  focusSeconds: number;
  sessionSeconds: number;
  recurrence: Recurrence;
  recurrenceEnd: string;
  parentId: string;
  carriedTo: string;
  carriedFrom: string;
  reminderMinutes: number;
  reminderSent: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type Settings = {
  axisStart: number;
  axisEnd: number;
  segmentMinutes: 15 | 30 | 60;
  autoRollover: boolean;
  theme: Theme;
};

type AppState = {
  version: 3;
  tasks: Task[];
  settings: Settings;
  pet: PetState;
  pomodoro: PomodoroState;
  reviews: LearningReview[];
  timer: {
    runningTaskId: string | null;
    lastSelectedTaskId: string | null;
    lastCheckpointAt: string | null;
  };
};

type TaskDraft = {
  title: string;
  date: string;
  time: string;
  durationMinute: number;
  category: string;
  color: string;
  recurrence: Recurrence;
  recurrenceEnd: string;
  reminderMinutes: number;
  notes: string;
  completed: boolean;
};

type DragState = {
  id: string;
  mode: "move" | "resize";
  pointerId: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  baseDate: string;
  baseStart: number;
  baseDuration: number;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "plan-table-mobile-v2";
const REVIEW_API_KEY = "plan-table-review-api";
const REVIEW_TOKEN_KEY = "plan-table-review-token";
const AI_ENABLED = false;
const SERVICE_WORKER_PATH = AI_ENABLED ? "/sw.js" : "/sw-offline.js";
const DAY_WIDTH = 132;
const TIME_LEFT = 54;
const WEEK_HEADER = 46;
const PIXELS_PER_MINUTE = 0.72;
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const CATEGORIES = ["默认", "工作", "学习", "生活", "运动"];
const COLORS = ["#EF858A", "#72B79D", "#F2B45F", "#8DA9D6", "#B598D0", "#E58A69"];

const DEFAULT_PET: PetState = { name: "小淇", food: 0, streak: 0, lastFedDate: "", fedTaskIds: [] };
const DEFAULT_POMODORO: PomodoroState = {
  mode: "focus",
  remainingSeconds: 25 * 60,
  running: false,
  checkpointAt: null,
  focusMinutes: 25,
  shortMinutes: 5,
  longMinutes: 15,
  completedSessions: 0,
};

const DEFAULT_STATE: AppState = {
  version: 3,
  tasks: [],
  settings: {
    axisStart: 6 * 60,
    axisEnd: 24 * 60,
    segmentMinutes: 30,
    autoRollover: true,
    theme: "system",
  },
  pet: DEFAULT_PET,
  pomodoro: DEFAULT_POMODORO,
  reviews: [],
  timer: { runningTaskId: null, lastSelectedTaskId: null, lastCheckpointAt: null },
};

const pad = (value: number) => String(value).padStart(2, "0");

function localISODate(value = new Date()) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function addDays(value: string, count: number) {
  const next = parseDate(value);
  next.setDate(next.getDate() + count);
  return localISODate(next);
}

function startOfWeek(value: string) {
  const current = parseDate(value);
  const offset = (current.getDay() + 6) % 7;
  current.setDate(current.getDate() - offset);
  return localISODate(current);
}

function endOfMonth(value: string) {
  const current = parseDate(value);
  return localISODate(new Date(current.getFullYear(), current.getMonth() + 1, 0));
}

function startOfMonth(value: string) {
  const current = parseDate(value);
  return localISODate(new Date(current.getFullYear(), current.getMonth(), 1));
}

function dateLabel(value: string, withYear = false) {
  const day = parseDate(value);
  return new Intl.DateTimeFormat("zh-CN", {
    ...(withYear ? { year: "numeric" as const } : {}),
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(day);
}

function minutesToTime(value: number) {
  if (value >= 1440) return "24:00";
  return `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return Math.max(0, Math.min(1439, hour * 60 + minute));
}

function durationText(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds % 60)}`;
}

function uid() {
  return globalThis.crypto?.randomUUID?.().replaceAll("-", "") ?? `${Date.now()}${Math.random()}`;
}

function nowText() {
  return new Date().toISOString();
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 8) : [];
}

function normalizeMindNode(value: unknown, fallback = "今日学习") : MindNode {
  if (!value || typeof value !== "object") return { label: fallback };
  const raw = value as Record<string, unknown>;
  const children = Array.isArray(raw.children)
    ? raw.children.slice(0, 6).map((child) => normalizeMindNode(child, "学习要点"))
    : undefined;
  return { label: String(raw.label ?? fallback).slice(0, 80), ...(children?.length ? { children } : {}) };
}

function normalizeReview(value: unknown): LearningReview | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  return {
    id: String(raw.id ?? uid()),
    date: String(raw.date ?? localISODate()),
    generatedAt: String(raw.generatedAt ?? nowText()),
    headline: String(raw.headline ?? "今天又向目标靠近了一步"),
    summary: String(raw.summary ?? "暂无总结"),
    achievements: stringList(raw.achievements),
    gaps: stringList(raw.gaps),
    actions: stringList(raw.actions),
    encouragement: String(raw.encouragement ?? "稳稳积累，小淇陪你一起进步。"),
    mindMap: normalizeMindNode(raw.mindMap),
  };
}

function pomodoroDuration(state: PomodoroState, mode = state.mode) {
  return (mode === "focus" ? state.focusMinutes : mode === "short" ? state.shortMinutes : state.longMinutes) * 60;
}

function checkpointPomodoro(state: PomodoroState) {
  if (!state.running || !state.checkpointAt) return state;
  const elapsed = Math.max(0, Math.floor((Date.now() - Date.parse(state.checkpointAt)) / 1000));
  if (!Number.isFinite(elapsed) || elapsed === 0) return state;
  if (elapsed < state.remainingSeconds) {
    return { ...state, remainingSeconds: state.remainingSeconds - elapsed, checkpointAt: nowText() };
  }
  return {
    ...state,
    remainingSeconds: 0,
    running: false,
    checkpointAt: null,
    completedSessions: state.completedSessions + (state.mode === "focus" ? 1 : 0),
  };
}

function feedPet(pet: PetState, taskId: string, date: string) {
  if (pet.fedTaskIds.includes(taskId)) return pet;
  const yesterday = addDays(date, -1);
  const streak = pet.lastFedDate === date ? pet.streak : pet.lastFedDate === yesterday ? pet.streak + 1 : 1;
  return { ...pet, food: pet.food + 1, streak, lastFedDate: date, fedTaskIds: [...pet.fedTaskIds, taskId] };
}

function MindMap({ node }: { node: MindNode }) {
  return (
    <div className="mind-node">
      <span>{node.label}</span>
      {node.children?.length ? <div className="mind-children">{node.children.map((child, index) => <MindMap key={`${child.label}-${index}`} node={child} />)}</div> : null}
    </div>
  );
}

function newDraft(date = localISODate(), startMinute = 9 * 60): TaskDraft {
  return {
    title: "",
    date,
    time: minutesToTime(startMinute),
    durationMinute: 60,
    category: "默认",
    color: COLORS[0],
    recurrence: "none",
    recurrenceEnd: "",
    reminderMinutes: 0,
    notes: "",
    completed: false,
  };
}

function draftFromTask(task: Task): TaskDraft {
  return {
    title: task.title,
    date: task.date,
    time: minutesToTime(task.startMinute),
    durationMinute: task.durationMinute,
    category: task.category,
    color: task.color,
    recurrence: task.recurrence,
    recurrenceEnd: task.recurrenceEnd,
    reminderMinutes: task.reminderMinutes,
    notes: task.notes,
    completed: task.completed,
  };
}

function taskFromUnknown(raw: Record<string, unknown>): Task {
  const createdAt = String(raw.createdAt ?? raw.created_at ?? nowText());
  return {
    id: String(raw.id ?? uid()),
    title: String(raw.title ?? "未命名任务"),
    date: String(raw.date ?? localISODate()),
    startMinute: Number(raw.startMinute ?? raw.start_minute ?? 9 * 60),
    durationMinute: Number(raw.durationMinute ?? raw.duration_minute ?? 60),
    category: String(raw.category ?? "默认"),
    color: String(raw.color ?? COLORS[0]),
    completed: Boolean(raw.completed),
    focusSeconds: Number(raw.focusSeconds ?? raw.focus_seconds ?? 0),
    sessionSeconds: Number(raw.sessionSeconds ?? raw.session_seconds ?? 0),
    recurrence: String(raw.recurrence ?? "none") as Recurrence,
    recurrenceEnd: String(raw.recurrenceEnd ?? raw.recurrence_end ?? ""),
    parentId: String(raw.parentId ?? raw.parent_id ?? ""),
    carriedTo: String(raw.carriedTo ?? raw.carried_to ?? ""),
    carriedFrom: String(raw.carriedFrom ?? raw.carried_from ?? ""),
    reminderMinutes: Number(raw.reminderMinutes ?? raw.reminder_minutes ?? 0),
    reminderSent: Boolean(raw.reminderSent ?? raw.reminder_sent),
    notes: String(raw.notes ?? ""),
    createdAt,
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? createdAt),
  };
}

function normalizeState(raw: Record<string, unknown>): AppState {
  const rawSettings = (raw.settings ?? {}) as Record<string, unknown>;
  const rawTimer = (raw.timer ?? {}) as Record<string, unknown>;
  const rawPet = (raw.pet ?? {}) as Record<string, unknown>;
  const rawPomodoro = (raw.pomodoro ?? {}) as Record<string, unknown>;
  const running = rawTimer.runningTaskId ?? rawTimer.running_task_id;
  const lastSelected = rawTimer.lastSelectedTaskId ?? rawTimer.last_selected_task_id ?? running;
  const mode = ["focus", "short", "long"].includes(String(rawPomodoro.mode))
    ? String(rawPomodoro.mode) as PomodoroMode
    : "focus";
  const pomodoro = {
    ...DEFAULT_POMODORO,
    mode,
    focusMinutes: Number(rawPomodoro.focusMinutes ?? DEFAULT_POMODORO.focusMinutes),
    shortMinutes: Number(rawPomodoro.shortMinutes ?? DEFAULT_POMODORO.shortMinutes),
    longMinutes: Number(rawPomodoro.longMinutes ?? DEFAULT_POMODORO.longMinutes),
    completedSessions: Number(rawPomodoro.completedSessions ?? 0),
  };
  pomodoro.remainingSeconds = Number(rawPomodoro.remainingSeconds ?? pomodoroDuration(pomodoro));
  return {
    version: 3,
    tasks: Array.isArray(raw.tasks)
      ? raw.tasks.map((item) => taskFromUnknown(item as Record<string, unknown>))
      : [],
    settings: {
      axisStart: Number(rawSettings.axisStart ?? rawSettings.axis_start ?? 6 * 60),
      axisEnd: Number(rawSettings.axisEnd ?? rawSettings.axis_end ?? 24 * 60),
      segmentMinutes: Number(rawSettings.segmentMinutes ?? rawSettings.segment_minutes ?? 30) as 15 | 30 | 60,
      autoRollover: Boolean(rawSettings.autoRollover ?? rawSettings.auto_rollover ?? true),
      theme: String(rawSettings.theme ?? "system") as Theme,
    },
    pet: {
      name: String(rawPet.name ?? DEFAULT_PET.name),
      food: Number(rawPet.food ?? 0),
      streak: Number(rawPet.streak ?? 0),
      lastFedDate: String(rawPet.lastFedDate ?? ""),
      fedTaskIds: Array.isArray(rawPet.fedTaskIds) ? rawPet.fedTaskIds.map(String) : [],
    },
    pomodoro,
    reviews: Array.isArray(raw.reviews)
      ? raw.reviews.map(normalizeReview).filter((item): item is LearningReview => Boolean(item))
      : [],
    // 重开应用时恢复数值但保持暂停，避免把浏览器关闭时间计入专注。
    timer: {
      runningTaskId: null,
      lastSelectedTaskId: lastSelected ? String(lastSelected) : null,
      lastCheckpointAt: null,
    },
  };
}

function recurrenceMatches(base: string, candidate: string, recurrence: Recurrence) {
  const baseDate = parseDate(base);
  const current = parseDate(candidate);
  if (current <= baseDate) return false;
  if (recurrence === "daily") return true;
  if (recurrence === "weekdays") return current.getDay() !== 0 && current.getDay() !== 6;
  if (recurrence === "weekly") return current.getDay() === baseDate.getDay();
  if (recurrence === "monthly") return current.getDate() === baseDate.getDate();
  return false;
}

function prepareState(input: AppState, visibleDate: string) {
  let tasks = input.tasks;
  let changed = false;
  const weekStart = startOfWeek(visibleDate);
  const weekEnd = addDays(weekStart, 6);
  const existing = new Set(tasks.filter((task) => task.parentId).map((task) => `${task.parentId}|${task.date}`));
  const generated: Task[] = [];

  for (const base of tasks.filter((task) => task.recurrence !== "none" && !task.parentId)) {
    let cursor = base.date > weekStart ? addDays(base.date, 1) : weekStart;
    const end = base.recurrenceEnd && base.recurrenceEnd < weekEnd ? base.recurrenceEnd : weekEnd;
    while (cursor <= end) {
      const key = `${base.id}|${cursor}`;
      if (!existing.has(key) && recurrenceMatches(base.date, cursor, base.recurrence)) {
        generated.push({
          ...base,
          id: uid(),
          date: cursor,
          completed: false,
          focusSeconds: 0,
          sessionSeconds: 0,
          recurrence: "none",
          recurrenceEnd: "",
          parentId: base.id,
          carriedTo: "",
          carriedFrom: "",
          reminderSent: false,
          createdAt: nowText(),
          updatedAt: nowText(),
        });
        existing.add(key);
        changed = true;
      }
      cursor = addDays(cursor, 1);
    }
  }
  if (generated.length) tasks = [...tasks, ...generated];

  if (input.settings.autoRollover && visibleDate === localISODate()) {
    const candidates = tasks.filter((task) => task.date < visibleDate && !task.completed && !task.carriedTo);
    if (candidates.length) {
      let cursor = Math.max(
        input.settings.axisStart,
        ...tasks.filter((task) => task.date === visibleDate).map((task) => task.startMinute + task.durationMinute),
      );
      const ids = new Map<string, string>();
      const carried: Task[] = candidates.map((source) => {
        const id = uid();
        ids.set(source.id, id);
        const startMinute = Math.min(
          Math.max(cursor, input.settings.axisStart),
          Math.max(input.settings.axisStart, input.settings.axisEnd - source.durationMinute),
        );
        cursor = startMinute + source.durationMinute;
        return {
          ...source,
          id,
          date: visibleDate,
          startMinute,
          completed: false,
          focusSeconds: 0,
          sessionSeconds: 0,
          recurrence: "none",
          recurrenceEnd: "",
          parentId: "",
          carriedTo: "",
          carriedFrom: source.id,
          reminderSent: false,
          createdAt: nowText(),
          updatedAt: nowText(),
        };
      });
      tasks = [
        ...tasks.map((task) => (ids.has(task.id) ? { ...task, carriedTo: ids.get(task.id)!, updatedAt: nowText() } : task)),
        ...carried,
      ];
      changed = true;
    }
  }
  return changed ? { ...input, tasks } : input;
}

function checkpoint(input: AppState) {
  const { runningTaskId, lastCheckpointAt } = input.timer;
  if (!runningTaskId || !lastCheckpointAt) return input;
  const delta = Math.max(0, (Date.now() - Date.parse(lastCheckpointAt)) / 1000);
  if (!Number.isFinite(delta)) return input;
  return {
    ...input,
    tasks: input.tasks.map((task) =>
      task.id === runningTaskId
        ? {
            ...task,
            focusSeconds: task.focusSeconds + delta,
            sessionSeconds: task.sessionSeconds + delta,
            updatedAt: nowText(),
          }
        : task,
    ),
    timer: { ...input.timer, lastCheckpointAt: nowText() },
  };
}

function desktopBackup(input: AppState) {
  return {
    version: 3,
    updated_at: nowText(),
    pet: input.pet,
    pomodoro: { ...input.pomodoro, running: false, checkpointAt: null },
    reviews: input.reviews,
    settings: {
      axis_start: input.settings.axisStart,
      axis_end: input.settings.axisEnd,
      segment_minutes: input.settings.segmentMinutes,
      auto_rollover: input.settings.autoRollover,
      theme: input.settings.theme === "system" ? "light" : input.settings.theme,
      always_on_top: false,
      minimize_to_tray: true,
    },
    timer: {
      running_task_id: null,
      last_selected_task_id: input.timer.lastSelectedTaskId,
      last_checkpoint_at: null,
    },
    tasks: input.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      date: task.date,
      start_minute: task.startMinute,
      duration_minute: task.durationMinute,
      category: task.category,
      color: task.color,
      completed: task.completed,
      focus_seconds: task.focusSeconds,
      session_seconds: task.sessionSeconds,
      recurrence: task.recurrence,
      recurrence_end: task.recurrenceEnd,
      parent_id: task.parentId,
      carried_to: task.carriedTo,
      carried_from: task.carriedFrom,
      reminder_minutes: task.reminderMinutes,
      reminder_sent: task.reminderSent,
      notes: task.notes,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
    })),
  };
}

export default function Home() {
  const isNative = Capacitor.isNativePlatform();
  const [data, setData] = useState<AppState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<ViewName>("today");
  const [currentDate, setCurrentDate] = useState(localISODate());
  const [historyDate, setHistoryDate] = useState(localISODate());
  const [statsPeriod, setStatsPeriod] = useState<"week" | "month">("week");
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<TaskDraft>(newDraft());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [reviewDate, setReviewDate] = useState(localISODate());
  const [reviewNote, setReviewNote] = useState("");
  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const [knowledgeFiles, setKnowledgeFiles] = useState<File[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewApiUrl, setReviewApiUrl] = useState(() => localStorage.getItem(REVIEW_API_KEY) ?? import.meta.env.VITE_REVIEW_API_URL ?? "");
  const [reviewToken, setReviewToken] = useState(() => localStorage.getItem(REVIEW_TOKEN_KEY) ?? "");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const restored = raw ? normalizeState(JSON.parse(raw)) : DEFAULT_STATE;
      setData(prepareState(restored, localISODate()));
    } catch {
      setData(DEFAULT_STATE);
      setToast("本地数据无法读取，已使用空计划启动");
    }
    setOnline(navigator.onLine);
    setHydrated(true);

    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    const installHandler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    window.addEventListener("beforeinstallprompt", installHandler);
    if (!Capacitor.isNativePlatform() && "serviceWorker" in navigator) navigator.serviceWorker.register(SERVICE_WORKER_PATH).catch(() => undefined);
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
      window.removeEventListener("beforeinstallprompt", installHandler);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !isNative) return;
    const syncNativeReminders = async () => {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== "granted") return;
      if (Capacitor.getPlatform() === "android") {
        await LocalNotifications.createChannel({
          id: "task-reminders",
          name: "任务提醒",
          description: "计划表任务开始提醒",
          importance: 5,
        });
      }
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) {
        await LocalNotifications.cancel({ notifications: pending.notifications.map(({ id }) => ({ id })) });
      }
      const notifications = data.tasks
        .filter((task) => !task.completed)
        .map((task) => {
          const start = new Date(`${task.date}T${minutesToTime(task.startMinute)}:00`);
          return { task, at: new Date(start.getTime() - task.reminderMinutes * 60_000) };
        })
        .filter(({ at }) => at.getTime() > Date.now())
        .slice(0, 60)
        .map(({ task, at }) => ({
          id: Math.abs([...task.id].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) | 0, 7)) || 7,
          title: "计划表提醒",
          body: `${minutesToTime(task.startMinute)} ${task.title}`,
          schedule: { at, allowWhileIdle: true },
          channelId: Capacitor.getPlatform() === "android" ? "task-reminders" : undefined,
          extra: { taskId: task.id },
        }));
      if (notifications.length) await LocalNotifications.schedule({ notifications });
    };
    const timer = window.setTimeout(() => syncNativeReminders().catch(() => undefined), 500);
    return () => window.clearTimeout(timer);
  }, [data.tasks, hydrated, isNative]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  useEffect(() => {
    localStorage.setItem(REVIEW_API_KEY, reviewApiUrl);
    localStorage.setItem(REVIEW_TOKEN_KEY, reviewToken);
  }, [reviewApiUrl, reviewToken]);

  useEffect(() => {
    const effective = data.settings.theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : data.settings.theme;
    document.documentElement.dataset.theme = effective;
  }, [data.settings.theme]);

  useEffect(() => {
    if (!hydrated) return;
    setData((previous) => prepareState(previous, currentDate));
  }, [currentDate, hydrated]);

  useEffect(() => {
    const timer = window.setInterval(() => setData((previous) => {
      const focused = checkpoint(previous);
      const pomodoro = checkpointPomodoro(focused.pomodoro);
      return pomodoro === focused.pomodoro ? focused : { ...focused, pomodoro };
    }), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!hydrated) return;
    const inspect = () => {
      const now = new Date();
      const today = localISODate(now);
      const reminders = data.tasks.filter((task) => {
        if (task.date !== today || task.completed || task.reminderSent) return false;
        const start = new Date(`${today}T${minutesToTime(task.startMinute)}:00`);
        const due = start.getTime() - task.reminderMinutes * 60_000;
        return now.getTime() >= due && now.getTime() <= start.getTime() + task.durationMinute * 60_000;
      });
      if (!reminders.length) return;
      setData((previous) => ({
        ...previous,
        tasks: previous.tasks.map((task) =>
          reminders.some((item) => item.id === task.id) ? { ...task, reminderSent: true } : task,
        ),
      }));
      const message = reminders.map((task) => `${minutesToTime(task.startMinute)} ${task.title}`).join("、");
      setToast(`任务提醒：${message}`);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("计划表提醒", { body: message, icon: "/icon-192.png" });
      }
    };
    inspect();
    const timer = window.setInterval(inspect, 20_000);
    return () => window.clearInterval(timer);
  }, [data.tasks, hydrated]);

  const activeTask = data.tasks.find((task) => task.id === data.timer.lastSelectedTaskId) ?? null;
  const runningTask = data.tasks.find((task) => task.id === data.timer.runningTaskId) ?? null;
  const dayTasks = useMemo(
    () => data.tasks.filter((task) => task.date === currentDate).sort((a, b) => a.startMinute - b.startMinute),
    [data.tasks, currentDate],
  );
  const weekStart = startOfWeek(currentDate);
  const weekEnd = addDays(weekStart, 6);
  const weekTasks = useMemo(
    () => data.tasks.filter((task) => task.date >= weekStart && task.date <= weekEnd),
    [data.tasks, weekStart, weekEnd],
  );

  const rangeStart = statsPeriod === "week" ? weekStart : startOfMonth(currentDate);
  const rangeEnd = statsPeriod === "week" ? weekEnd : endOfMonth(currentDate);
  const statsTasks = data.tasks.filter((task) => task.date >= rangeStart && task.date <= rangeEnd);
  const completedCount = statsTasks.filter((task) => task.completed).length;
  const completionRate = statsTasks.length ? completedCount / statsTasks.length : 0;
  const categoryStats = Object.entries(
    statsTasks.reduce<Record<string, number>>((result, task) => {
      result[task.category] = (result[task.category] ?? 0) + task.focusSeconds;
      return result;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const maxCategory = Math.max(1, ...categoryStats.map((item) => item[1]));
  const petLevel = Math.floor(data.pet.food / 5) + 1;
  const petProgress = data.pet.food % 5;
  const todayCompleted = data.tasks.filter((task) => task.date === localISODate() && task.completed).length;
  const pomodoroTotal = Math.max(1, pomodoroDuration(data.pomodoro));
  const pomodoroProgress = Math.max(0, Math.min(1, 1 - data.pomodoro.remainingSeconds / pomodoroTotal));
  const currentReview = [...data.reviews].reverse().find((item) => item.date === reviewDate) ?? null;
  const reviewTasks = data.tasks.filter((task) => task.date === reviewDate);

  function selectTask(task: Task) {
    if (selectionMode) {
      setSelectedIds((previous) => previous.includes(task.id) ? previous.filter((id) => id !== task.id) : [...previous, task.id]);
      return;
    }
    setData((previous) => ({ ...previous, timer: { ...previous.timer, lastSelectedTaskId: task.id } }));
  }

  function openNew(date = currentDate, startMinute?: number) {
    const now = new Date();
    const suggested = date === localISODate()
      ? Math.ceil((now.getHours() * 60 + now.getMinutes()) / data.settings.segmentMinutes) * data.settings.segmentMinutes
      : 9 * 60;
    setDraft(newDraft(date, startMinute ?? Math.min(suggested, 23 * 60 + 45)));
    setEditingId("new");
  }

  function openEdit(task: Task) {
    setDraft(draftFromTask(task));
    setEditingId(task.id);
  }

  function saveTask(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) {
      setToast("请输入任务名称");
      return;
    }
    const stamp = nowText();
    setData((previous) => {
      if (editingId && editingId !== "new") {
        const original = previous.tasks.find((task) => task.id === editingId);
        return {
          ...previous,
          pet: original && !original.completed && draft.completed
            ? feedPet(previous.pet, original.id, localISODate())
            : previous.pet,
          tasks: previous.tasks.map((task) => task.id === editingId ? {
            ...task,
            title: draft.title.trim(),
            date: draft.date,
            startMinute: timeToMinutes(draft.time),
            durationMinute: Math.max(15, Number(draft.durationMinute)),
            category: draft.category,
            color: draft.color,
            recurrence: draft.recurrence,
            recurrenceEnd: draft.recurrenceEnd,
            reminderMinutes: Number(draft.reminderMinutes),
            reminderSent: false,
            notes: draft.notes,
            completed: draft.completed,
            updatedAt: stamp,
          } : task),
        };
      }
      const task: Task = {
        id: uid(),
        title: draft.title.trim(),
        date: draft.date,
        startMinute: timeToMinutes(draft.time),
        durationMinute: Math.max(15, Number(draft.durationMinute)),
        category: draft.category,
        color: draft.color,
        completed: draft.completed,
        focusSeconds: 0,
        sessionSeconds: 0,
        recurrence: draft.recurrence,
        recurrenceEnd: draft.recurrenceEnd,
        parentId: "",
        carriedTo: "",
        carriedFrom: "",
        reminderMinutes: Number(draft.reminderMinutes),
        reminderSent: false,
        notes: draft.notes,
        createdAt: stamp,
        updatedAt: stamp,
      };
      return prepareState({
        ...previous,
        tasks: [...previous.tasks, task],
        timer: { ...previous.timer, lastSelectedTaskId: task.id },
      }, currentDate);
    });
    setEditingId(null);
    setToast(editingId === "new" ? "任务已创建" : "任务已更新");
  }

  function toggleComplete(taskId: string) {
    const willFeed = data.tasks.some((task) => task.id === taskId && !task.completed && !data.pet.fedTaskIds.includes(taskId));
    setData((previous) => {
      const target = previous.tasks.find((task) => task.id === taskId);
      const completing = Boolean(target && !target.completed);
      return {
        ...previous,
        pet: completing ? feedPet(previous.pet, taskId, localISODate()) : previous.pet,
        tasks: previous.tasks.map((task) => task.id === taskId ? { ...task, completed: !task.completed, updatedAt: nowText() } : task),
      };
    });
    if (willFeed) setToast("任务完成！小淇收到一份小鱼干 ♡");
  }

  function deleteTasks(ids: string[]) {
    if (!ids.length || !window.confirm(`确定删除 ${ids.length} 个任务吗？`)) return;
    setData((previous) => ({
      ...previous,
      tasks: previous.tasks.filter((task) => !ids.includes(task.id)),
      timer: {
        runningTaskId: ids.includes(previous.timer.runningTaskId ?? "") ? null : previous.timer.runningTaskId,
        lastSelectedTaskId: ids.includes(previous.timer.lastSelectedTaskId ?? "") ? null : previous.timer.lastSelectedTaskId,
        lastCheckpointAt: ids.includes(previous.timer.runningTaskId ?? "") ? null : previous.timer.lastCheckpointAt,
      },
    }));
    setSelectedIds([]);
    setSelectionMode(false);
    setEditingId(null);
    setToast("任务已删除");
  }

  function batchCopy() {
    if (!selectedIds.length) return;
    const target = window.prompt("复制到哪个起始日期？", addDays(localISODate(), 1));
    if (!target || !/^\d{4}-\d{2}-\d{2}$/.test(target)) return;
    setData((previous) => {
      const source = previous.tasks.filter((task) => selectedIds.includes(task.id));
      const earliest = source.map((task) => task.date).sort()[0];
      const copies = source.map((task) => {
        const offset = Math.round((parseDate(task.date).getTime() - parseDate(earliest).getTime()) / 86_400_000);
        return {
          ...task,
          id: uid(),
          date: addDays(target, offset),
          completed: false,
          focusSeconds: 0,
          sessionSeconds: 0,
          recurrence: "none" as Recurrence,
          recurrenceEnd: "",
          parentId: "",
          carriedTo: "",
          carriedFrom: "",
          reminderSent: false,
          createdAt: nowText(),
          updatedAt: nowText(),
        };
      });
      return { ...previous, tasks: [...previous.tasks, ...copies] };
    });
    setSelectedIds([]);
    setSelectionMode(false);
    setToast("任务已复制");
  }

  function toggleTimer() {
    if (!activeTask) return;
    setData((previous) => {
      const saved = checkpoint(previous);
      if (saved.timer.runningTaskId === activeTask.id) {
        return { ...saved, timer: { ...saved.timer, runningTaskId: null, lastCheckpointAt: null } };
      }
      return {
        ...saved,
        timer: { runningTaskId: activeTask.id, lastSelectedTaskId: activeTask.id, lastCheckpointAt: nowText() },
      };
    });
  }

  function resetSession() {
    if (!activeTask || !window.confirm("只清零本次计时，累计专注不会删除。继续吗？")) return;
    setData((previous) => {
      const saved = checkpoint(previous);
      return {
        ...saved,
        tasks: saved.tasks.map((task) => task.id === activeTask.id ? { ...task, sessionSeconds: 0 } : task),
      };
    });
  }

  function choosePomodoro(mode: PomodoroMode) {
    setData((previous) => ({
      ...previous,
      pomodoro: {
        ...previous.pomodoro,
        mode,
        remainingSeconds: pomodoroDuration(previous.pomodoro, mode),
        running: false,
        checkpointAt: null,
      },
    }));
  }

  function togglePomodoro() {
    setData((previous) => {
      const saved = checkpointPomodoro(previous.pomodoro);
      const remainingSeconds = saved.remainingSeconds || pomodoroDuration(saved);
      return {
        ...previous,
        pomodoro: {
          ...saved,
          remainingSeconds,
          running: !saved.running,
          checkpointAt: saved.running ? null : nowText(),
        },
      };
    });
  }

  function resetPomodoro() {
    setData((previous) => ({
      ...previous,
      pomodoro: {
        ...previous.pomodoro,
        remainingSeconds: pomodoroDuration(previous.pomodoro),
        running: false,
        checkpointAt: null,
      },
    }));
  }

  function selectReviewFiles(files: FileList | null, kind: "review" | "knowledge") {
    const selected = Array.from(files ?? []);
    if (selected.some((file) => file.size > 8 * 1024 * 1024)) {
      setToast("单个文件不能超过 8MB");
      return;
    }
    const combined = kind === "review" ? [...selected, ...knowledgeFiles] : [...reviewFiles, ...selected];
    const total = combined.reduce((sum, file) => sum + file.size, 0);
    if (total > 20 * 1024 * 1024 || combined.length > 6) {
      setToast("一次最多 6 个文件，总计不超过 20MB");
      return;
    }
    if (kind === "review") setReviewFiles(selected);
    else setKnowledgeFiles(selected);
  }

  async function generateReview(event: FormEvent) {
    event.preventDefault();
    if (!reviewApiUrl.trim()) {
      setToast("请先填写学习复盘 API 地址");
      return;
    }
    if (!reviewNote.trim() && !reviewFiles.length && !reviewTasks.length) {
      setToast("请填写学习内容或添加材料");
      return;
    }
    const endpoint = reviewApiUrl.trim().replace(/\/$/, "").endsWith("/api/review")
      ? reviewApiUrl.trim()
      : `${reviewApiUrl.trim().replace(/\/$/, "")}/api/review`;
    const form = new FormData();
    form.set("date", reviewDate);
    form.set("notes", reviewNote.trim());
    form.set("tasks", JSON.stringify(reviewTasks.map((task) => ({
      title: task.title,
      category: task.category,
      completed: task.completed,
      focusMinutes: Math.round(task.focusSeconds / 60),
      notes: task.notes,
    }))));
    reviewFiles.forEach((file) => form.append("materials", file));
    knowledgeFiles.forEach((file) => form.append("knowledge", file));
    setReviewLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: reviewToken.trim() ? { "X-Review-Key": reviewToken.trim() } : undefined,
        body: form,
      });
      const payload = await response.json() as { report?: unknown; error?: string };
      if (!response.ok) throw new Error(payload.error || `请求失败（${response.status}）`);
      const normalized = normalizeReview(payload.report);
      if (!normalized) throw new Error("模型返回格式不正确");
      const report = { ...normalized, id: uid(), date: reviewDate, generatedAt: nowText() };
      setData((previous) => ({ ...previous, reviews: [...previous.reviews.filter((item) => item.date !== reviewDate), report] }));
      setToast("学习复盘完成，小淇整理好啦");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "学习复盘失败，请稍后重试");
    } finally {
      setReviewLoading(false);
    }
  }

  function dragStart(event: ReactPointerEvent, task: Task, mode: "move" | "resize") {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      id: task.id,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      dy: 0,
      baseDate: task.date,
      baseStart: task.startMinute,
      baseDuration: task.durationMinute,
    });
  }

  function dragMove(event: ReactPointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    setDrag({ ...drag, dx: event.clientX - drag.startX, dy: event.clientY - drag.startY });
  }

  function dragEnd(event: ReactPointerEvent, task: Task) {
    if (!drag || event.pointerId !== drag.pointerId || drag.id !== task.id) return;
    const moved = Math.abs(drag.dx) + Math.abs(drag.dy) > 8;
    if (!moved) {
      selectTask(task);
      setDrag(null);
      return;
    }
    const dayShift = drag.mode === "move" ? Math.round(drag.dx / DAY_WIDTH) : 0;
    const minuteShift = Math.round((drag.dy / PIXELS_PER_MINUTE) / data.settings.segmentMinutes) * data.settings.segmentMinutes;
    setData((previous) => ({
      ...previous,
      tasks: previous.tasks.map((item) => {
        if (item.id !== task.id) return item;
        if (drag.mode === "resize") {
          return { ...item, durationMinute: Math.max(15, drag.baseDuration + minuteShift), updatedAt: nowText() };
        }
        return {
          ...item,
          date: addDays(drag.baseDate, dayShift),
          startMinute: Math.max(previous.settings.axisStart, Math.min(previous.settings.axisEnd - item.durationMinute, drag.baseStart + minuteShift)),
          reminderSent: false,
          updatedAt: nowText(),
        };
      }),
    }));
    setDrag(null);
    setToast(drag.mode === "resize" ? "时长已调整" : "任务已移动");
  }

  function exportData() {
    const saved = checkpoint(data);
    setData(saved);
    const blob = new Blob([JSON.stringify(desktopBackup(saved), null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `计划表备份-${localISODate()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setToast("备份已导出，可导入桌面版");
  }

  function importData(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const restored = normalizeState(JSON.parse(String(reader.result)));
        if (!window.confirm(`将导入 ${restored.tasks.length} 个任务并替换当前数据，继续吗？`)) return;
        setData(prepareState(restored, localISODate()));
        setToast("备份导入成功");
      } catch {
        setToast("导入失败：文件格式不正确");
      }
    };
    reader.readAsText(file);
  }

  async function requestNotifications() {
    if (isNative) {
      const result = await LocalNotifications.requestPermissions();
      setToast(result.display === "granted" ? "系统任务提醒已开启" : "未获得通知权限");
      return;
    }
    if (!("Notification" in window)) {
      setToast("当前浏览器不支持系统通知");
      return;
    }
    const result = await Notification.requestPermission();
    setToast(result === "granted" ? "任务提醒已开启" : "未获得通知权限");
  }

  async function installApp() {
    if (!installPrompt) {
      setToast("iPhone：点浏览器分享按钮，再选“添加到主屏幕”");
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (!hydrated) {
    return <main className="boot-screen"><img className="boot-mark" src="/icon-192.png" alt="" /><p>小淇正在打开计划表…</p></main>;
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <img className="brand-mark" src="/icon-192.png" alt="" />
          <div><strong>小淇计划</strong><small>{AI_ENABLED ? (online ? "在线版 · 今天也要稳稳进步" : "当前离线 · 基础功能可用") : "离线版 · 数据只在本机"}</small></div>
        </div>
        <div className="header-actions">
          {!isNative && <button className="icon-button install-button" onClick={installApp} aria-label="安装到手机">安装</button>}
          <button className={`switch ${data.settings.autoRollover ? "on" : ""}`} onClick={() => setData((previous) => prepareState({ ...previous, settings: { ...previous.settings, autoRollover: !previous.settings.autoRollover } }, localISODate()))} aria-label="自动顺延">
            <span />顺延
          </button>
        </div>
      </header>

      {AI_ENABLED && !online && <div className="offline-banner">无网络也可继续使用，所有变更保存在本机</div>}

      <section className="view-content">
        {view === "today" && (
          <>
            <div className="date-navigator">
              <button onClick={() => setCurrentDate(addDays(currentDate, -1))}>‹</button>
              <button className="date-title" onClick={() => setCurrentDate(localISODate())}>
                <strong>{currentDate === localISODate() ? "今天" : dateLabel(currentDate)}</strong>
                <small>{currentDate}</small>
              </button>
              <button onClick={() => setCurrentDate(addDays(currentDate, 1))}>›</button>
            </div>

            <section className="pet-card">
              <div className="pet-avatar"><img src="/icon-192.png" alt="小淇猫咪" /><span>Lv.{petLevel}</span></div>
              <div className="pet-copy">
                <span className="eyebrow">STUDY BUDDY</span>
                <h1>{todayCompleted ? `小淇今天吃到 ${todayCompleted} 份小鱼干` : "小淇在等你一起学习"}</h1>
                <p>{data.pet.streak ? `已经连续打卡 ${data.pet.streak} 天，完成任务就能继续投喂。` : "完成一项学习任务，就可以投喂小淇。"}</p>
                <div className="pet-progress"><i style={{ width: `${petProgress / 5 * 100}%` }} /><span>{petProgress}/5 距离升级</span></div>
              </div>
              <button className="pet-focus-button" onClick={() => setView("pomodoro")}>去专注</button>
            </section>

            <div className="summary-card">
              <div><span>计划</span><strong>{dayTasks.length}</strong><small>项任务</small></div>
              <div><span>完成</span><strong>{dayTasks.filter((task) => task.completed).length}</strong><small>{dayTasks.length ? `${Math.round(dayTasks.filter((task) => task.completed).length / dayTasks.length * 100)}%` : "0%"}</small></div>
              <div><span>专注</span><strong>{Math.floor(dayTasks.reduce((sum, task) => sum + task.focusSeconds, 0) / 3600)}</strong><small>小时</small></div>
            </div>

            <div className="section-heading">
              <div><span className="eyebrow">DAY PLAN</span><h1>今日时间线</h1></div>
              <div className="heading-actions"><button className="text-button" onClick={() => setView("history")}>归档</button><button className={selectionMode ? "text-button active" : "text-button"} onClick={() => { setSelectionMode(!selectionMode); setSelectedIds([]); }}>{selectionMode ? "完成" : "多选"}</button></div>
            </div>

            <div className="timeline-list">
              {dayTasks.length === 0 && (
                <button className="empty-state" onClick={() => openNew()}>
                  <span>＋</span><strong>还没有计划</strong><small>点这里创建今天的第一项任务</small>
                </button>
              )}
              {dayTasks.map((task) => (
                <article
                  key={task.id}
                  className={`task-card ${task.completed ? "completed" : ""} ${activeTask?.id === task.id ? "active" : ""} ${selectedIds.includes(task.id) ? "selected" : ""}`}
                  style={{ "--task-color": task.color } as React.CSSProperties}
                  onClick={() => selectTask(task)}
                  onDoubleClick={() => openEdit(task)}
                >
                  <button className="complete-button" onClick={(event) => { event.stopPropagation(); toggleComplete(task.id); }} aria-label="完成任务">{task.completed ? "✓" : ""}</button>
                  <div className="task-time"><strong>{minutesToTime(task.startMinute)}</strong><small>{task.durationMinute} 分钟</small></div>
                  <div className="task-main">
                    <div className="task-title-row"><h2>{task.title}</h2>{data.timer.runningTaskId === task.id && <span className="running-dot">计时中</span>}</div>
                    <p><span>{task.category}</span>{task.carriedFrom && <span>顺延</span>}{task.parentId && <span>重复</span>}</p>
                    {task.notes && <small className="task-note">{task.notes}</small>}
                  </div>
                  <button className="more-button" onClick={(event) => { event.stopPropagation(); openEdit(task); }} aria-label="编辑任务">•••</button>
                </article>
              ))}
            </div>
          </>
        )}

        {view === "week" && (
          <>
            <div className="date-navigator compact">
              <button onClick={() => setCurrentDate(addDays(currentDate, -7))}>‹</button>
              <button className="date-title" onClick={() => setCurrentDate(localISODate())}>
                <strong>{dateLabel(weekStart)} — {dateLabel(weekEnd)}</strong>
                <small>长按任务块拖动，拖底边调整时长</small>
              </button>
              <button onClick={() => setCurrentDate(addDays(currentDate, 7))}>›</button>
            </div>
            <div className="week-scroll">
              <div className="week-board" style={{ width: TIME_LEFT + DAY_WIDTH * 7, height: WEEK_HEADER + (data.settings.axisEnd - data.settings.axisStart) * PIXELS_PER_MINUTE }}>
                <div className="week-corner" />
                {WEEKDAYS.map((name, index) => {
                  const day = addDays(weekStart, index);
                  return <button key={day} className={`week-day ${day === localISODate() ? "today" : ""}`} style={{ left: TIME_LEFT + index * DAY_WIDTH, width: DAY_WIDTH }} onClick={() => { setCurrentDate(day); setView("today"); }}><strong>周{name}</strong><span>{parseDate(day).getMonth() + 1}/{parseDate(day).getDate()}</span></button>;
                })}
                {Array.from({ length: Math.floor((data.settings.axisEnd - data.settings.axisStart) / data.settings.segmentMinutes) + 1 }, (_, index) => {
                  const minute = data.settings.axisStart + index * data.settings.segmentMinutes;
                  const top = WEEK_HEADER + (minute - data.settings.axisStart) * PIXELS_PER_MINUTE;
                  return <div className="week-line" key={minute} style={{ top }}><span>{minute % 60 === 0 ? minutesToTime(minute) : ""}</span></div>;
                })}
                {Array.from({ length: 8 }, (_, index) => <div key={index} className="week-column" style={{ left: TIME_LEFT + index * DAY_WIDTH }} />)}
                {weekTasks.map((task) => {
                  const dayIndex = Math.round((parseDate(task.date).getTime() - parseDate(weekStart).getTime()) / 86_400_000);
                  const activeDrag = drag?.id === task.id ? drag : null;
                  const baseTop = WEEK_HEADER + (task.startMinute - data.settings.axisStart) * PIXELS_PER_MINUTE;
                  const previewHeight = Math.max(22, task.durationMinute * PIXELS_PER_MINUTE + (activeDrag?.mode === "resize" ? activeDrag.dy : 0));
                  return (
                    <div
                      key={task.id}
                      className={`week-task ${task.completed ? "completed" : ""} ${activeTask?.id === task.id ? "active" : ""}`}
                      style={{
                        left: TIME_LEFT + dayIndex * DAY_WIDTH + 4,
                        top: baseTop,
                        width: DAY_WIDTH - 8,
                        height: previewHeight,
                        background: task.color,
                        transform: activeDrag?.mode === "move" ? `translate(${activeDrag.dx}px, ${activeDrag.dy}px)` : undefined,
                        zIndex: activeDrag ? 10 : 2,
                      }}
                      onPointerDown={(event) => dragStart(event, task, "move")}
                      onPointerMove={dragMove}
                      onPointerUp={(event) => dragEnd(event, task)}
                    >
                      <strong>{task.completed ? "✓ " : ""}{task.title}</strong>
                      <small>{minutesToTime(task.startMinute)} · {task.category}</small>
                      <span
                        className="resize-grip"
                        onPointerDown={(event) => dragStart(event, task, "resize")}
                        onPointerMove={(event) => { event.stopPropagation(); dragMove(event); }}
                        onPointerUp={(event) => { event.stopPropagation(); dragEnd(event, task); }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {view === "pomodoro" && (
          <>
            <div className="page-title pomodoro-title"><span className="eyebrow">POMODORO</span><h1>番茄专注屋</h1><p>一次只做好一件事，小淇会安静陪着你。</p></div>
            <div className="pomodoro-tabs">
              {([["focus", "专注 25"], ["short", "短休 5"], ["long", "长休 15"]] as [PomodoroMode, string][]).map(([mode, label]) => (
                <button key={mode} className={data.pomodoro.mode === mode ? "active" : ""} onClick={() => choosePomodoro(mode)}>{label}</button>
              ))}
            </div>
            <section className="pomodoro-card">
              <div className="focus-orbit" style={{ "--progress": `${pomodoroProgress * 360}deg` } as React.CSSProperties}>
                <div className="focus-clock">
                  <img src="/icon-192.png" alt="专注中的小淇" />
                  <small>{data.pomodoro.mode === "focus" ? "专注中" : "休息一下"}</small>
                  <strong>{durationText(data.pomodoro.remainingSeconds).slice(3)}</strong>
                </div>
              </div>
              <p>{activeTask ? `当前任务：${activeTask.title}` : "可先在今天页面选中一项任务"}</p>
              <div className="pomodoro-actions"><button className="soft-button" onClick={resetPomodoro}>重置</button><button className={`focus-main-button ${data.pomodoro.running ? "pause" : ""}`} onClick={togglePomodoro}>{data.pomodoro.running ? "暂停一下" : data.pomodoro.remainingSeconds ? "开始专注" : "再来一轮"}</button></div>
            </section>
            <div className="focus-stats">
              <div><strong>{data.pomodoro.completedSessions}</strong><span>累计番茄</span></div>
              <div><strong>{Math.round(data.pomodoro.completedSessions * data.pomodoro.focusMinutes / 60 * 10) / 10}</strong><span>专注小时</span></div>
              <div><strong>{data.pet.streak}</strong><span>连续打卡</span></div>
            </div>
            <div className="cute-tip"><span>🍅</span><div><strong>小淇的小提醒</strong><p>铃响后记得活动肩颈、看看远处。完成对应任务后，回到“今天”打勾投喂小淇。</p></div></div>
          </>
        )}

        {AI_ENABLED && view === "review" && (
          <>
            <div className="page-title review-title"><span className="eyebrow">408 REVIEW</span><h1>AI 学习复盘</h1><p>把当天笔记、题目和计划交给小淇，整理成清晰的下一步。</p></div>
            <label className="date-field"><span>复盘日期</span><input type="date" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} /></label>
            <div className="review-day-summary"><span>当日计划 <strong>{reviewTasks.length}</strong></span><span>完成 <strong>{reviewTasks.filter((task) => task.completed).length}</strong></span><span>专注 <strong>{Math.round(reviewTasks.reduce((sum, task) => sum + task.focusSeconds, 0) / 60)}</strong> 分钟</span></div>
            <form className="review-form" onSubmit={generateReview}>
              <label className="review-note"><span><strong>今天学了什么？</strong><small>可粘贴知识点、错题原因、疑问或自我感受</small></span><textarea rows={5} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="例如：复习了 TCP 拥塞控制，做题时对快重传和快恢复的触发条件还不够熟…" /></label>
              <div className="upload-grid">
                <label className="upload-card"><span className="upload-icon">＋</span><strong>添加今日材料</strong><small>图片、PDF、Word、表格等</small><input type="file" multiple accept="image/*,.pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.html,.xml,.odt,.ods" onChange={(event) => selectReviewFiles(event.target.files, "review")} /></label>
                <label className="upload-card knowledge"><span className="upload-icon">知</span><strong>添加 ima 408 资料</strong><small>从 ima 导出后在此选择</small><input type="file" multiple accept="image/*,.pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.html,.xml,.odt,.ods" onChange={(event) => selectReviewFiles(event.target.files, "knowledge")} /></label>
              </div>
              {(reviewFiles.length > 0 || knowledgeFiles.length > 0) && <div className="file-chips">{reviewFiles.map((file) => <span key={`r-${file.name}`}>今日 · {file.name}</span>)}{knowledgeFiles.map((file) => <span key={`k-${file.name}`}>ima · {file.name}</span>)}</div>}
              <details className="api-settings" open={!reviewApiUrl}>
                <summary>API 服务设置</summary>
                <label><span>服务地址</span><input type="url" value={reviewApiUrl} onChange={(event) => setReviewApiUrl(event.target.value)} placeholder="https://your-worker.workers.dev" /></label>
                <label><span>访问口令（可选）</span><input type="password" value={reviewToken} onChange={(event) => setReviewToken(event.target.value)} placeholder="与 Worker 的 REVIEW_API_KEY 一致" /></label>
                <p>模型密钥只放在服务端；App 只保存服务地址与可选访问口令。</p>
              </details>
              <button className="review-submit" type="submit" disabled={reviewLoading || !online}>{reviewLoading ? "小淇正在整理…" : online ? "生成今日复盘" : "联网后生成复盘"}</button>
            </form>

            {currentReview && (
              <section className="review-result">
                <div className="report-hero"><span>小淇的今日结论</span><h2>{currentReview.headline}</h2><p>{currentReview.summary}</p></div>
                <div className="report-columns">
                  <div className="report-card good"><h3>做得不错</h3>{currentReview.achievements.map((item) => <p key={item}>✓ {item}</p>)}</div>
                  <div className="report-card gap"><h3>需要补强</h3>{currentReview.gaps.map((item) => <p key={item}>• {item}</p>)}</div>
                  <div className="report-card action"><h3>下一步行动</h3>{currentReview.actions.map((item, index) => <p key={item}><b>{index + 1}</b>{item}</p>)}</div>
                </div>
                <div className="mind-map-card"><div><span className="eyebrow">MIND MAP</span><h3>今日知识地图</h3></div><div className="mind-map"><MindMap node={currentReview.mindMap} /></div></div>
                <blockquote>{currentReview.encouragement}</blockquote>
              </section>
            )}
          </>
        )}

        {view === "history" && (
          <>
            <div className="page-title"><span className="eyebrow">ARCHIVE</span><h1>历史归档</h1><p>每一天的计划、状态与专注记录都保存在本机。</p></div>
            <label className="date-field"><span>查看日期</span><input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} /></label>
            <div className="history-list">
              {data.tasks.filter((task) => task.date === historyDate).sort((a, b) => a.startMinute - b.startMinute).map((task) => (
                <button className="history-item" key={task.id} onClick={() => openEdit(task)}>
                  <i style={{ background: task.color }} />
                  <span><strong>{task.title}</strong><small>{minutesToTime(task.startMinute)}–{minutesToTime(task.startMinute + task.durationMinute)} · {task.category}</small></span>
                  <span className="history-result"><strong>{durationText(task.focusSeconds)}</strong><small>{task.completed ? "已完成" : task.carriedTo ? "已顺延" : "未完成"}</small></span>
                </button>
              ))}
              {!data.tasks.some((task) => task.date === historyDate) && <div className="plain-empty">这一天没有计划记录</div>}
            </div>
          </>
        )}

        {view === "stats" && (
          <>
            <div className="page-title"><span className="eyebrow">FOCUS REPORT</span><h1>专注统计</h1><p>{rangeStart} 至 {rangeEnd}</p></div>
            <div className="segmented"><button className={statsPeriod === "week" ? "active" : ""} onClick={() => setStatsPeriod("week")}>本周</button><button className={statsPeriod === "month" ? "active" : ""} onClick={() => setStatsPeriod("month")}>本月</button></div>
            <div className="stats-overview">
              <div className="rate-ring" style={{ "--rate": `${completionRate * 360}deg` } as React.CSSProperties}><span><strong>{Math.round(completionRate * 100)}%</strong><small>完成率</small></span></div>
              <div className="stats-numbers"><div><strong>{completedCount}<small> / {statsTasks.length}</small></strong><span>完成任务</span></div><div><strong>{durationText(statsTasks.reduce((sum, task) => sum + task.focusSeconds, 0))}</strong><span>专注时间</span></div></div>
            </div>
            <div className="chart-card"><h2>类别耗时</h2>{categoryStats.map(([category, seconds], index) => <div className="chart-row" key={category}><div><span>{category}</span><strong>{durationText(seconds)}</strong></div><div className="chart-track"><i style={{ width: `${seconds / maxCategory * 100}%`, background: COLORS[index % COLORS.length] }} /></div></div>)}{categoryStats.length === 0 && <div className="plain-empty">暂无专注数据</div>}</div>
          </>
        )}

        {view === "settings" && (
          <>
            <div className="page-title"><span className="eyebrow">PREFERENCES</span><h1>设置与数据</h1><p>设置和任务只保存在当前设备。</p></div>
            <div className="settings-card">
              <label><span><strong>主题</strong><small>跟随系统或固定配色</small></span><select value={data.settings.theme} onChange={(event) => setData((previous) => ({ ...previous, settings: { ...previous.settings, theme: event.target.value as Theme } }))}><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label>
              <label><span><strong>时间轴起点</strong><small>{minutesToTime(data.settings.axisStart)}</small></span><input type="time" value={minutesToTime(data.settings.axisStart)} onChange={(event) => setData((previous) => ({ ...previous, settings: { ...previous.settings, axisStart: timeToMinutes(event.target.value) } }))} /></label>
              <label><span><strong>时间轴终点</strong><small>{minutesToTime(data.settings.axisEnd)}</small></span><input type="time" value={data.settings.axisEnd === 1440 ? "23:59" : minutesToTime(data.settings.axisEnd)} onChange={(event) => setData((previous) => ({ ...previous, settings: { ...previous.settings, axisEnd: Math.max(previous.settings.axisStart + 60, timeToMinutes(event.target.value)) } }))} /></label>
              <label><span><strong>网格分段</strong><small>拖拽吸附精度</small></span><select value={data.settings.segmentMinutes} onChange={(event) => setData((previous) => ({ ...previous, settings: { ...previous.settings, segmentMinutes: Number(event.target.value) as 15 | 30 | 60 } }))}><option value={15}>15 分钟</option><option value={30}>30 分钟</option><option value={60}>60 分钟</option></select></label>
              <label><span><strong>番茄专注时长</strong><small>每轮完整专注</small></span><select value={data.pomodoro.focusMinutes} onChange={(event) => setData((previous) => { const focusMinutes = Number(event.target.value); return { ...previous, pomodoro: { ...previous.pomodoro, focusMinutes, remainingSeconds: previous.pomodoro.mode === "focus" ? focusMinutes * 60 : previous.pomodoro.remainingSeconds, running: false, checkpointAt: null } }; })}>{[20, 25, 30, 45, 50].map((value) => <option key={value} value={value}>{value} 分钟</option>)}</select></label>
              <label><span><strong>短休时长</strong><small>专注间隙放松</small></span><select value={data.pomodoro.shortMinutes} onChange={(event) => setData((previous) => { const shortMinutes = Number(event.target.value); return { ...previous, pomodoro: { ...previous.pomodoro, shortMinutes, remainingSeconds: previous.pomodoro.mode === "short" ? shortMinutes * 60 : previous.pomodoro.remainingSeconds, running: false, checkpointAt: null } }; })}>{[5, 10, 15].map((value) => <option key={value} value={value}>{value} 分钟</option>)}</select></label>
              <label><span><strong>自动顺延</strong><small>旧未完成任务移到今天末尾</small></span><button className={`switch bare ${data.settings.autoRollover ? "on" : ""}`} onClick={() => setData((previous) => prepareState({ ...previous, settings: { ...previous.settings, autoRollover: !previous.settings.autoRollover } }, localISODate()))}><span /></button></label>
            </div>
            <div className="settings-card action-list">
              <button onClick={requestNotifications}><span><strong>开启任务提醒</strong><small>应用打开或在后台存活时提醒</small></span><b>›</b></button>
              {!isNative && <button onClick={installApp}><span><strong>安装到手机桌面</strong><small>获得全屏体验和离线入口</small></span><b>›</b></button>}
              <button onClick={() => setView("history")}><span><strong>查看历史归档</strong><small>按日期回看完成与专注记录</small></span><b>›</b></button>
              <button onClick={exportData}><span><strong>导出 JSON 备份</strong><small>与 Windows 桌面版互相导入</small></span><b>›</b></button>
              <button onClick={() => importRef.current?.click()}><span><strong>导入 JSON 备份</strong><small>导入前请先导出当前数据</small></span><b>›</b></button>
              <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => importData(event.target.files?.[0])} />
            </div>
            {AI_ENABLED
              ? <div className="privacy-note"><strong>本地优先，主动提交</strong><p>任务、宠物和复盘结果默认保存在本机；只有点击“生成今日复盘”时，所选内容才会发送到你配置的 API。请定期导出备份。</p></div>
              : <div className="privacy-note"><strong>离线版 · 数据不出设备</strong><p>此版本不包含 AI 复盘，也不申请联网权限。任务、番茄钟和小淇成长数据只保存在当前设备，请定期导出备份。</p></div>}
          </>
        )}
      </section>

      {selectedIds.length > 0 && (
        <div className="bulk-bar"><strong>已选 {selectedIds.length} 项</strong><button onClick={batchCopy}>复制</button><button className="danger" onClick={() => deleteTasks(selectedIds)}>删除</button></div>
      )}

      {activeTask && !selectionMode && (view === "today" || view === "week") && (
        <aside className="timer-dock">
          <button className="timer-info" onClick={() => openEdit(activeTask)}><span className={runningTask?.id === activeTask.id ? "pulse" : ""} style={{ background: activeTask.color }} /><span><strong>{activeTask.title}</strong><small>累计 {durationText(activeTask.focusSeconds)}</small></span></button>
          <strong className="timer-value">{durationText(activeTask.sessionSeconds)}</strong>
          <button className="reset-timer" onClick={resetSession}>重置</button>
          <button className={`timer-control ${runningTask?.id === activeTask.id ? "pause" : ""}`} onClick={toggleTimer}>{runningTask?.id === activeTask.id ? "Ⅱ" : "▶"}</button>
        </aside>
      )}

      {(view === "today" || view === "week") && <button className="fab" onClick={() => openNew()} aria-label="新建任务">＋</button>}

      <nav className={`bottom-nav ${AI_ENABLED ? "online" : "offline"}`}>
        {([
          ["today", "今", "今天"], ["week", "周", "周表"], ["pomodoro", "番", "专注"], ...(AI_ENABLED ? [["review", "AI", "复盘"]] : []), ["stats", "图", "统计"], ["settings", "设", "设置"],
        ] as [ViewName, string, string][]).map(([name, icon, label]) => <button key={name} className={view === name ? "active" : ""} onClick={() => setView(name)}><span>{icon}</span><small>{label}</small></button>)}
      </nav>

      {editingId && (
        <div className="modal-backdrop" onClick={() => setEditingId(null)}>
          <form className="task-sheet" onSubmit={saveTask} onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" /><div className="sheet-title"><div><span className="eyebrow">TASK</span><h2>{editingId === "new" ? "新建任务" : "编辑任务"}</h2></div><button type="button" onClick={() => setEditingId(null)}>×</button></div>
            <label className="full-field"><span>任务名称</span><input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="准备完成什么？" /></label>
            <div className="form-grid"><label><span>日期</span><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label><span>开始</span><input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} /></label><label><span>时长</span><select value={draft.durationMinute} onChange={(event) => setDraft({ ...draft, durationMinute: Number(event.target.value) })}>{[15, 30, 45, 60, 90, 120, 180].map((value) => <option key={value} value={value}>{value} 分钟</option>)}</select></label><label><span>类别</span><input list="category-list" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /><datalist id="category-list">{CATEGORIES.map((value) => <option key={value}>{value}</option>)}</datalist></label></div>
            <div className="color-field"><span>颜色标签</span><div>{COLORS.map((color) => <button type="button" aria-label={color} key={color} className={draft.color === color ? "active" : ""} style={{ background: color }} onClick={() => setDraft({ ...draft, color })} />)}<input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /></div></div>
            <div className="form-grid"><label><span>重复</span><select value={draft.recurrence} onChange={(event) => setDraft({ ...draft, recurrence: event.target.value as Recurrence })}><option value="none">不重复</option><option value="daily">每天</option><option value="weekdays">工作日</option><option value="weekly">每周</option><option value="monthly">每月</option></select></label><label><span>重复截止</span><input type="date" value={draft.recurrenceEnd} onChange={(event) => setDraft({ ...draft, recurrenceEnd: event.target.value })} /></label><label><span>提前提醒</span><select value={draft.reminderMinutes} onChange={(event) => setDraft({ ...draft, reminderMinutes: Number(event.target.value) })}>{[0, 5, 10, 15, 30, 60].map((value) => <option key={value} value={value}>{value === 0 ? "开始时" : `${value} 分钟`}</option>)}</select></label><label className="check-label"><span>已完成</span><input type="checkbox" checked={draft.completed} onChange={(event) => setDraft({ ...draft, completed: event.target.checked })} /></label></div>
            <label className="full-field"><span>备注</span><textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="可选" rows={2} /></label>
            <div className="sheet-actions">{editingId !== "new" && <button type="button" className="delete-button" onClick={() => deleteTasks([editingId])}>删除</button>}<button type="submit" className="save-button">保存任务</button></div>
          </form>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
