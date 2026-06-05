import { createDefaultState } from "../data/defaultData";
import type { AppState } from "../types";

export interface AppRepository {
  load(): AppState;
  save(state: AppState): void;
  reset(): AppState;
}

const STORAGE_KEY = "uec-timetable-state-v1";

const isBrowser = () => typeof window !== "undefined" && "localStorage" in window;

export class LocalStorageRepository implements AppRepository {
  load(): AppState {
    if (!isBrowser()) return createDefaultState();
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    try {
      const defaults = createDefaultState();
      const parsed = JSON.parse(raw) as Partial<AppState>;
      return {
        ...defaults,
        ...parsed,
        settings: { ...defaults.settings, ...parsed.settings },
        courses: parsed.courses ?? defaults.courses,
        classrooms: parsed.classrooms ?? defaults.classrooms,
        assignments: parsed.assignments ?? defaults.assignments,
      } as AppState;
    } catch {
      return createDefaultState();
    }
  }

  save(state: AppState): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  reset(): AppState {
    const state = createDefaultState();
    if (isBrowser()) window.localStorage.removeItem(STORAGE_KEY);
    return state;
  }
}

export const repository = new LocalStorageRepository();
