<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  ref,
  watch
} from 'vue'

import type { PrintEditor } from '../composables/usePrintEditor'
import type { EditorItem, Box } from '../types/printer'
import { DOTS_PER_MM } from '../services/printerService'

const props = defineProps<{
  editor: PrintEditor
}>()

const {
  items,
  selected,
  selectedIndex,
  selectedIds,
  loading,
  label,
  maxX,
  maxY,
  boxes,
  clamp,
  dirDegrees,
  ptToDots,
  overflows,
  endpoint,
  payload,
  isSelected,
  selectItem
} = props.editor

/* ---------- Workspace controls ---------- */

const MIN_ZOOM = 25
const MAX_ZOOM = 400

const zoom = ref(75)
const showGrid = ref(true)

const canvasScroll = ref<HTMLDivElement | null>(null)
const svgEl = ref<SVGSVGElement | null>(null)

const changeZoom = (delta: number) => {
  zoom.value = clamp(
      zoom.value + delta,
      MIN_ZOOM,
      MAX_ZOOM
  )
}

const fitWidth = async () => {
  zoom.value = 100

  await nextTick()

  canvasScroll.value?.scrollTo({
    left: 0,
    top: 0
  })

  syncRulers()
}

const onCanvasWheel = async (e: WheelEvent) => {
  // Allow normal scrolling without modifiers.
  if (!e.metaKey && !e.ctrlKey) return

  e.preventDefault()

  const container = canvasScroll.value

  if (!container || e.deltaY === 0) return

  const previousZoom = zoom.value

  const rect = container.getBoundingClientRect()

  const mouseX =
      e.clientX - rect.left - container.clientLeft

  const mouseY =
      e.clientY - rect.top - container.clientTop

  const previousCanvasRect =
      svgEl.value?.getBoundingClientRect()

  if (!previousCanvasRect?.width || !previousCanvasRect.height) return

  // Relative position of the cursor inside the label.
  const relativeX =
      (e.clientX - previousCanvasRect.left) /
      previousCanvasRect.width

  const relativeY =
      (e.clientY - previousCanvasRect.top) /
      previousCanvasRect.height

  const delta = e.deltaY < 0 ? 10 : -10

  changeZoom(delta)

  if (zoom.value === previousZoom) return

  await nextTick()

  const newCanvasRect =
      svgEl.value?.getBoundingClientRect()

  if (!newCanvasRect) return

  const targetX =
      newCanvasRect.left -
      rect.left -
      container.clientLeft +
      relativeX * newCanvasRect.width

  const targetY =
      newCanvasRect.top -
      rect.top -
      container.clientTop +
      relativeY * newCanvasRect.height

  container.scrollLeft += targetX - mouseX

  container.scrollTop += targetY - mouseY

  syncRulers()
}

/* ---------- Dynamic rulers ---------- */

type RulerAxis = {
  offset: number
  pxPerMm: number
  viewport: number
}

const rulerXEl = ref<HTMLDivElement | null>(null)
const rulerYEl = ref<HTMLDivElement | null>(null)

const axisX = ref<RulerAxis>({
  offset: 0,
  pxPerMm: 0,
  viewport: 0
})

const axisY = ref<RulerAxis>({
  offset: 0,
  pxPerMm: 0,
  viewport: 0
})

const rulerSteps = [
  { major: 0.5, minor: 0.1 },
  { major: 1, minor: 0.2 },
  { major: 2, minor: 0.5 },
  { major: 5, minor: 1 },
  { major: 10, minor: 2 },
  { major: 20, minor: 5 },
  { major: 50, minor: 10 },
  { major: 100, minor: 20 },
  { major: 200, minor: 50 }
]

