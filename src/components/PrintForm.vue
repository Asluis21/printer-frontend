<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { usePrinter } from '../composables/usePrinter'
import {
  DOTS_PER_MM,
  FONTS,
  LABEL_HEIGHT,
  LABEL_WIDTH,
  MAX_ITEMS,
  type PrintItem,
} from '../services/printerService'

const { loading, error, sendJob } = usePrinter()

/* ---------- Items (the texts on the label) ---------- */
type EditorItem = Required<PrintItem> & { id: number }

let nextId = 1
const newItem = (over: Partial<PrintItem> = {}): EditorItem => ({
  id: nextId++,
  text: '',
  x: 20,
  y: 20,
  dir: 1,
  font: 'Univers',
  fontSize: 12,
  ...over,
})

const firstItem = () => newItem({ x: 50, y: 200 })
const items = ref<EditorItem[]>([firstItem()])
const copies = ref(1)
const selectedId = ref<number | null>(items.value[0]!.id)
const selected = computed(() => items.value.find((i) => i.id === selectedId.value) ?? null)
const selectedIndex = computed(() => items.value.findIndex((i) => i.id === selectedId.value))

const sentOk = ref(false)
const formEl = ref<HTMLFormElement | null>(null)

/** Strip the editor-only id before sending or storing. */
const toRequestItems = (list: EditorItem[]): Required<PrintItem>[] =>
  list.map(({ id: _id, ...rest }) => ({ ...rest }))

const endpoint = `${import.meta.env.VITE_API_URL ?? ''}/printer/print`
const payload = computed(() =>
  JSON.stringify({ copies: copies.value, items: toRequestItems(items.value) }, null, 2),
)

const status = computed(() => {
  if (error.value) return { kind: 'error', text: error.value }
  if (sentOk.value) return { kind: 'success', text: 'Sent to the printer.' }
  return null
})

/* ---------- Direction: 1 = 0°, 2 = 90°, 3 = 180°, 4 = 270° ---------- */
const directions = [
  { value: 1, label: '0°' },
  { value: 2, label: '90°' },
  { value: 3, label: '180°' },
  { value: 4, label: '270°' },
]
const dirDegrees = (dir: number) => (dir - 1) * 90

/* ---------- Label geometry (in dots) ---------- */
const label = { width: LABEL_WIDTH, height: LABEL_HEIGHT }
const maxX = LABEL_WIDTH - 1
const maxY = LABEL_HEIGHT - 1
const toMm = (dots: number) => (dots / DOTS_PER_MM).toFixed(1)
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

// points → dots at 203 dpi (1 pt = 1/72 in), so the preview is roughly to scale
const ptToDots = (pt: number) => (pt || 12) * (203 / 72)

/*
 * Printer fonts aren't installed in the browser, so each one maps to the
 * closest common font: same family style (sans/serif/mono), weight and width.
 */
type PreviewFont = { family: string; weight?: number; stretch?: string }
const SANS = '"Univers", "Helvetica Neue", Helvetica, Arial, sans-serif'
const SANS_CONDENSED = '"Univers Condensed", "Helvetica Neue", "Arial Narrow", Arial, sans-serif'
const SERIF = '"Times New Roman", Times, serif'
const MONO = '"Andale Mono", Menlo, Consolas, "Courier New", monospace'
const MONO_821 = 'Menlo, Consolas, "DejaVu Sans Mono", monospace'
const previewFonts: Record<string, PreviewFont> = {
  'Univers': { family: SANS },
  'Univers Bold': { family: SANS, weight: 700 },
  'Univers Condensed Bold': { family: SANS_CONDENSED, weight: 700, stretch: 'condensed' },
  'Univers Extra Condensed': { family: SANS_CONDENSED, stretch: 'extra-condensed' },
  'CG Times': { family: SERIF },
  'CG Times Bold': { family: SERIF, weight: 700 },
  'Century Schoolbook Roman': {
    family: '"Century Schoolbook", "New Century Schoolbook", "Century Schoolbook L", Georgia, serif',
  },
  'Dutch 801 Roman': { family: SERIF },
  'CG Triumvirate Condensed Bold': { family: SANS_CONDENSED, weight: 700, stretch: 'condensed' },
  'Andale Mono': { family: MONO },
  'Andale Mono Bold': { family: MONO, weight: 700 },
  'Monospace 821': { family: MONO_821 },
  'Monospace 821 Bold': { family: MONO_821, weight: 700 },
  'Letter Gothic': { family: '"Letter Gothic", "Letter Gothic Std", "Courier New", monospace' },
  'OCR A': { family: '"OCR A Std", "OCR A Extended", "OCR-A", "Courier New", monospace' },
  'OCR B': { family: '"OCR B", "OCR-B", "OCR B Std", "Courier New", monospace' },
}
const previewFontStyle = (font: string) => {
  const f = previewFonts[font] ?? previewFonts['Univers']!
  return {
    fontFamily: f.family,
    fontWeight: f.weight ?? 400,
    fontStretch: f.stretch ?? 'normal',
  }
}

