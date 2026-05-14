import { fn } from 'monoserve';
import { string, optional, object, parse, array, number } from 'valibot';
import type { TestScore, CourseHistoryEntry } from './types';

// ─── Input schema ───────────────────────────────────────────────────────────
// The client can optionally pass credentials. If omitted, we read from env.
const InputSchema = object({
  email: optional(string()),
  password: optional(string()),
});

// ─── StudentVue helpers ─────────────────────────────────────────────────────

const SV_BASE = 'https://wa-nor-psv.edupoint.com';

async function soapCall(
  baseUrl: string,
  userId: string,
  password: string,
  methodName: string,
  params: Record<string, string> = {},
): Promise<string> {
  const body = new URLSearchParams({
    userID: userId,
    password,
    skipLoginLog: 'true',
    parent: 'false',
    webServiceHandleName: 'PXPWebServices',
    methodName,
    paramStr: `<Parms>${Object.entries(params)
      .map(([k, v]) => `<${k}>${v}</${k}>`)
      .join('')}</Parms>`,
  });
  const r = await fetch(
    `${baseUrl}/Service/PXPCommunication.asmx/ProcessWebServiceRequest`,
    { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } },
  );
  const text = await r.text();
  const chunked = text.split(`<string xmlns="http://edupoint.com/webservices/">`);
  if (chunked.length !== 2)
    throw new Error(`StudentVue error: malformed response (status ${r.status})`);
  return chunked[1]
    .split('</string>')[0]
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

async function getAuthToken(
  baseUrl: string,
  userId: string,
  password: string,
): Promise<string> {
  const xml = await soapCall(baseUrl, userId, password, 'GenerateAuthToken', {
    Username: '',
    TokenForClassWebSite: 'true',
    DocumentID: '1',
    AssignmentID: '1',
  });
  const match = xml.match(/EncyToken="([^"]+)"/);
  if (!match) throw new Error('Failed to get auth token');
  return match[1];
}

async function fetchPageWithToken(
  baseUrl: string,
  token: string,
  page: string,
): Promise<string> {
  const url = new URL(`${baseUrl}/${page}`);
  url.searchParams.set('AGU', '0');
  url.searchParams.set('token', token);
  const r = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
  return r.text();
}

// ─── Data extraction ────────────────────────────────────────────────────────

interface CHCourse {
  CourseID: string;
  CourseTitle: string;
  CreditsAttempted: string;
  CreditsCompleted: string;
  VerifiedCredit: string;
  Mark: string;
  CHSType: string;
}

interface CHTerm {
  SchoolName: string;
  Year: string;
  TermName: string;
  TermOrder: number;
  Courses: CHCourse[];
}

interface CHGradeEntry {
  Grade: string;
  GradeLevelOrder: number;
  Terms: CHTerm[];
}