const buildTicks = (
    lengthDots: number,
    axis: RulerAxis
) => {
  if (axis.pxPerMm <= 0) return []

  const step =
      rulerSteps.find(
          step => step.major * axis.pxPerMm >= 50
      ) ?? rulerSteps[rulerSteps.length - 1]!

  const lengthMm = lengthDots / DOTS_PER_MM

  const spacing = step.minor * axis.pxPerMm

  const subdivisions = Math.round(
      step.major / step.minor
  )

  const first = Math.max(
      0,
      Math.ceil(-axis.offset / spacing)
  )

  const last = Math.min(
      Math.floor(lengthMm / step.minor),
      Math.floor(
          (axis.viewport - axis.offset) / spacing
      )
  )

  return Array.from(
      { length: Math.max(0, last - first + 1) },
      (_, index) => {
        const i = first + index

        const mm = Number(
            (i * step.minor).toFixed(2)
        )

        return {
          mm,
          position: axis.offset + mm * axis.pxPerMm,
          major: i % subdivisions === 0
        }
      }
  )
}

const rulerX = computed(() =>
    buildTicks(label.width, axisX.value)
)

const rulerY = computed(() =>
    buildTicks(label.height, axisY.value)
)

/* ---------- Ruler synchronization ---------- */

function syncRulers() {
  const canvas = svgEl.value
  const horizontal = rulerXEl.value
  const vertical = rulerYEl.value
  const container = canvasScroll.value

  if (!canvas || !horizontal || !vertical || !container) return

  const canvasRect = canvas.getBoundingClientRect()
  const horizontalRect = horizontal.getBoundingClientRect()
  const verticalRect = vertical.getBoundingClientRect()

  if (
      canvasRect.width <= 0 ||
      canvasRect.height <= 0
  ) return

  axisX.value = {
    offset: canvasRect.left - horizontalRect.left,

    pxPerMm:
        canvasRect.width /
        (label.width / DOTS_PER_MM),

    viewport: Math.min(horizontal.clientWidth, container.clientWidth)
  }

  axisY.value = {
    offset: canvasRect.top - verticalRect.top,

    pxPerMm:
        canvasRect.height /
        (label.height / DOTS_PER_MM),

    viewport: Math.min(vertical.clientHeight, container.clientHeight)
  }
}

let rulerObserver: ResizeObserver | null = null

onMounted(async () => {
  await nextTick()

  syncRulers()

  rulerObserver = new ResizeObserver(() => {
    syncRulers()
  })

  if (canvasScroll.value) {
    rulerObserver.observe(canvasScroll.value)
  }

  if (svgEl.value) {
    rulerObserver.observe(svgEl.value)
  }
})

onBeforeUnmount(() => {
  rulerObserver?.disconnect()
})

watch(zoom, syncRulers, {
  flush: 'post'
})

/* ---------- Preview fonts ---------- */

type PreviewFont = {
  family: string
  weight?: number
  stretch?: string
}

const SANS = '"Univers", "Helvetica Neue", Helvetica, Arial, sans-serif'

const CONDENSED =
    '"Univers Condensed", "Arial Narrow", Arial, sans-serif'

const SERIF = '"Times New Roman", Times, serif'

const MONO =
    '"Andale Mono", Menlo, Consolas, "Courier New", monospace'

const MONO_821 =
    'Menlo, Consolas, "DejaVu Sans Mono", monospace'

const previewFonts: Record<string, PreviewFont> = {
  'Univers': {
    family: SANS
  },
  'Univers Bold': {
    family: SANS,
    weight: 700
  },
  'Univers Condensed Bold': {
    family: CONDENSED,
    weight: 700,
    stretch: 'condensed'
  },
  'Univers Extra Condensed': {
    family: CONDENSED,
    stretch: 'extra-condensed'
  },
  'CG Times': {
    family: SERIF
  },
  'CG Times Bold': {
    family: SERIF,
    weight: 700
  },
  'Century Schoolbook Roman': {
    family: '"Century Schoolbook", Georgia, serif'
  },
  'Dutch 801 Roman': {
    family: SERIF
  },
  'CG Triumvirate Condensed Bold': {
    family: CONDENSED,
    weight: 700,
    stretch: 'condensed'
  },
  'Andale Mono': {
    family: MONO
  },
  'Andale Mono Bold': {
    family: MONO,
    weight: 700
  },
  'Monospace 821': {
    family: MONO_821
  },
  'Monospace 821 Bold': {
    family: MONO_821,
    weight: 700
  },
  'Letter Gothic': {
    family: '"Letter Gothic", "Courier New", monospace'
  },
  'OCR A': {
    family: '"OCR A Std", "OCR-A", monospace'
  },
  'OCR B': {
    family: '"OCR B", "OCR-B", monospace'
  }
}