/* ---------- Add / remove ---------- */
const addItem = () => {
  if (items.value.length >= MAX_ITEMS) return
  const base = selected.value ?? items.value.at(-1)
  // start just below the selected text, with the same font and size
  const item = newItem({
    x: base?.x ?? 20,
    y: base ? clamp(Math.round(base.y + ptToDots(base.fontSize) * 1.3), 0, maxY) : 20,
    font: base?.font ?? 'Univers',
    fontSize: base?.fontSize ?? 12,
  })
  items.value.push(item)
  selectedId.value = item.id
  nextTick(() => document.getElementById(`item-text-${item.id}`)?.focus())
}

const removeItem = (id: number) => {
  // the backend needs at least one item
  if (items.value.length <= 1) return
  const index = items.value.findIndex((i) => i.id === id)
  if (index < 0) return
  items.value.splice(index, 1)
  if (selectedId.value === id) {
    selectedId.value = items.value[Math.min(index, items.value.length - 1)]!.id
  }
}

/* ---------- Grid helper ---------- */
const grid = reactive({ cols: 2, rows: 2 })
const gridCount = computed(() =>
  Math.min(clamp(Math.round(grid.cols) || 1, 1, 10) * clamp(Math.round(grid.rows) || 1, 1, 10), MAX_ITEMS),
)

const fillGrid = () => {
  const cols = clamp(Math.round(grid.cols) || 1, 1, 10)
  const rows = clamp(Math.round(grid.rows) || 1, 1, 10)
  const style = selected.value ?? items.value[0]
  const pad = 20
  const next = Array.from({ length: gridCount.value }, (_, i) =>
    newItem({
      // keep what was already typed, in order
      text: items.value[i]?.text ?? '',
      x: Math.round(((i % cols) * LABEL_WIDTH) / cols) + pad,
      y: Math.round((Math.floor(i / cols) * LABEL_HEIGHT) / rows) + pad,
      font: style?.font ?? 'Univers',
      fontSize: style?.fontSize ?? 12,
    }),
  )
  items.value = next
  selectedId.value = next[0]!.id
}

/* ---------- Measuring each text in the preview ---------- */
// Used for the click/drag hit area, the selection outline and the "may run off" warning.
type Box = { x: number; y: number; width: number; height: number }
const itemEls = new Map<number, SVGGElement>()
const boxes = ref<Record<number, Box>>({})

const setItemEl = (id: number, el: unknown) => {
  if (el instanceof SVGGElement) itemEls.set(id, el)
  else itemEls.delete(id)
}

const measure = () => {
  const next: Record<number, Box> = {}
  for (const item of items.value) {
    const el = itemEls.get(item.id)
    if (!el) continue
    // the outer <g> has no transform, so its box includes the rotation
    const b = el.getBBox()
    next[item.id] = { x: b.x, y: b.y, width: b.width, height: b.height }
  }
  boxes.value = next
}

watch(items, () => nextTick(measure), { deep: true })
onMounted(() => {
  measure()
  document.fonts?.ready.then(measure)
})

const overflows = (id: number) => {
  const b = boxes.value[id]
  if (!b) return false
  const slack = 0.5
  return (
    b.x < -slack ||
    b.y < -slack ||
    b.x + b.width > LABEL_WIDTH + slack ||
    b.y + b.height > LABEL_HEIGHT + slack
  )
}

/* ---------- Preview: select, drag, nudge ---------- */
const svgEl = ref<SVGSVGElement | null>(null)
const dragging = ref(false)
let grab = { dx: 0, dy: 0 }

