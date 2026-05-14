import type { TestScore, CourseHistoryEntry } from './types';
import { computeAll, type ComputedOutput } from './percentiles';

// ─── Reactive state (Svelte 5 runes) ────────────────────────────────────────

let tests = $state<TestScore[]>([]);
let gpa = $state<number | null>(null);
let courseHistory = $state<CourseHistoryEntry[]>([]);

// ─── Getters / setters ──────────────────────────────────────────────────────

export function getTests(): TestScore[] {
  return tests;
}

export function addTest(test: TestScore): void {
  tests = [...tests, test];
}

export function removeTest(id: string): void {
  tests = tests.filter((t) => t.id !== id);
}

export function getGpa(): number | null {
  return gpa;
}

export function setGpa(value: number | null): void {
  gpa = value;
}

export function getCourseHistory(): CourseHistoryEntry[] {
  return courseHistory;
}

export function setCourseHistory(entries: CourseHistoryEntry[]): void {
  courseHistory = entries;
}

// ─── Derived computation ────────────────────────────────────────────────────

let cached = $derived<ComputedOutput>(computeAll(tests, gpa, courseHistory));

export function getComputed(): ComputedOutput {
  return cached;
}
