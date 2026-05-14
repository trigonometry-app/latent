/** The kind of test administered */
export type TestType = 'SAT' | 'PSAT' | 'StateTest' | 'AP';

/** Which section of a test */
export type Subject = 'math' | 'english';

/** A single test score entry */
export interface TestScore {
  id: string;
  type: TestType;
  subject: Subject;
  score: number;
  year: number;
  /** Optional label, e.g. "AP Calculus BC" */
  label?: string;
  /** Grade level when test was taken (for StateTest percentile lookups) */
  grade?: number;
}

/** Rigor data for one school year. Year is stored as "YY-YY" (e.g. "24-25"). */
export interface CourseHistoryEntry {
  year: string;
  apCount: number;
}

/** A computed row shown in the results table */
export interface ComputedRow {
  label: string;
  raw: number;
  zScore: number;
  percentile: number;
  category: 'english' | 'math' | 'gpa' | 'rigor' | 'test' | 'rigor-year';
  year?: string;
  type?: TestType;
  /** Whether this row is the "used" value for its category */
  isUsed?: boolean;
  /** Weight in the latent composite (e.g. 0.1 for 10%) */
  weight?: number;
}