const toSvgPoint = (e: PointerEvent) => {
  const ctm = svgEl.value?.getScreenCTM()
  if (!ctm) return null
  return new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
}

const onItemPointerDown = (item: EditorItem, e: PointerEvent) => {
  if (loading.value) return
  selectedId.value = item.id
  const p = toSvgPoint(e)
  if (!p) return
  // keep the point you grabbed under the pointer, so the text doesn't jump
  grab = { dx: p.x - item.x, dy: p.y - item.y }
  dragging.value = true
  svgEl.value?.setPointerCapture(e.pointerId)
}

const onPointerMove = (e: PointerEvent) => {
  const item = selected.value
  if (!dragging.value || !item) return
  const p = toSvgPoint(e)
  if (!p) return
  item.x = clamp(Math.round(p.x - grab.dx), 0, maxX)
  item.y = clamp(Math.round(p.y - grab.dy), 0, maxY)
}

const onPointerUp = () => {
  dragging.value = false
}

const onPreviewKeydown = (e: KeyboardEvent) => {
  const item = selected.value
  if (!item) return
  const step = e.shiftKey ? 10 : 1
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }
  const move = moves[e.key]
  if (!move) return
  e.preventDefault()
  item.x = clamp(item.x + move[0], 0, maxX)
  item.y = clamp(item.y + move[1], 0, maxY)
}

/* ---------- Copies ---------- */
const changeCopies = (delta: number) => {
  copies.value = clamp((copies.value || 1) + delta, 1, 99)
}

/* ---------- History ---------- */
interface HistoryEntry {
  id: number
  items: Required<PrintItem>[]
  copies: number
  ok: boolean
  time: string
}
const history = ref<HistoryEntry[]>([])

const reuse = (entry: HistoryEntry) => {
  items.value = entry.items.map((i) => newItem(i))
  copies.value = entry.copies
  selectedId.value = items.value[0]!.id
  sentOk.value = false
  error.value = null
}

/* ---------- Actions ---------- */
const reset = () => {
  items.value = [firstItem()]
  selectedId.value = items.value[0]!.id
  copies.value = 1
  sentOk.value = false
  error.value = null
}

const onSubmit = async () => {
  sentOk.value = false
  const sentItems = toRequestItems(items.value)
  const sentCopies = copies.value
  const ok = await sendJob({ copies: sentCopies, items: sentItems })
  sentOk.value = ok

  history.value.unshift({
    id: Date.now(),
    items: sentItems,
    copies: sentCopies,
    ok,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  })
  history.value = history.value.slice(0, 5)
}

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)
const shortcutLabel = isMac ? '⌘ Enter' : 'Ctrl Enter'

const onFormKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !loading.value) {
    e.preventDefault()
    formEl.value?.requestSubmit()
  }
}
</script>