const previewFontStyle = (font: string) => {
  const f = previewFonts[font] ?? previewFonts['Univers']!

  return {
    fontFamily: f.family,
    fontWeight: f.weight ?? 400,
    fontStretch: f.stretch ?? 'normal'
  }
}

/* ---------- Measure SVG elements ---------- */

const itemEls = new Map<number, SVGGElement>()

const setItemEl = (id: number, el: unknown) => {
  if (el instanceof SVGGElement) {
    itemEls.set(id, el)
  } else {
    itemEls.delete(id)
  }
}

const measure = () => {
  const next: Record<number, Box> = {}

  for (const item of items.value) {
    const el = itemEls.get(item.id)

    if (!el?.isConnected) continue

    const b = el.getBBox()

    next[item.id] = {
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height
    }
  }

  boxes.value = next
}

watch(
    items,
    () => nextTick(measure),
    { deep: true }
)

onMounted(() => {
  measure()
  document.fonts?.ready.then(measure)
})

/* ---------- Inline editing ---------- */

const editingId = ref<number | null>(null)
const inlineInput = ref<HTMLInputElement | null>(null)

let originalText = ''

const editingItem = computed(() =>
    items.value.find(
        item => item.id === editingId.value
    ) ?? null
)

const editorWidth = computed(() =>
    Math.min(
        label.width,
        Math.max(
            280,
            (editingItem.value
                ? boxes.value[editingItem.value.id]?.width ?? 0
                : 0) + 32
        )
    )
)

const editorHeight = 58

const editorX = computed(() =>
    clamp(
        editingItem.value?.x ?? 0,
        0,
        Math.max(0, label.width - editorWidth.value)
    )
)

const editorY = computed(() =>
    clamp(
        editingItem.value?.y ?? 0,
        0,
        Math.max(0, label.height - editorHeight)
    )
)

const startEditing = async (
    item: EditorItem,
    e?: MouseEvent
) => {
  if (loading.value || e?.metaKey || e?.ctrlKey) return

  onPointerUp()

  if (editingId.value === item.id) return

  finishEditing()

  selectItem(item.id)

  originalText = item.text
  editingId.value = item.id

  await nextTick()

  inlineInput.value?.focus()
  inlineInput.value?.select()
}

const finishEditing = (
    cancel = false,
    restoreFocus = false
) => {
  if (editingId.value === null) return

  const item = editingItem.value

  if (cancel && item) {
    item.text = originalText
  }

  editingId.value = null
  originalText = ''

  if (restoreFocus) {
    nextTick(() => svgEl.value?.focus())
  }
}

const onInlineKeydown = (e: KeyboardEvent) => {
  e.stopPropagation()

  if (e.isComposing) return

  if (e.key === 'Enter') {
    e.preventDefault()
    finishEditing(false, true)
  }

  if (e.key === 'Escape') {
    e.preventDefault()
    finishEditing(true, true)
  }
}

watch(editingItem, item => {
  if (!item) editingId.value = null
})

/* ---------- SVG coordinates ---------- */

const toSvgPoint = (e: PointerEvent) => {
  const matrix = svgEl.value?.getScreenCTM()

  if (!matrix) return null

  return new DOMPoint(
      e.clientX,
      e.clientY
  ).matrixTransform(matrix.inverse())
}

/* ---------- Selection and dragging ---------- */

const dragging = ref(false)

let activeDrag: {
  id: number
  pointerId: number
  startX: number
  startY: number
  dx: number
  dy: number
} | null = null

