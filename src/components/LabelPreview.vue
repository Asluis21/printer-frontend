<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import type { PrintEditor } from '../composables/usePrintEditor'
import type { EditorItem, Box } from '../types/printer'

const props = defineProps<{ editor: PrintEditor }>()

const {
  items, selected, selectedIndex, loading,
  label, maxX, maxY, boxes, clamp, dirDegrees, ptToDots,
  overflows, endpoint, payload, selectedIds, isSelected,
  selectItem, updateSelectedText
} = props.editor

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

const svgEl = ref<SVGSVGElement | null>(null)
const dragging = ref(false)
const itemEls = new Map<number, SVGGElement>()
let grab = { dx: 0, dy: 0 }

const setItemEl = (id: number, el: unknown) => {
  if (el instanceof SVGGElement) itemEls.set(id, el)
  else itemEls.delete(id)
}

const measure = () => {
  const next: Record<number, Box> = {}
  for (const item of items.value) {
    const el = itemEls.get(item.id)
    if (!el) continue
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

const toSvgPoint = (e: PointerEvent) => {
  const ctm = svgEl.value?.getScreenCTM()
  if (!ctm) return null
  return new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
}

const onItemPointerDown = (
    item: EditorItem,
    e: PointerEvent
) => {
  if (loading.value || e.button !== 0) return

  const multiple = e.metaKey || e.ctrlKey

  selectItem(item.id, multiple)

  if (multiple) {
    e.preventDefault()
    dragging.value = false
    return
  }

  const p = toSvgPoint(e)

  if (!p) return

  grab = {
    dx: p.x - item.x,
    dy: p.y - item.y
  }

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
  if (loading.value || selectedIds.value.length !== 1) return
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

const bulkText = ref('')

const applyBulkText = () => {
  if (
      loading.value ||
      selectedIds.value.length < 2 ||
      !bulkText.value.trim()
  ) return

  updateSelectedText(bulkText.value)

  bulkText.value = ''
}

watch(selectedIds, () => {
  bulkText.value = ''
})
</script>

<template>
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
      <template v-if="selected && selectedIds.length === 1">
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
            :class="{ selected: isSelected(item.id), overflow: overflows(item.id) }"
            @pointerdown="onItemPointerDown(item, $event)"
        />
      </template>

      <circle
          v-if="selected && selectedIds.length === 1"
          :cx="selected.x"
          :cy="selected.y"
          r="8"
          class="origin"
      />
    </svg>

    <p
        v-if="selected && selectedIds.length === 1"
        class="coords"
    >
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

    <div
        v-if="selectedIds.length > 1"
        class="bulk-editor"
    >
      <div class="bulk-header">
        <h3>Edit selected texts</h3>

        <span class="selection-count">
            {{ selectedIds.length }} selected
        </span>
      </div>

      <label class="bulk-label" for="bulk-text">
        New text
      </label>

      <input
          id="bulk-text"
          v-model="bulkText"
          type="text"
          placeholder="Enter text for selected items"
          :disabled="loading"
          @keydown.enter.prevent="applyBulkText"
      />

      <button
          type="button"
          class="btn ghost"
          :disabled="loading || !bulkText.trim()"
          @click="applyBulkText"
      >
        Apply to selected
      </button>

      <p class="hint">
        Only the text content will be modified.
        Font, size and position will be preserved.
      </p>
    </div>

    <details class="request">
      <summary>Show request</summary>
      <p class="endpoint">
        <span class="method">POST</span>
        <span class="url">{{ endpoint }}</span>
      </p>
      <pre class="payload">{{ payload }}</pre>
    </details>
  </section>
</template>

<style scoped src="../assets/print-ui.css"></style>

<style scoped>
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

.label-canvas:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.bulk-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 20px;
  padding: 16px;
  border: 1px solid var(--accent);
  background: var(--accent-bg);
  border-radius: 10px;
}

.bulk-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.bulk-header h3 {
  margin: 0;
  font-size: 15px;
  color: var(--text-h);
  font-weight: 600;
}

.selection-count {
  font-size: 12px;
  color: var(--accent);
  font-weight: 600;
  background: var(--bg);
  padding: 4px 10px;
  border-radius: 6px;
}

.bulk-label {
  font-size: 14px;
  color: var(--text-h);
  font-weight: 500;
}

.bulk-editor input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  font: inherit;
  font-size: 14px;
  color: var(--text-h);
  background: var(--bg);
  border: 1px solid #ffffff;
  border-radius: 8px;
}

.bulk-editor input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}

.bulk-editor .btn {
  width: 100%;
}
</style>