<template>
  <section class="page">
    <header class="page-header">
      <p class="eyebrow">Printer</p>
      <h1>New print job</h1>
      <p class="subtitle">
        Add one or more texts, then drag each one on the label to place it.
      </p>
    </header>

    <div class="layout">
      <!-- ================= Form ================= -->
      <form ref="formEl" class="card" @submit.prevent="onSubmit" @keydown="onFormKeydown">
        <fieldset :disabled="loading">
          <div class="section">
            <div class="section-head">
              <h2 class="section-title">
                Texts <span class="count">{{ items.length }} / {{ MAX_ITEMS }}</span>
              </h2>
              <button
                type="button"
                class="btn small ghost"
                :disabled="items.length >= MAX_ITEMS"
                @click="addItem"
              >
                + Add text
              </button>
            </div>

            <ol class="items">
              <li
                v-for="(item, index) in items"
                :key="item.id"
                class="item"
                :class="{ selected: item.id === selectedId }"
                @focusin="selectedId = item.id"
                @click="selectedId = item.id"
              >
                <div class="item-head">
                  <!-- numbered from 1, like the backend's "Item 2: ..." errors -->
                  <span class="item-num" aria-hidden="true">{{ index + 1 }}</span>
                  <input
                    :id="`item-text-${item.id}`"
                    v-model="item.text"
                    type="text"
                    required
                    :placeholder="`Text ${index + 1}`"
                    :aria-label="`Text ${index + 1}`"
                  />
                  <button
                    type="button"
                    class="icon-btn"
                    :disabled="items.length <= 1"
                    :aria-label="`Remove text ${index + 1}`"
                    title="Remove"
                    @click.stop="removeItem(item.id)"
                  >
                    ✕
                  </button>
                </div>

                <div class="item-grid">
                  <label class="field">
                    <span class="label">Font</span>
                    <select v-model="item.font">
                      <option v-for="f in FONTS" :key="f" :value="f">{{ f }}</option>
                    </select>
                  </label>
                  <label class="field">
                    <span class="label">Size (pt)</span>
                    <input v-model.number="item.fontSize" type="number" min="4" max="200" required />
                  </label>
                  <label class="field">
                    <span class="label">X (dots)</span>
                    <input v-model.number="item.x" type="number" min="0" :max="maxX" required />
                  </label>
                  <label class="field">
                    <span class="label">Y (dots)</span>
                    <input v-model.number="item.y" type="number" min="0" :max="maxY" required />
                  </label>
                </div>

                <div class="item-foot">
                  <div
                    class="segmented compact"
                    role="group"
                    :aria-label="`Rotation of text ${index + 1}`"
                  >
                    <button
                      v-for="d in directions"
                      :key="d.value"
                      type="button"
                      :class="{ active: item.dir === d.value }"
                      :aria-pressed="item.dir === d.value"
                      @click="item.dir = d.value"
                    >
                      <span class="dir-arrow" :style="{ transform: `rotate(${dirDegrees(d.value)}deg)` }">
                        →
                      </span>
                      {{ d.label }}
                    </button>
                  </div>
                  <span class="hint">≈ {{ toMm(item.x) }} × {{ toMm(item.y) }} mm</span>
                </div>

                <p v-if="overflows(item.id)" class="warn">
                  May run off the label edge. Check the preview.
                </p>
              </li>
            </ol>
          </div>

          <div class="section">
            <h2 class="section-title">Grid helper</h2>
            <div class="grid-helper">
              <label class="field">
                <span class="label">Columns</span>
                <input v-model.number="grid.cols" type="number" />
              </label>
              <span class="times" aria-hidden="true">×</span>
              <label class="field">
                <span class="label">Rows</span>
                <input v-model.number="grid.rows" type="number" />
              </label>
              <button type="button" class="btn small ghost" @click="fillGrid">Fill label</button>
            </div>
            <p class="hint">
              Replaces the texts with {{ gridCount }} evenly spaced ones (up to 10 × 10), keeping
              what you've typed in order and the selected text's font and size.
            </p>
          </div>

          <div class="section">
            <div class="field copies-field">
              <label class="label" for="copies">Copies of the label</label>
              <div class="stepper">
                <button
                  type="button"
                  aria-label="Fewer copies"
                  :disabled="copies <= 1"
                  @click="changeCopies(-1)"
                >
                  −
                </button>
                <input id="copies" v-model.number="copies" type="number" min="1" max="99" required />
                <button
                  type="button"
                  aria-label="More copies"
                  :disabled="copies >= 99"
                  @click="changeCopies(1)"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </fieldset>

        <div class="actions">
          <button type="button" class="btn ghost" :disabled="loading" @click="reset">
            Clear
          </button>
          <button type="submit" class="btn primary" :disabled="loading">
            <span v-if="loading" class="spinner" aria-hidden="true" />
            {{ loading ? 'Printing…' : `Print ${copies > 1 ? `×${copies}` : ''}` }}
            <kbd v-if="!loading">{{ shortcutLabel }}</kbd>
          </button>
        </div>

        <div aria-live="polite">
          <p v-if="status" class="status" :class="status.kind">
            <span class="status-icon" aria-hidden="true">
              {{ status.kind === 'success' ? '✓' : '!' }}
            </span>
            {{ status.text }}
          </p>
        </div>
      </form>

      <!-- ================= Preview + history ================= -->
      <div class="side">
        <section class="card">
          <div class="card-head">
            <h2 class="section-title">Label preview</h2>
            <span class="size">101.5 × 74.9 mm · {{ label.width }} × {{ label.height }} dots</span>
          </div>

          <svg
            ref="svgEl"
            class="label-canvas"
            :class="{ dragging }"
            :viewBox="`0 0 ${label.width} ${label.height}`"
            tabindex="0"
            role="img"
            :aria-label="
              selected
                ? `Label preview. Text ${selectedIndex + 1} selected at X ${selected.x}, Y ${selected.y}. Drag a text to move it, or use the arrow keys.`
                : 'Label preview.'
            "
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
            @keydown="onPreviewKeydown"
          >
            <defs>
              <!-- one grid square = 5 mm (40 dots) -->
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" class="grid-line" />
              </pattern>
            </defs>
            <rect :width="label.width" :height="label.height" class="label-bg" />
            <rect :width="label.width" :height="label.height" fill="url(#grid)" />

            <!-- crosshair guides for the selected text -->
            <template v-if="selected">
              <line :x1="selected.x" y1="0" :x2="selected.x" :y2="label.height" class="guide" />
              <line x1="0" :y1="selected.y" :x2="label.width" :y2="selected.y" class="guide" />
            </template>

            <!-- the texts; the outer <g> is measured, so it must have no transform -->
            <g v-for="(item, index) in items" :key="item.id" :ref="(el) => setItemEl(item.id, el)">
              <g :transform="`rotate(${dirDegrees(item.dir)} ${item.x} ${item.y})`">
                <text
                  :x="item.x"
                  :y="item.y"
                  :font-size="ptToDots(item.fontSize)"
                  :style="previewFontStyle(item.font)"
                  dominant-baseline="hanging"
                  class="label-text"
                  :class="{ placeholder: !item.text }"
                >{{ item.text || `Text ${index + 1}` }}</text>
              </g>
            </g>

            <!-- hit areas + selection outline, drawn from the measured boxes -->
            <template v-for="item in items" :key="`hit-${item.id}`">
              <rect
                v-if="boxes[item.id]"
                :x="boxes[item.id]!.x - 4"
                :y="boxes[item.id]!.y - 4"
                :width="boxes[item.id]!.width + 8"
                :height="boxes[item.id]!.height + 8"
                rx="4"
                class="hit"
                :class="{ selected: item.id === selectedId, overflow: overflows(item.id) }"
                @pointerdown="onItemPointerDown(item, $event)"
              />
            </template>

            <circle v-if="selected" :cx="selected.x" :cy="selected.y" r="8" class="origin" />
          </svg>

          <p v-if="selected" class="coords">
            <span>Text <strong>{{ selectedIndex + 1 }}</strong></span>
            <span>X <strong>{{ selected.x }}</strong></span>
            <span>Y <strong>{{ selected.y }}</strong></span>
            <span><strong>{{ dirDegrees(selected.dir) }}°</strong></span>
          </p>
          <p class="hint">
            Click a text to select it and drag to move it. Arrow keys nudge the selected text
            (hold Shift for 10). Red outlines may run off the label. The preview is approximate:
            the printer's fonts look a bit different.
          </p>

          <details class="request">
            <summary>Show request</summary>
            <p class="endpoint">
              <span class="method">POST</span>
              <span class="url">{{ endpoint }}</span>
            </p>
            <pre class="payload">{{ payload }}</pre>
          </details>
        </section>

        <section class="card">
          <h2 class="section-title">Recent jobs</h2>
          <p v-if="!history.length" class="empty">Jobs you send will show up here.</p>
          <ul v-else class="history">
            <li v-for="entry in history" :key="entry.id">
              <span class="dot" :class="entry.ok ? 'ok' : 'fail'" :title="entry.ok ? 'Sent' : 'Failed'" />
              <div class="history-main">
                <span class="history-text">{{ entry.items.map((i) => i.text).join(' · ') }}</span>
                <span class="history-meta">
                  {{ entry.time }} · {{ entry.items.length }}
                  {{ entry.items.length === 1 ? 'text' : 'texts' }} · ×{{ entry.copies }}
                </span>
              </div>
              <button type="button" class="btn small ghost" :disabled="loading" @click="reuse(entry)">
                Use again
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page {
  --success: #15803d;
  --success-bg: rgba(22, 163, 74, 0.1);
  --danger: #b91c1c;
  --danger-bg: rgba(220, 38, 38, 0.1);
  --label-bg: #ffffff;
  --label-ink: #111111;
  --label-grid: rgba(0, 0, 0, 0.06);
  --radius: 12px;

  padding: 40px 32px 56px;
  text-align: left;
}

