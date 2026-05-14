<script lang="ts">
  import { Button, Select, Icon } from 'm3-svelte';
  import 'm3-svelte/etc/layer';
  import iconDelete from '@ktibow/iconset-material-symbols/delete';
  import iconCalculate from '@ktibow/iconset-material-symbols/calculate';
  import iconAbc from '@ktibow/iconset-material-symbols/abc';
  import iconAdd from '@ktibow/iconset-material-symbols/add';

  import { formatPercentile, formatSchoolYear } from './lib/percentiles';
  import {
    getTests,
    addTest,
    removeTest,
    getGpa,
    setGpa,
    getCourseHistory,
    setCourseHistory,
    getComputed,
  } from './lib/stores.svelte';
  import loadFromStudentVue from './lib/studentvue.remote';

  // ── StudentVue ─────────────────────────────────────────────────────────
  let svEmail = $state(localStorage.getItem('sv_email') ?? '');
  let svPassword = $state(localStorage.getItem('sv_password') ?? '');
  let svLoading = $state(false);
  let svError = $state<string | null>(null);

  $effect(() => {
    if (svEmail) localStorage.setItem('sv_email', svEmail);
    else localStorage.removeItem('sv_email');
  });
  $effect(() => {
    if (svPassword) localStorage.setItem('sv_password', svPassword);
    else localStorage.removeItem('sv_password');
  });

  async function handleLoadSV(e?: Event) {
    e?.preventDefault();
    if (!svEmail || !svPassword) {
      svError = 'Enter your StudentVue email and password.';
      return;
    }
    svLoading = true;
    svError = null;
    try {
      const data = await loadFromStudentVue({
        email: svEmail,
        password: svPassword,
      });
      if (data.gpa != null) setGpa(data.gpa);
      // Sync course history into local state (store syncs via $effect below)
      chYears = data.courseHistory;
      // Add tests (dedup by id)
      const existingIds = new Set(getTests().map((t) => t.id));
      for (const test of data.tests) {
        if (!existingIds.has(test.id)) {
          addTest(test);
        }
      }
    } catch (e) {
      svError = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      svLoading = false;
    }
  }

  // ── UI state ─────────────────────────────────────────────────────────────
  let showAddForm = $state(false);
  let newType: 'SAT' | 'PSAT' | 'AP' | 'StateTest' = $state('SAT');
  let newEnglish = $state<number | undefined>(undefined);
  let newMath = $state<number | undefined>(undefined);
  let newYear = $state(new Date().getFullYear());
  let newLabel = $state('');

  // Course-history state — year stored as "YY-YY" school-year format
  let chYears = $state<{ year: string; apCount: number }[]>([]);

  // Keep the store in sync instantly
  $effect(() => {
    setCourseHistory(chYears);
  });

  function defaultSchoolYear(): string {
    const now = new Date().getFullYear();
    const start = now - 1;
    return `${String(start).slice(-2)}-${String(now).slice(-2)}`;
  }

  function addEntryYear() {
    const year = chYears[0]?.year ?? defaultSchoolYear();
    // Decrement the school year by 1
    const start = parseInt(year.slice(0, 2), 10) + 2000 - 1;
    const newYear = `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
    chYears = [...chYears, { year: newYear, apCount: 0 }];
  }

  function updateChYear(idx: number, field: 'year' | 'apCount', val: string) {
    if (field === 'year') {
      const next = [...chYears];
      next[idx] = { ...next[idx]!, year: val };
      chYears = next;
    } else {
      const parsed = parseInt(val, 10);
      if (isNaN(parsed)) return;
      const next = [...chYears];
      next[idx] = { ...next[idx]!, apCount: parsed };
      chYears = next;
    }
  }

  // ── Adding a test ────────────────────────────────────────────────────────
  function handleAddTest() {
    if (isNaN(newYear)) return;

    if (newEnglish != null && !isNaN(newEnglish)) {
      addTest({
        id: crypto.randomUUID(),
        type: newType,
        subject: 'english',
        score: newEnglish,
        year: newYear,
        label: newLabel.trim() || undefined,
      });
    }
    if (newMath != null && !isNaN(newMath)) {
      addTest({
        id: crypto.randomUUID(),
        type: newType,
        subject: 'math',
        score: newMath,
        year: newYear,
        label: newLabel.trim() || undefined,
      });
    }

    newEnglish = undefined;
    newMath = undefined;
    newYear = new Date().getFullYear();
    newLabel = '';
    showAddForm = false;
  }

  // ── Computed data ────────────────────────────────────────────────────────
  let computed = $derived(getComputed());

  let sortedRows = $derived.by(() => {
    const order: Record<string, number> = {
      english: 0,
      math: 1,
      gpa: 2,
      rigor: 3,
      test: 4,
      'rigor-year': 5,
    };
    return [...computed.rows].sort(
      (a, b) => (order[a.category] ?? 9) - (order[b.category] ?? 9),
    );
  });

  // ── School year options for select (last 4 years) ─────────────────────
  let schoolYearOptions = $derived.by(() => {
    const now = new Date();
    const currentStart = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return Array.from({ length: 4 }, (_, i) => {
      const y = currentStart - 3 + i;
      return `${String(y).slice(-2)}-${String(y + 1).slice(-2)}`;
    });
  });

  // ── Select options ───────────────────────────────────────────────────────
  const typeOptions = [
    { text: 'SAT', value: 'SAT' },
    { text: 'PSAT', value: 'PSAT' },
    { text: 'AP', value: 'AP' },
    { text: 'State Test', value: 'StateTest' },
  ];
</script>

<!-- ─── Top: display ─────────────────────────────────────────────────────── -->
<div class="top">
  <div class="latent-hero">
    <span class="latent-label">Latent Percentile</span>
    <span class="latent-value">{formatPercentile(computed.latentPercentile)}</span>
  </div>

  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Measure</th>
          <th class="num">Raw</th>
          <th class="num">z-score</th>
          <th class="num">Percentile</th>
        </tr>
      </thead>
      <tbody>
        {#each sortedRows as row}
          <tr class:used={row.isUsed}>
            <td>
              {row.label}
              {#if row.isUsed && row.weight != null}
                <span class="used-badge">{Math.round(row.weight * 100)}%</span>
              {/if}
            </td>
            <td class="num">
              {row.category === 'gpa'
                ? row.raw.toFixed(2)
                : row.category === 'rigor'
                  ? (row.raw as number).toFixed(2)
                  : row.raw}
            </td>
            <td class="num">{row.zScore.toFixed(3)}</td>
            <td class="num pct">{formatPercentile(row.percentile)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<!-- ─── Bottom: config panel ──────────────────────────────────────────────── -->
<div class="bottom">
  <div class="config-grid">
    <!-- StudentVue Load -->
    <div class="island sv-section">
      <h3>StudentVue</h3>
      <form onsubmit={handleLoadSV}>
        <input
          type="email"
          placeholder="Email"
          bind:value={svEmail}
          disabled={svLoading}
        />
        <input
          type="password"
          placeholder="Password"
          bind:value={svPassword}
          disabled={svLoading}
        />
        <Button
          variant="filled"
          type="submit"
          disabled={svLoading || !svEmail || !svPassword}
        >
          {svLoading ? 'Loading…' : 'Load from StudentVue'}
        </Button>
        {#if svError}
          <p class="sv-error">{svError}</p>
        {/if}
      </form>
    </div>

    <!-- GPA — whole card looks & acts like one big <input> -->
    <div class="island gpa-field">
      <span class="gpa-label">GPA</span>
      <input
        type="number"
        min="0"
        max="4"
        step="0.1"
        placeholder="0.0–4.0"
        value={getGpa() ?? ''}
        oninput={(e) => {
          const v = parseFloat(e.currentTarget.value);
          setGpa(isNaN(v) ? null : Math.min(4, Math.max(0, v)));
        }}
      />
    </div>

    <!-- Tests -->
    {#if getTests().length === 0 && !showAddForm}
      <button class="island island-action m3-layer" onclick={() => (showAddForm = true)}>
        <Icon icon={iconAdd} size={22} /> Add Test
      </button>
    {:else}
      <div class="island">
        <h3>Tests</h3>

        {#if showAddForm}
          <div class="test-form">
            <div class="field-row">
              <Select label="Type" options={typeOptions} bind:value={newType} />
            </div>
            <div class="field-row">
              <input type="number" bind:value={newEnglish} placeholder="English score" />
              <input type="number" bind:value={newMath} placeholder="Math score" />
            </div>
            <div class="field-row">
              <input type="number" bind:value={newYear} placeholder="Year" />
              <input type="text" bind:value={newLabel} placeholder="Label (optional)" />
            </div>
            <div class="field-row actions">
              <Button variant="text" onclick={() => (showAddForm = false)}>Cancel</Button>
              <Button variant="filled" onclick={handleAddTest}>Add</Button>
            </div>
          </div>
        {:else}
          <!-- Saved test list -->
          <div class="chip-list">
            {#each getTests() as test (test.id)}
              <div class="saved-test-row">
                <Icon icon={test.subject === 'english' ? iconAbc : iconCalculate} size={18} />
                <span class="test-label"
                  >{test.type} {test.year} — {test.subject === 'english' ? 'E' : 'M'}: {test.score}</span
                >
                <button class="chip-remove m3-layer" onclick={() => removeTest(test.id)} aria-label="Remove test">
                  <Icon icon={iconDelete} size={16} />
                </button>
              </div>
            {/each}
          </div>
          <div class="field-row actions">
            <Button variant="tonal" onclick={() => (showAddForm = true)}>
              <Icon icon={iconAdd} /> Add
            </Button>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Course History -->
    {#if chYears.length === 0}
      <button class="island island-action m3-layer" onclick={addEntryYear}>
        <Icon icon={iconAdd} size={22} /> Add APs per Year
      </button>
    {:else}
      <div class="island">
        <h3>APs per Year</h3>
        <div class="course-form">
          {#each chYears as entry, i}
            <div class="field-row ch-row">
              <label class="ch-label">
                <span class="ch-label-text">Year</span>
                <select value={entry.year} onchange={(e) => updateChYear(i, 'year', e.currentTarget.value)}>
                  {#each schoolYearOptions as opt}
                    <option value={opt} selected={opt === entry.year}>{opt}</option>
                  {/each}
                </select>
              </label>
              <label class="ch-label">
                <span class="ch-label-text">APs</span>
                <input
                  type="number"
                  min="0"
                  value={entry.apCount}
                  oninput={(e) => updateChYear(i, 'apCount', e.currentTarget.value)}
                />
              </label>
            </div>
          {/each}
        </div>
        <div class="field-row actions">
          <Button variant="tonal" onclick={addEntryYear}>
            <Icon icon={iconAdd} /> Add Year
          </Button>
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- ─── Styles ──────────────────────────────────────────────────────────── -->
<style>
  /* ── Layout ────────────────────────────────────────────────────────── */
  :global(body) {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    overflow: hidden;
  }

  .top {
    flex: 1 1 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 0.5rem;
    gap: 0.5rem;
    min-height: 0;
  }

  .bottom {
    flex: 0 1 auto;
    max-height: 50%;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    gap: 0.5rem;
    height: 100%;
    align-content: start;
  }

  /* ── Island ────────────────────────────────────────────────────────── */
  .island {
    background: var(--m3c-surface);
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
  }
  .island > .field-row.actions {
    margin-top: auto;
    padding-top: 0.5rem;
  }
  .island h3 {
    margin: 0;
    @apply --m3-title-small;
    color: var(--m3c-on-surface-variant);
  }

  /* ── Empty-state action island (whole card = button) ──────────────── */
  .island-action {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    background: var(--m3c-secondary-container);
    color: var(--m3c-on-secondary-container);
    min-height: 4.5rem;
  }

  /* ── GPA field — island that acts as an <input> ──────────────────── */
  .gpa-field {
    position: relative;
    cursor: text;
    padding: 0;
    gap: 0;
    min-height: 4.75rem;
  }
  .gpa-field:focus-within {
    @apply --m3-focused-outward;
  }
  .gpa-label {
    position: absolute;
    top: 0.5rem;
    left: 0.75rem;
    pointer-events: none;
    z-index: 1;
    margin: 0;
    @apply --m3-title-small;
    color: var(--m3c-on-surface-variant);
  }
  .gpa-field input {
    position: absolute;
    inset: 0;
    border: none;
    background: transparent;
    padding: 1.625rem 0.75rem 0.5rem;
    font-size: 1.375rem;
    font-weight: 600;
    color: var(--m3c-on-surface);
    outline: none;
    width: 100%;
    border-radius: 0.75rem;
  }
  .gpa-field input::placeholder {
    color: var(--m3c-on-surface-variant);
    opacity: 0.5;
    font-weight: 400;
    font-size: 1rem;
  }

  /* ── StudentVue ──────────────────────────────────────────────────── */
  .sv-section {
    gap: 0;
  }
  .sv-section form {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .sv-section input {
    padding: 0.375rem 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid var(--m3c-outline);
    background: var(--m3c-surface-container-lowest);
    color: var(--m3c-on-surface);
    font-size: 0.8125rem;
  }
  .sv-section input:focus {
    outline: 2px solid var(--m3c-primary);
    outline-offset: 1px;
  }
  .sv-error {
    margin: 0;
    font-size: 0.75rem;
    color: var(--m3c-error);
    word-break: break-word;
  }

  .field-row {
    display: flex;
    gap: 0.375rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .field-row.actions {
    justify-content: flex-end;
  }

  .field-row input {
    flex: 1;
    min-width: 4rem;
    padding: 0.375rem 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid var(--m3c-outline);
    background: var(--m3c-surface-container-lowest);
    color: var(--m3c-on-surface);
    font-size: 0.8125rem;
  }
  .field-row input:focus {
    outline: 2px solid var(--m3c-primary);
    outline-offset: 1px;
  }

  .test-form,
  .course-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ── Course history row labels ───────────────────────────────────── */
  .ch-row {
    display: flex;
    gap: 0.375rem;
  }
  .ch-label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    cursor: text;
  }
  .ch-label-text {
    font-size: 0.625rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--m3c-on-surface-variant);
    text-transform: uppercase;
  }

  /* ── Saved test chips ──────────────────────────────────────────────── */
  .chip-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .saved-test-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.375rem;
    border-radius: 0.375rem;
    background: var(--m3c-surface-container-low);
    font-size: 0.8125rem;
  }
  .test-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip-remove {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.125rem;
    line-height: 1;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--m3c-on-surface-variant);
  }




  /* ── Latent hero ───────────────────────────────────────────────────── */
  .latent-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1.5rem 1rem 0.5rem;
    gap: 0.25rem;
    flex-shrink: 0;
  }
  .latent-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--m3c-on-surface-variant);
  }
  .latent-value {
    font-size: clamp(2.5rem, 8vw, 5rem);
    font-weight: 800;
    line-height: 1;
    background: linear-gradient(135deg, var(--m3c-primary), var(--m3c-tertiary));
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  /* ── Table ─────────────────────────────────────────────────────────── */
  .table-wrapper {
    overflow-x: auto;
    flex-shrink: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  thead {
    position: sticky;
    top: 0;
    z-index: 1;
  }
  th {
    text-align: left;
    padding: 0.375rem 0.5rem;
    background: var(--m3c-surface-container);
    font-weight: 600;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--m3c-on-surface-variant);
    border-bottom: 1px solid var(--m3c-outline-variant);
  }
  th.num {
    text-align: right;
  }
  td {
    padding: 0.375rem 0.5rem;
    border-bottom: 1px solid var(--m3c-surface-container-high);
    white-space: nowrap;
  }
  td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  td.pct {
    font-weight: 600;
    color: var(--m3c-primary);
  }
  tr.used {
    background: var(--m3c-primary-container-subtle);
  }
  tr.used td {
    border-bottom-color: var(--m3c-primary-container);
  }
  .used-badge {
    display: inline-block;
    font-size: 0.5625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: var(--m3c-primary);
    color: var(--m3c-on-primary);
    padding: 0.0625rem 0.3125rem;
    border-radius: 0.5rem;
    margin-left: 0.3125rem;
    vertical-align: middle;
  }
</style>
