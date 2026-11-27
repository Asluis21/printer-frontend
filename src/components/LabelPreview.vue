<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { PrintEditor } from '../composables/usePrintEditor'
import type { EditorItem, Box } from '../types/printer'

const props = defineProps<{
  editor: PrintEditor
}>()

const {
  items,
  selected,
  selectedIndex,
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
  selectedIds,
  isSelected,
  selectItem
} = props.editor

/* ---------- Preview fonts ---------- */

type PreviewFont = {
  family: string
  weight?: number
  stretch?: string
}

const SANS = '"Univers", "Helvetica Neue", Helvetica, Arial, sans-serif'
const SANS_CONDENSED = '"Univers Condensed", "Helvetica Neue", "Arial Narrow", Arial, sans-serif'
const SERIF = '"Times New Roman", Times, serif'
const MONO = '"Andale Mono", Menlo, Consolas, "Courier New", monospace'
const MONO_821 = 'Menlo, Consolas, "DejaVu Sans Mono", monospace'

const previewFonts: Record<string, PreviewFont> = {
  'Univers': {
    family: SANS
  },
  'Univers Bold': {
    family: SANS,
    weight: 700
  },
  'Univers Condensed Bold': {
    family: SANS_CONDENSED,
    weight: 700,
    stretch: 'condensed'
  },
  'Univers Extra Condensed': {
    family: SANS_CONDENSED,
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
    family: '"Century Schoolbook", "New Century Schoolbook", "Century Schoolbook L", Georgia, serif'
  },
  'Dutch 801 Roman': {
    family: SERIF
  },
  'CG Triumvirate Condensed Bold': {
    family: SANS_CONDENSED,
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
    family: '"Letter Gothic", "Letter Gothic Std", "Courier New", monospace'
  },
  'OCR A': {
    family: '"OCR A Std", "OCR A Extended", "OCR-A", "Courier New", monospace'
  },
  'OCR B': {
    family: '"OCR B", "OCR-B", "OCR B Std", "Courier New", monospace'
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

/* ---------- SVG references ---------- */

const svgEl = ref<SVGSVGElement | null>(null)

const dragging = ref(false)

const itemEls = new Map<number, SVGGElement>()

let grab = {
  dx: 0,
  dy: 0
}

let pointerStart = {
  x: 0,
  y: 0
}

let activePointerId: number | null = null

const setItemEl = (id: number, el: unknown) => {
  if (el instanceof SVGGElement) {
    itemEls.set(id, el)
  } else {
    itemEls.delete(id)
  }
}

/* ---------- Inline text editing ---------- */

const editingId = ref<number | null>(null)

const inlineInput = ref<HTMLInputElement | null>(null)

let originalText = ''

const editingItem = computed(() =>
    items.value.find(
        item => item.id === editingId.value
    ) ?? null
)

const editorWidth = 360
const editorHeight = 58

const editorX = computed(() =>
    clamp(
        editingItem.value?.x ?? 0,
        0,
        Math.max(0, label.width - editorWidth)
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
    e: MouseEvent
) => {
  if (
      loading.value ||
      e.metaKey ||
      e.ctrlKey
  ) return

  onPointerUp()

  if (editingId.value === item.id) return

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
    nextTick(() => {
      svgEl.value?.focus()
    })
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

watch(editingItem, (item) => {
  if (!item) {
    editingId.value = null
  }
})

watch(loading, (value) => {
  if (value) {
    finishEditing()
    onPointerUp()
  }
})

/* ---------- Measure text ---------- */

const measure = () => {
  const next: Record<number, Box> = {}

  for (const item of items.value) {
    const el = itemEls.get(item.id)

    if (!el) continue

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

/* ---------- SVG coordinates ---------- */

const toSvgPoint = (e: PointerEvent) => {
  const ctm = svgEl.value?.getScreenCTM()

  if (!ctm) return null

  return new DOMPoint(
      e.clientX,
      e.clientY
  ).matrixTransform(ctm.inverse())
}

/* ---------- Selection and dragging ---------- */

const onItemPointerDown = (
    item: EditorItem,
    e: PointerEvent
) => {
  if (
      loading.value ||
      e.button !== 0
  ) return

  if (editingId.value !== null) {
    finishEditing()
  }

  const multiple = e.metaKey || e.ctrlKey

  selectItem(item.id, multiple)

  if (multiple) {
    e.preventDefault()

    onPointerUp()

    return
  }

  const p = toSvgPoint(e)

  if (!p) return

  grab = {
    dx: p.x - item.x,
    dy: p.y - item.y
  }

  pointerStart = {
    x: e.clientX,
    y: e.clientY
  }

  activePointerId = e.pointerId

  dragging.value = false

  svgEl.value?.focus({
    preventScroll: true
  })

  const target = e.currentTarget as SVGRectElement

  target.setPointerCapture(e.pointerId)
}

const onPointerMove = (e: PointerEvent) => {
  const item = selected.value

  if (
      loading.value ||
      editingId.value !== null ||
      activePointerId !== e.pointerId ||
      !item
  ) return

  /*
   * Minimum movement before dragging.
   * Prevents accidental movement during double-click.
   */

  const distance = Math.hypot(
      e.clientX - pointerStart.x,
      e.clientY - pointerStart.y
  )

  if (!dragging.value && distance < 3) return

  dragging.value = true

  const p = toSvgPoint(e)

  if (!p) return

  item.x = clamp(
      Math.round(p.x - grab.dx),
      0,
      maxX
  )

  item.y = clamp(
      Math.round(p.y - grab.dy),
      0,
      maxY
  )
}

const onPointerUp = () => {
  dragging.value = false

  activePointerId = null
}

/* ---------- Keyboard controls ---------- */

const onPreviewKeydown = (e: KeyboardEvent) => {
  if (
      loading.value ||
      editingId.value !== null ||
      selectedIds.value.length !== 1
  ) return

  const item = selected.value

  if (!item) return

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

  item.x = clamp(
      item.x + move[0],
      0,
      maxX
  )

  item.y = clamp(
      item.y + move[1],
      0,
      maxY
  )
}
</script>

<template>
  <section class="card">

    <!-- Header -->

    <div class="card-head">

      <h2 class="section-title">
        Label preview
      </h2>

      <span class="size">
        101.5 × 74.9 mm ·
        {{ label.width }} × {{ label.height }} dots
      </span>

    </div>

    <!-- SVG preview -->

    <svg
        ref="svgEl"
        class="label-canvas"
        :class="{ dragging }"
        :viewBox="`0 0 ${label.width} ${label.height}`"
        tabindex="0"
        role="group"
        :aria-label="
        selectedIds.length > 1
          ? `Label preview. ${selectedIds.length} texts selected.`
          : selected
            ? `Label preview. Text ${selectedIndex + 1} selected at X ${selected.x}, Y ${selected.y}.`
            : 'Label preview.'
      "
        @pointerdown="finishEditing()"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @lostpointercapture="onPointerUp"
        @keydown="onPreviewKeydown"
    >

      <!-- Grid definition -->

      <defs>
        <pattern
            id="grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
        >
          <path
              d="M 40 0 L 0 0 0 40"
              class="grid-line"
          />
        </pattern>
      </defs>

      <!-- Label background -->

      <rect
          :width="label.width"
          :height="label.height"
          class="label-bg"
      />

      <rect
          :width="label.width"
          :height="label.height"
          fill="url(#grid)"
      />

      <!-- Guides for single selection -->

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
          :ref="(el) => setItemEl(item.id, el)"
      >

        <g
            :transform="`rotate(${dirDegrees(item.dir)} ${item.x} ${item.y})`"
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

      <!-- Selection outlines -->

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
            rx="4"
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

      <!-- Origin point -->

      <circle
          v-if="
          selected &&
          selectedIds.length === 1 &&
          editingId === null
        "
          :cx="selected.x"
          :cy="selected.y"
          r="8"
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

    <!-- Single selection information -->

    <p
        v-if="selected && selectedIds.length === 1"
        class="coords"
    >

      <span>
        Text <strong>{{ selectedIndex + 1 }}</strong>
      </span>

      <span>
        X <strong>{{ selected.x }}</strong>
      </span>

      <span>
        Y <strong>{{ selected.y }}</strong>
      </span>

      <span>
        <strong>{{ dirDegrees(selected.dir) }}°</strong>
      </span>

      <span
          v-if="editingId !== null"
          class="editing-indicator"
      >
        Editing
      </span>

    </p>

    <!-- Multiple selection information -->

    <p
        v-if="selectedIds.length > 1"
        class="selection-count"
    >
      {{ selectedIds.length }} texts selected.
      Use Quick edit to change their content.
    </p>

    <!-- Instructions -->

    <p class="hint">
      Click a text to select it.
      Double-click to edit its content.
      Drag to change its position.
      Hold Cmd or Ctrl to select multiple texts.
      Arrow keys move a single selected text
      (hold Shift for 10).
      Press Enter to finish editing or Escape to cancel.
      Red outlines may run off the label.
      The preview is approximate:
      the printer's fonts look a bit different.
    </p>

    <!-- Request information -->

    <details class="request">

      <summary>
        Show request
      </summary>

      <p class="endpoint">

        <span class="method">
          POST
        </span>

        <span class="url">
          {{ endpoint }}
        </span>

      </p>

      <pre class="payload">{{ payload }}</pre>

    </details>

  </section>
</template>

<style scoped src="../assets/print-ui.css"></style>

<style scoped>
/* ---------- Header ---------- */

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.card-head .section-title {
  margin: 0;
}

.size {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

/* ---------- Label preview ---------- */

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

.label-canvas:focus-visible {
  outline: 2px solid var(--accent);
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
  stroke: var(--accent);
  stroke-width: 1;
  stroke-dasharray: 4 4;
  opacity: 0.6;
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

.hit.editing {
  stroke: transparent;
  pointer-events: none;
}

.origin {
  fill: var(--accent);
  stroke: var(--label-bg);
  stroke-width: 2;
  pointer-events: none;
}

/* ---------- Inline text editor ---------- */

.inline-editor {
  overflow: visible;
  cursor: text;
}

.inline-input {
  display: block;

  width: 100%;
  height: 100%;

  box-sizing: border-box;

  padding: 4px 10px;

  font-family: Arial, sans-serif;
  font-size: 30px;
  font-weight: 400;

  color: #111111;
  background: #ffffff;

  border: 2px solid var(--accent);
  border-radius: 4px;

  outline: none;

  cursor: text;

  user-select: text;
  -webkit-user-select: text;

  box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15);
}

.inline-input::selection {
  background: var(--accent);
  color: #ffffff;
}

.editing-indicator {
  color: var(--accent);
  background: var(--accent-bg);
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 600;
}

/* ---------- Selection information ---------- */

.coords {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;

  margin: 12px 0 4px;

  font-family: var(--mono);
  font-size: 14px;
}

.coords strong {
  color: var(--text-h);
}

.selection-count {
  margin: 12px 0;

  font-size: 13px;
  font-weight: 600;

  color: var(--accent);
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
</style>