@media (prefers-color-scheme: dark) {
  .page {
    --success: #4ade80;
    --success-bg: rgba(74, 222, 128, 0.12);
    --danger: #f87171;
    --danger-bg: rgba(248, 113, 113, 0.12);
  }
}

/* ---------- Header ---------- */
.page-header {
  margin-bottom: 28px;
}

.eyebrow {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}

.page-header h1 {
  font-size: 34px;
  letter-spacing: -0.8px;
  margin: 4px 0 6px;
}

.subtitle {
  font-size: 16px;
  max-width: 52ch;
}

/* ---------- Layout ---------- */
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  gap: 24px;
  align-items: start;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 24px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.card-head .section-title {
  margin: 0;
}

fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}

.section + .section {
  margin-top: 22px;
  padding-top: 22px;
  border-top: 1px solid var(--border);
}

.page .section-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text);
  margin: 0 0 14px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

/* ---------- Fields ---------- */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.font-row {
  margin-top: 16px;
}

.copies-field {
  margin-top: 16px;
  max-width: 200px;
}

.label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-h);
}

.hint {
  font-size: 13px;
  color: var(--text);
}

input,
select,
textarea {
  font: inherit;
  font-size: 16px;
  color: var(--text-h);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s;
}

textarea {
  resize: vertical;
  min-height: 96px;
}