function extractGpa(html: string): number | null {
  const match = html.match(/<span class="gpa-score">([^<]+)<\/span>/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  return isNaN(val) ? null : val;
}

/** Build a map: school-year spring year → grade level */
function extractGradeLookup(html: string): Map<number, number> {
  const map = new Map<number, number>();
  const jsonMatch = html.match(/\.CourseHistory\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!jsonMatch) return map;
  try {
    const entries: CHGradeEntry[] = JSON.parse(jsonMatch[1]);
    for (const entry of entries) {
      const grade = parseInt(entry.Grade, 10);
      if (isNaN(grade)) continue;
      for (const term of entry.Terms) {
        const springYear = parseInt(term.Year, 10);
        if (!isNaN(springYear)) map.set(springYear, grade);
      }
    }
  } catch { /* ignore */ }
  return map;
}

function extractCourseHistory(html: string): CourseHistoryEntry[] {
  const jsonMatch = html.match(/\.CourseHistory\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!jsonMatch) return [];

  let entries: CHGradeEntry[];
  try {
    entries = JSON.parse(jsonMatch[1]);
  } catch {
    return [];
  }

  const hsEntries = entries.filter((e) => {
    const g = parseInt(e.Grade, 10);
    return g >= 9 && g <= 12;
  });

  return hsEntries.map((entry) => {
    const years = new Set(entry.Terms.map((t) => t.Year));
    const apCourses = new Set<string>();
    for (const term of entry.Terms) {
      for (const course of term.Courses) {
        const ct = course.CourseTitle.trim();
        // Real AP courses start with "AP " followed by a subject name (not "PREP")
        const isRealAp = ct.startsWith('AP ') && !ct.startsWith('AP PREP');
        if (isRealAp) {
          // Strip trailing A/B suffix that differs between S1 and S2
          const baseId = course.CourseID.replace(/[A-Z]$/, '');
          apCourses.add(baseId);
        }
      }
    }
    // API years are the spring/end year of a school year (e.g. 2025 = 2024-25)
    const springYear = parseInt([...years][0] || '0', 10);
    const start = springYear - 1;
    const yearStr = `${String(start).slice(-2)}-${String(springYear).slice(-2)}`;
    return { year: yearStr, apCount: apCourses.size };
  });
}

// ─── Test score extraction ──────────────────────────────────────────────────

interface TestGridRow {
  TestPart?: string;
  SchoolName?: string;
  AdminDate?: string;
  Level?: string;
  /** Smarter Balanced scaled score */
  'Scaled Score'?: string;
  /** WA Science */
  'Scaled Score'?: string;
  Claims?: string;
  Concepts?: string;
  Placement?: string;
  'Relative Placement'?: string;
}

interface AvailableTest {
  GU: string;
  Name: string;
  GridData: TestGridRow[];
}

interface TestApiResponse {
  availableTests: AvailableTest[];
}

async function fetchTestScores(baseUrl: string, cookie: string, gradeLookup: Map<number, number>): Promise<TestScore[]> {
  const scores: TestScore[] = [];

  try {
    const r = await fetch(
      `${baseUrl}/api/GB/ClientSideData/Transfer?action=pxp.test.analysis-get`,
      {
        method: 'POST',
        headers: {
          accept: 'application/json, text/javascript, */*; q=0.01',
          'content-type': 'application/json; charset=utf-8',
          'CURRENT_WEB_PORTAL': 'StudentVUE',
          'X-Requested-With': 'XMLHttpRequest',
          cookie,
          referer: `${baseUrl}/PXP2_TestHistory.aspx?AGU=0`,
        },
        body: JSON.stringify({
          FriendlyName: 'pxp.test.analysis',
          Method: 'get',
          Parameters: '{}',
        }),
      },
    );

    if (!r.ok) return scores;

    const json: TestApiResponse = await r.json();
    const availableTests = json.availableTests ?? [];

    for (const test of availableTests) {
      const name = test.Name;

      // Parse Smarter Balanced (SBA) state test scores
      if (name.includes('Smarter Balanced')) {
        for (const row of test.GridData) {
          const scaled = row['Scaled Score'];
          const part = row.TestPart;
          if (!scaled || !part) continue;

          // Extract year from AdminDate
          const year = parseTestYear(row.AdminDate);
          if (!year) continue;

          // Determine grade level from test date
          const month = parseTestMonth(row.AdminDate);
          // Spring (Jan-Jun) tests belong to school year ending `year`;
          // Fall (Jul-Dec) tests belong to school year ending `year + 1`
          const springYear = month !== null && month >= 7 ? year + 1 : year;
          const grade = gradeLookup.get(springYear) ?? undefined;

          if (part === 'ELA') {
            scores.push({
              id: crypto.randomUUID(),
              type: 'StateTest',
              subject: 'english',
              score: parseInt(scaled, 10),
              year,
              grade,
              label: 'SBA ELA',
            });
          } else if (part === 'Math') {
            scores.push({
              id: crypto.randomUUID(),
              type: 'StateTest',
              subject: 'math',
              score: parseInt(scaled, 10),
              year,
              grade,
              label: 'SBA Math',
            });
          }
        }
      }

      // TODO: Parse PSAT scores when available
      // TODO: Parse SAT scores when available
    }
  } catch {
    // Test data is non-critical; silently return empty
  }

  return scores;
}

function parseTestYear(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  // Format: "5/1/2019 12:00:00 AM"
  const m = dateStr.match(/\b(\d{4})\b/);
  return m ? parseInt(m[1], 10) : null;
}

function parseTestMonth(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  // Format: "5/1/2019 12:00:00 AM" → month = 5
  const m = dateStr.match(/^(\d{1,2})\//);
  return m ? parseInt(m[1], 10) : null;
}

// ─── Output schema ──────────────────────────────────────────────────────────

interface LoadResult {
  gpa: number | null;
  courseHistory: CourseHistoryEntry[];
  tests: TestScore[];
}

// ─── RPC function ───────────────────────────────────────────────────────────

export default fn(InputSchema, async (input): Promise<LoadResult> => {
  // Resolve credentials: passed arg > env var
  let { email, password } = input;

  if (!email || !password) {
    // Read from server-side env (never exposed to client)
    const env = await import('$env/static/private');
    email = email || env.SV_EMAIL || env.TEST_ONLY_EMAIL;
    password = password || env.SV_PASSWORD || env.TEST_ONLY_PASSWORD;
  }

  if (!email || !password) {
    throw new Error(
      'StudentVue credentials not configured. ' +
        'Set SV_EMAIL and SV_PASSWORD in .env, or pass them to the function.',
    );
  }

  const baseUrl = SV_BASE;
  const userId = email.split('@')[0];

  // 1) Auth token
  const token = await getAuthToken(baseUrl, userId, password);

  // 2) Course History page
  const chHtml = await fetchPageWithToken(baseUrl, token, 'PXP2_CourseHistory.aspx');
  const gpa = extractGpa(chHtml);
  const courseHistory = extractCourseHistory(chHtml);
  const gradeLookup = extractGradeLookup(chHtml);

  // 3) Test History page → get cookies for API call (fresh token needed)
  const testToken = await getAuthToken(baseUrl, userId, password);
  const testUrl = new URL(`${baseUrl}/PXP2_TestHistory.aspx`);
  testUrl.searchParams.set('AGU', '0');
  testUrl.searchParams.set('token', testToken);
  const testPageRes = await fetch(testUrl.toString(), { method: 'GET', redirect: 'follow' });
  const testCookie = testPageRes.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .filter(Boolean)
    .join('; ');

  // 4) Fetch test scores from the JSON API
  const tests = await fetchTestScores(baseUrl, testCookie, gradeLookup);

  return { gpa, courseHistory, tests };
});