const onItemPointerDown = (
    item: EditorItem,
    e: PointerEvent
) => {
  if (loading.value || e.button !== 0) return

  finishEditing()

  const multiple = e.metaKey || e.ctrlKey

  selectItem(item.id, multiple)

  if (multiple) {
    e.preventDefault()
    onPointerUp()
    return
  }

  const p = toSvgPoint(e)

  if (!p) return

  activeDrag = {
    id: item.id,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    dx: p.x - item.x,
    dy: p.y - item.y
  }

  dragging.value = false

  svgEl.value?.focus({
    preventScroll: true
  })

  const target = e.currentTarget as SVGRectElement

  target.setPointerCapture(e.pointerId)
}

const onPointerMove = (e: PointerEvent) => {
  const drag = activeDrag
  const item = selected.value

  if (
      loading.value ||
      editingId.value !== null ||
      !drag ||
      drag.pointerId !== e.pointerId ||
      selectedIds.value.length !== 1 ||
      !item ||
      item.id !== drag.id
  ) return

  const distance = Math.hypot(
      e.clientX - drag.startX,
      e.clientY - drag.startY
  )

  if (!dragging.value && distance < 3) return

  dragging.value = true

  const p = toSvgPoint(e)

  if (!p) return

  item.x = clamp(
      Math.round(p.x - drag.dx),
      0,
      maxX
  )

  item.y = clamp(
      Math.round(p.y - drag.dy),
      0,
      maxY
  )
}

const onPointerUp = (e?: PointerEvent) => {
  if (
      e &&
      activeDrag &&
      activeDrag.pointerId !== e.pointerId
  ) return

  dragging.value = false
  activeDrag = null
}

watch(loading, value => {
  if (value) {
    finishEditing()
    onPointerUp()
  }
})

/* ---------- Keyboard controls ---------- */

const onPreviewKeydown = (e: KeyboardEvent) => {
  if (
      loading.value ||
      editingId.value !== null ||
      selectedIds.value.length !== 1
  ) return

  const item = selected.value

  if (!item) return

  if (e.key === 'F2') {
    e.preventDefault()
    void startEditing(item)
    return
  }

  const step = e.shiftKey ? 10 : 1

  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step]
  }

  const move = moves[e.key]

  if (!move) return

  e.preventDefault()

  item.x = clamp(item.x + move[0], 0, maxX)
  item.y = clamp(item.y + move[1], 0, maxY)
}
</script>