input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}

fieldset:disabled input,
fieldset:disabled select,
fieldset:disabled textarea {
  opacity: 0.6;
}

/* ---------- Direction (segmented) ---------- */
.segmented {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  padding: 4px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.segmented button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
  font: inherit;
  font-size: 14px;
  color: var(--text);
  background: transparent;
  border: 0;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.segmented button:hover:not(:disabled) {
  color: var(--text-h);
}

.segmented button.active {
  color: var(--accent);
  background: var(--bg);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  font-weight: 600;
}

.dir-arrow {
  display: inline-block;
  transition: transform 0.2s;
}

/* ---------- Copies stepper ---------- */
.stepper {
  display: flex;
  align-items: stretch;
}

.stepper input {
  text-align: center;
  border-radius: 0;
  border-inline: 0;
  -moz-appearance: textfield;
  appearance: textfield;
}

.stepper input::-webkit-outer-spin-button,
.stepper input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.stepper button {
  flex: 0 0 44px;
  font: inherit;
  font-size: 18px;
  color: var(--text-h);
  background: var(--code-bg);
  border: 1px solid var(--border);
  cursor: pointer;
}

.stepper button:first-child {
  border-radius: 8px 0 0 8px;
}

.stepper button:last-child {
  border-radius: 0 8px 8px 0;
}

.stepper button:hover:not(:disabled) {
  color: var(--accent);
}

.stepper button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ---------- Buttons ---------- */
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 28px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 20px;
  font: inherit;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, opacity 0.15s, transform 0.1s;
}

.btn:active:not(:disabled) {
  transform: translateY(1px);
}

.btn.small {
  min-height: 34px;
  padding: 0 12px;
  font-size: 14px;
}

.btn:focus-visible,
.stepper button:focus-visible,
.segmented button:focus-visible,
.label-canvas:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.primary {
  min-width: 140px;
  color: var(--bg);
  background: var(--accent);
  border: 1px solid var(--accent);
}

.primary:hover:not(:disabled) {
  opacity: 0.9;
}

.primary kbd {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.2);
}

.ghost {
  color: var(--text-h);
  background: transparent;
  border: 1px solid var(--border);
}

.ghost:hover:not(:disabled) {
  border-color: var(--accent-border);
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---------- Status ---------- */
.status {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 20px;
  padding: 12px 14px;
  font-size: 15px;
  border-radius: 8px;
  animation: pop-in 0.2s ease-out;
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

.status-icon {
  flex: 0 0 22px;
  height: 22px;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
  border-radius: 50%;
  color: var(--bg);
}

.success {
  color: var(--success);
  background: var(--success-bg);
}

.success .status-icon {
  background: var(--success);
}

.error {
  color: var(--danger);
  background: var(--danger-bg);
}

.error .status-icon {
  background: var(--danger);
}

/* ---------- Label preview ---------- */
.size {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.size input {
  width: 72px;
  padding: 4px 8px;
  font-size: 13px;
  text-align: center;
}

.label-canvas {
  display: block;
  width: 100%;
  height: auto;
  max-height: 360px;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: crosshair;
  touch-action: none;
  user-select: none;
}

.label-canvas.dragging {
  cursor: grabbing;
}

.label-bg {
  fill: var(--label-bg);
}

.grid-line {
  fill: none;
  stroke: var(--label-grid);
  stroke-width: 1;
}

.guide {
  stroke: var(--accent);
  stroke-width: 1;
  stroke-dasharray: 4 4;
  opacity: 0.6;
}

.label-text {
  fill: var(--label-ink);
  /* font-family/weight/stretch come from previewFontStyle (the chosen printer font) */
  white-space: pre;
  /* clicks go to the .hit rect drawn over each text */
  pointer-events: none;
}

.hit {
  fill: transparent;
  stroke: transparent;
  stroke-width: 2;
  cursor: grab;
}

.label-canvas.dragging .hit {
  cursor: grabbing;
}

.hit:hover {
  stroke: var(--accent-border);
}

.hit.selected {
  stroke: var(--accent);
  stroke-dasharray: 6 4;
}

.hit.overflow {
  stroke: var(--danger);
}

.label-text.placeholder {
  fill: rgba(0, 0, 0, 0.3);
}

.origin {
  fill: var(--accent);
  stroke: var(--label-bg);
  stroke-width: 2;
}

.coords {
  display: flex;
  gap: 16px;
  margin: 12px 0 4px;
  font-family: var(--mono);
  font-size: 14px;
}

.coords strong {
  color: var(--text-h);
}

/* ---------- Request ---------- */
.request {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.request summary {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-h);
  cursor: pointer;
}

.endpoint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0;
  font-family: var(--mono);
  font-size: 14px;
}

.method {
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-bg);
  border-radius: 4px;
}

.url {
  color: var(--text-h);
  overflow-wrap: anywhere;
}

.payload {
  margin: 0;
  padding: 14px 16px;
  font-family: var(--mono);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-h);
  background: var(--code-bg);
  border-radius: 8px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ---------- History ---------- */
.empty {
  font-size: 14px;
  color: var(--text);
}

.history {
  list-style: none;
  margin: 0;
  padding: 0;
}

.history li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  animation: pop-in 0.2s ease-out;
}

.history li + li {
  border-top: 1px solid var(--border);
}

.dot {
  flex: 0 0 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.ok {
  background: var(--success);
}

.dot.fail {
  background: var(--danger);
}

.history-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.history-text {
  font-size: 15px;
  color: var(--text-h);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-meta {
  font-size: 12px;
  font-family: var(--mono);
}

/* ---------- Item list ---------- */
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.section-head .section-title {
  margin: 0;
}

.count {
  margin-left: 6px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--text);
}

.items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.item {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.item.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}

.item-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.item-num {
  flex: 0 0 26px;
  height: 26px;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
  border-radius: 50%;
  color: var(--text-h);
  background: var(--code-bg);
}

.item.selected .item-num {
  color: var(--bg);
  background: var(--accent);
}

.icon-btn {
  flex: 0 0 36px;
  height: 36px;
  font: inherit;
  font-size: 14px;
  color: var(--text);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
}

.icon-btn:hover:not(:disabled) {
  color: var(--danger);
  border-color: var(--border);
}

.icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.icon-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.item-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.item-grid input,
.item-grid select {
  padding: 8px 10px;
  font-size: 15px;
}

.item-grid .label {
  font-size: 13px;
}

.item-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}

.segmented.compact {
  flex: 0 1 300px;
}

.segmented.compact button {
  min-height: 32px;
  font-size: 13px;
}

.warn {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--danger);
}

/* ---------- Grid helper ---------- */
.grid-helper {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.grid-helper .field {
  width: 90px;
}

.grid-helper .times {
  padding-bottom: 10px;
}

/* ---------- Small screens ---------- */
@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .page {
    padding: 24px 16px 40px;
  }

  .page-header h1 {
    font-size: 28px;
  }

  .card {
    padding: 18px;
  }

  .actions {
    flex-direction: column-reverse;
  }

  .actions .btn {
    width: 100%;
  }

  .primary kbd {
    display: none;
  }

  .copies-field {
    max-width: none;
  }

  .item-grid {
    grid-template-columns: 1fr 1fr;
  }

  .item-foot {
    flex-direction: column;
    align-items: stretch;
  }

  .segmented.compact {
    flex: none;
  }
}
</style>