<template>
  <section class="card preview-card">

    <!-- Preview header -->

    <div class="card-head">

      <div>
        <h2 class="section-title">Label preview</h2>

        <p class="size">
          101.5 × 74.9 mm ·
          {{ label.width }} × {{ label.height }} dots
        </p>
      </div>

      <button
          type="button"
          class="btn small ghost"
          :class="{ 'grid-active': showGrid }"
          :aria-pressed="showGrid"
          title="Toggle grid visibility"
          @click="showGrid = !showGrid"
      >
        {{ showGrid ? 'Hide grid' : 'Show grid' }}
      </button>

    </div>

    <!-- Scrollable workspace -->

    <div class="canvas-workspace">

      <!-- Ruler intersection -->

      <div class="ruler-corner">
        mm
      </div>

      <!-- Fixed horizontal ruler -->

      <div
          ref="rulerXEl"
          class="ruler-x"
          aria-hidden="true"
      >

        <div
            v-for="tick in rulerX"
            :key="tick.mm"
            class="ruler-tick-x"
            :class="{ major: tick.major }"
            :style="{ left: `${tick.position}px` }"
        >

          <span v-if="tick.major">
            {{ tick.mm }}
          </span>

        </div>

      </div>

      <!-- Fixed vertical ruler -->

      <div
          ref="rulerYEl"
          class="ruler-y"
          aria-hidden="true"
      >

        <div
            v-for="tick in rulerY"
            :key="tick.mm"
            class="ruler-tick-y"
            :class="{ major: tick.major }"
            :style="{ top: `${tick.position}px` }"
        >

          <span v-if="tick.major">
            {{ tick.mm }}
          </span>

        </div>

      </div>

      <!-- Scrollable canvas -->

      <div
          ref="canvasScroll"
          class="canvas-scroll"
          @wheel="onCanvasWheel"
          @scroll.passive="syncRulers"
      >

        <div
            class="canvas-sheet"
            :style="{ width: `${zoom}%` }"
        >

          <!-- Label canvas -->

          <svg
              ref="svgEl"
              class="label-canvas"
              :class="{ dragging }"
              :viewBox="`0 0 ${label.width} ${label.height}`"
              tabindex="0"
              role="group"
              :aria-label="
              `Label preview. ${selectedIds.length} texts selected.`
            "
              @pointerdown="finishEditing()"
              @pointermove="onPointerMove"
              @pointerup="onPointerUp"
              @pointercancel="onPointerUp"
              @lostpointercapture="onPointerUp"
              @keydown="onPreviewKeydown"
          >

            <defs>

              <pattern
                  id="grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
              >
                <path
                    d="M40 0H0V40"
                    class="grid-line"
                />
              </pattern>

            </defs>

            <rect
                :width="label.width"
                :height="label.height"
                class="label-bg"
            />

            <rect
                v-if="showGrid"
                :width="label.width"
                :height="label.height"
                fill="url(#grid)"
            />

            <!-- Position guides -->

            <template
                v-if="
                selected &&
                selectedIds.length === 1 &&
                editingId === null
              "
            >

              <line
                  :x1="selected.x"
                  y1="0"
                  :x2="selected.x"
                  :y2="label.height"
                  class="guide"
              />

              <line
                  x1="0"
                  :y1="selected.y"
                  :x2="label.width"
                  :y2="selected.y"
                  class="guide"
              />

            </template>

            <!-- Text elements -->

            <g
                v-for="(item, index) in items"
                :key="item.id"
                :ref="el => setItemEl(item.id, el)"
            >

              <g
                  :transform="`rotate(
                  ${dirDegrees(item.dir)}
                  ${item.x}
                  ${item.y}
                )`"
              >

                <text
                    :x="item.x"
                    :y="item.y"
                    :font-size="ptToDots(item.fontSize)"
                    :style="previewFontStyle(item.font)"
                    dominant-baseline="hanging"
                    class="label-text"
                    :class="{
                    placeholder: !item.text,
                    'being-edited': editingId === item.id
                  }"
                >{{ item.text || `Text ${index + 1}` }}</text>

              </g>

            </g>

            <!-- Selection areas -->

            <template
                v-for="item in items"
                :key="`hit-${item.id}`"
            >

              <rect
                  v-if="boxes[item.id]"
                  :x="boxes[item.id]!.x - 4"
                  :y="boxes[item.id]!.y - 4"
                  :width="boxes[item.id]!.width + 8"
                  :height="boxes[item.id]!.height + 8"
                  rx="3"
                  class="hit"
                  :class="{
                  selected: isSelected(item.id),
                  overflow: overflows(item.id),
                  editing: editingId === item.id
                }"
                  @pointerdown.stop="onItemPointerDown(item, $event)"
                  @dblclick.stop.prevent="startEditing(item, $event)"
              />

            </template>

            <!-- Text origin -->

            <circle
                v-if="
                selected &&
                selectedIds.length === 1 &&
                editingId === null
              "
                :cx="selected.x"
                :cy="selected.y"
                r="5"
                class="origin"
            />

            <!-- Inline text editor -->

            <foreignObject
                v-if="editingItem"
                :x="editorX"
                :y="editorY"
                :width="editorWidth"
                :height="editorHeight"
                class="inline-editor"
                @pointerdown.stop
                @pointermove.stop
                @click.stop
                @dblclick.stop
            >

              <input
                  ref="inlineInput"
                  v-model="editingItem.text"
                  type="text"
                  class="inline-input"
                  aria-label="Edit label text"
                  autocomplete="off"
                  spellcheck="false"
                  :disabled="loading"
                  @keydown="onInlineKeydown"
                  @blur="finishEditing()"
              />

            </foreignObject>

          </svg>

        </div>

      </div>

    </div>

    <!-- Preview toolbar -->

    <div class="preview-toolbar">

      <div class="zoom-controls">

        <button
            type="button"
            class="zoom-button"
            aria-label="Zoom out"
            :disabled="zoom <= MIN_ZOOM"
            @click="changeZoom(-25)"
        >
          −
        </button>

        <span class="zoom-value">{{ zoom }}%</span>

        <button
            type="button"
            class="zoom-button"
            aria-label="Zoom in"
            :disabled="zoom >= MAX_ZOOM"
            @click="changeZoom(25)"
        >
          +
        </button>

      </div>

      <button
          type="button"
          class="btn small ghost"
          title="Fit label to workspace width"
          @click="fitWidth"
      >
        Fit width
      </button>

    </div>

    <!-- Selection status -->

    <div class="preview-status">

      <div
          v-if="selected && selectedIds.length === 1"
          class="coordinates"
      >
        <span>Text {{ selectedIndex + 1 }}</span>
        <span>X: {{ selected.x }}</span>
        <span>Y: {{ selected.y }}</span>
        <span>{{ dirDegrees(selected.dir) }}°</span>
      </div>

      <span
          v-if="editingId !== null"
          class="selection-count"
      >
        Editing
      </span>

      <span v-else class="selection-count">
        {{ selectedIds.length }} selected
      </span>

    </div>

    <!-- Quick instructions -->

    <div class="preview-help">

      <span>
        <kbd>Double-click</kbd> Edit text
      </span>

      <span>
        <kbd>Drag</kbd> Move
      </span>

      <span>
        <kbd>Cmd / Ctrl</kbd> Multi-select
      </span>

      <span>
        <kbd>Cmd / Ctrl + Scroll</kbd> Zoom
      </span>

    </div>

    <p class="hint">
      Preview fonts are approximate.
      Red outlines indicate possible overflow.
    </p>

    <!-- Request payload -->

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
.preview-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ---------- Header ---------- */

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.card-head .section-title {
  margin: 0 0 4px;
}

.size {
  color: var(--text);
  font: 11px var(--mono);
}

.grid-active {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: var(--accent-border);
}

/* ---------- Workspace and fixed rulers ---------- */

.canvas-workspace {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  grid-template-rows: 28px minmax(0, auto);
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--workspace);
}

.canvas-scroll {
  grid-column: 2;
  grid-row: 2;
  overflow: auto;
  max-height: 65vh;
  min-width: 0;
  min-height: 0;
  padding: 20px;
  overflow-anchor: none;
  background-color: var(--workspace);
  background-image: radial-gradient(
      var(--border) 0.7px,
      transparent 0.7px
  );
  background-size: 14px 14px;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

.canvas-sheet {
  display: block;
  margin-inline: auto;
  min-width: 0;
}

.ruler-corner {
  grid-column: 1;
  grid-row: 1;
  display: grid;
  place-items: center;
  background: var(--control-bg);
  color: var(--text);
  font: 10px var(--mono);
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  user-select: none;
}

.ruler-x,
.ruler-y {
  position: relative;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  background: var(--control-bg);
  color: var(--text);
  font: 10px var(--mono);
  user-select: none;
}

.ruler-x {
  grid-column: 2;
  grid-row: 1;
  border-bottom: 1px solid var(--border);
}

.ruler-y {
  grid-column: 1;
  grid-row: 2;
  border-right: 1px solid var(--border);
}

.ruler-tick-x {
  position: absolute;
  bottom: 0;
  width: 1px;
  height: 5px;
  background: var(--text);
  pointer-events: none;
}

.ruler-tick-x.major {
  height: 11px;
}

.ruler-tick-x span {
  position: absolute;
  bottom: 13px;
  left: 3px;
  white-space: nowrap;
  line-height: 1;
}

.ruler-tick-y {
  position: absolute;
  right: 0;
  width: 5px;
  height: 1px;
  background: var(--text);
  pointer-events: none;
}

.ruler-tick-y.major {
  width: 10px;
}

.ruler-tick-y span {
  position: absolute;
  right: 12px;
  top: 3px;
  white-space: nowrap;
  line-height: 1;
}

/* ---------- Canvas ---------- */

.canvas-scroll .canvas-sheet .label-canvas {
  display: block;
  width: 100%;
  height: auto;
  max-height: none;
  aspect-ratio: auto;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: var(--label-bg);
  cursor: crosshair;
  touch-action: none;
  user-select: none;
}

.label-canvas:focus-visible {
  outline: 2px solid var(--accent-border);
  outline-offset: 2px;
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
  stroke: var(--accent-border);
  stroke-width: 1;
  stroke-dasharray: 5 4;
  pointer-events: none;
}

.label-text {
  fill: var(--label-ink);
  white-space: pre;
  pointer-events: none;
}

.label-text.placeholder {
  fill: rgba(0, 0, 0, 0.3);
}

.label-text.being-edited {
  opacity: 0;
}

/* ---------- Selection ---------- */

.hit {
  fill: transparent;
  stroke: transparent;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  cursor: grab;
}

.hit:hover {
  stroke: var(--accent-border);
}

.hit.selected {
  stroke: var(--accent-border);
  stroke-dasharray: 5 3;
}

.hit.overflow {
  stroke: #dc2626;
}

.hit.editing {
  stroke: transparent;
  pointer-events: none;
}

.label-canvas.dragging,
.label-canvas.dragging .hit {
  cursor: grabbing;
}

.origin {
  fill: var(--accent-border);
  stroke: white;
  stroke-width: 2;
  pointer-events: none;
}

/* ---------- Inline editor ---------- */

.inline-editor {
  overflow: visible;
}

.inline-input {
  display: block;
  width: 100%;
  height: 100%;
  padding: 4px 10px;
  font-family: Arial, sans-serif;
  font-size: 30px;
  color: #111111;
  background: #ffffff;
  border: 2px solid var(--accent-border);
  border-radius: 4px;
  outline: none;
  cursor: text;
  user-select: text;
  -webkit-user-select: text;
}

.inline-input::selection {
  color: #ffffff;
  background: #7c3aed;
}

/* ---------- Toolbar ---------- */

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.zoom-controls {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--control-bg);
}

.zoom-button {
  width: 34px;
  height: 30px;
  border: 0;
  background: transparent;
  color: var(--text-h);
  font-size: 18px;
}

.zoom-button:hover:not(:disabled) {
  color: var(--accent);
  background: var(--accent-bg);
}

.zoom-button:disabled {
  opacity: 0.4;
}

.zoom-value {
  min-width: 58px;
  text-align: center;
  font: 12px var(--mono);
}

/* ---------- Status and help ---------- */

.preview-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 0;
  border-top: 1px solid var(--border);
}

.coordinates {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  color: var(--text);
  font: 11px var(--mono);
}

.selection-count {
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
}

.preview-help {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 11px;
  color: var(--text);
}

kbd {
  display: inline-block;
  padding: 3px 5px;
  background: var(--control-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  font: 10px var(--mono);
}

/* ---------- Request ---------- */

.request {
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.request summary {
  cursor: pointer;
  color: var(--text-h);
  font-size: 13px;
  font-weight: 500;
}

.endpoint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0;
  font: 12px var(--mono);
}

.method {
  color: var(--accent);
  background: var(--accent-bg);
  padding: 3px 7px;
  border-radius: 4px;
  font-weight: 700;
}

.url {
  overflow-wrap: anywhere;
}

.payload {
  margin: 0;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--code-bg);
  color: var(--text-h);
  font: 12px/1.6 var(--mono);
  overflow: auto;
  max-height: 300px;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 720px) {
  .canvas-scroll {
    padding: 8px;
  }
}
</style>
