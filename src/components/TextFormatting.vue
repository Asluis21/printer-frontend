<script setup lang="ts">
import { computed } from 'vue'
import type { PrintEditor } from '../composables/usePrintEditor'
import type { PreviewTextStyle } from '../types/printer'

const props = defineProps<{
  editor: PrintEditor
}>()

const {
  selected,
  selectedIds,
  loading
} = props.editor

/* ---------- Default formatting ---------- */

const defaultStyle: PreviewTextStyle = {
  italic: false,
  underline: false,
  color: '#111111'
}

const canEdit = computed(() =>
    !loading.value &&
    selectedIds.value.length === 1 &&
    selected.value !== null
)

const formatting = computed(() =>
    selected.value?.previewStyle ?? defaultStyle
)

/* ---------- Supported bold fonts ---------- */

const boldFonts: Record<string, string> = {
  'Univers': 'Univers Bold',
  'CG Times': 'CG Times Bold',
  'Andale Mono': 'Andale Mono Bold',
  'Monospace 821': 'Monospace 821 Bold'
}

const regularFonts: Record<string, string> =
    Object.fromEntries(
        Object.entries(boldFonts).map(
            ([regular, bold]) => [bold, regular]
        )
    )

const isBold = computed(() =>
    selected.value?.font.includes('Bold') ?? false
)

const canToggleBold = computed(() => {
  const font = selected.value?.font

  if (!font || !canEdit.value) return false

  return Boolean(
      boldFonts[font] || regularFonts[font]
  )
})

const toggleBold = () => {
  const item = selected.value

  if (!item || !canToggleBold.value) return

  const nextFont =
      boldFonts[item.font] ??
      regularFonts[item.font]

  if (nextFont) {
    item.font = nextFont
  }
}

/* ---------- Preview formatting ---------- */

const updateFormatting = (
    changes: Partial<PreviewTextStyle>
) => {
  const item = selected.value

  if (!item || !canEdit.value) return

  item.previewStyle = {
    ...defaultStyle,
    ...item.previewStyle,
    ...changes
  }
}

const toggleItalic = () => {
  updateFormatting({
    italic: !formatting.value.italic
  })
}

const toggleUnderline = () => {
  updateFormatting({
    underline: !formatting.value.underline
  })
}

/* ---------- Text colors ---------- */

const colors = [
  { name: 'Black', value: '#111111' },
  { name: 'Gray', value: '#64748b' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#9333ea' }
]

const changeColor = (color: string) => {
  updateFormatting({ color })
}

const onCustomColor = (event: Event) => {
  const input = event.target as HTMLInputElement

  changeColor(input.value)
}

/* ---------- Reset formatting ---------- */

const resetFormatting = () => {
  const item = selected.value

  if (!item || !canEdit.value) return

  const regularFont = regularFonts[item.font]

  if (regularFont) {
    item.font = regularFont
  }

  item.previewStyle = {
    ...defaultStyle
  }
}
</script>

<template>
  <section class="card formatting-card">

    <!-- Header -->

    <div class="formatting-header">

      <div class="formatting-heading">

        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            aria-hidden="true"
        >
          <path d="M4 6h16M12 6v14M8 20h8M4 6v3M20 6v3" />
        </svg>

        <h2 class="section-title">
          Text formatting
        </h2>

      </div>

      <button
          type="button"
          class="reset-button"
          title="Reset formatting"
          :disabled="!canEdit"
          @click="resetFormatting"
      >

        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
          <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 8" />
          <path d="M3 3v5h5" />
        </svg>

        Reset

      </button>

    </div>

    <!-- Text styles -->

    <div class="formatting-group">

      <h3>Text style</h3>

      <div class="format-buttons">

        <!-- Bold -->

        <button
            type="button"
            class="format-button bold-button"
            :class="{ active: isBold }"
            :aria-pressed="isBold"
            aria-label="Bold"
            :title="
            canToggleBold
              ? 'Bold'
              : 'No alternative bold or regular font available'
          "
            :disabled="!canToggleBold"
            @click="toggleBold"
        >
          B
        </button>

        <!-- Italic -->

        <button
            type="button"
            class="format-button italic-button"
            :class="{ active: formatting.italic }"
            :aria-pressed="formatting.italic"
            aria-label="Italic"
            title="Italic — preview only"
            :disabled="!canEdit"
            @click="toggleItalic"
        >
          I
        </button>

        <!-- Underline -->

        <button
            type="button"
            class="format-button underline-button"
            :class="{ active: formatting.underline }"
            :aria-pressed="formatting.underline"
            aria-label="Underline"
            title="Underline — preview only"
            :disabled="!canEdit"
            @click="toggleUnderline"
        >
          U
        </button>

      </div>

    </div>

    <!-- Colors -->

    <div class="formatting-group">

      <div class="color-header">

        <h3>Text color</h3>

        <span class="color-value">
          {{ formatting.color.toUpperCase() }}
        </span>

      </div>

      <div class="color-palette">

        <button
            v-for="color in colors"
            :key="color.value"
            type="button"
            class="color-button"
            :class="{
            active: formatting.color === color.value
          }"
            :style="{
            backgroundColor: color.value
          }"
            :aria-label="color.name"
            :aria-pressed="formatting.color === color.value"
            :title="color.name"
            :disabled="!canEdit"
            @click="changeColor(color.value)"
        >

          <svg
              v-if="formatting.color === color.value"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
          >
            <path d="m5 12 4 4L19 6" />
          </svg>

        </button>

      </div>

      <!-- Custom color -->

      <label class="custom-color">

        <input
            type="color"
            :value="formatting.color"
            :disabled="!canEdit"
            @input="onCustomColor"
        />

        <span>Custom color</span>

      </label>

    </div>

    <p v-if="!canEdit && !loading" class="hint">
      Select one text to change its formatting.
    </p>

    <p class="hint">
      Italic, underline and colors are preview-only.
    </p>

  </section>
</template>

<style scoped src="../assets/print-ui.css"></style>

<style scoped>
.formatting-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---------- Header ---------- */

.formatting-header,
.formatting-heading,
.color-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.formatting-header,
.color-header {
  justify-content: space-between;
}

.formatting-heading {
  min-width: 0;
}

.formatting-heading svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--accent);
}

.formatting-heading .section-title {
  margin: 0;
}

/* ---------- Reset button ---------- */

.reset-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;

  padding: 5px 8px;

  color: var(--text);
  background: transparent;

  border: 1px solid transparent;
  border-radius: 5px;

  font-size: 11px;
}

.reset-button svg {
  width: 14px;
  height: 14px;
}

.reset-button:hover:not(:disabled) {
  color: var(--accent);
  background: var(--accent-bg);
}

/* ---------- Formatting groups ---------- */

.formatting-group {
  display: flex;
  flex-direction: column;
  gap: 10px;

  padding-top: 14px;

  border-top: 1px solid var(--border);
}

.formatting-group h3 {
  margin: 0;

  color: var(--text);

  font-size: 11px;
  font-weight: 600;

  text-transform: uppercase;
  letter-spacing: 0.07em;
}

/* ---------- Format buttons ---------- */

.format-buttons {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.format-button {
  display: grid;
  place-items: center;

  min-height: 38px;

  background: var(--control-bg);
  color: var(--text-h);

  border: 1px solid var(--border);
  border-radius: 6px;

  font-size: 18px;

  transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
}

.format-button:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.format-button.active {
  color: var(--accent-ink);
  background: var(--accent);
  border-color: var(--accent);
}

.bold-button {
  font-weight: 700;
}

.italic-button {
  font-family: Georgia, serif;
  font-style: italic;
}

.underline-button {
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* ---------- Colors ---------- */

.color-value {
  color: var(--text);
  font: 11px var(--mono);
}

.color-palette {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 7px;
}

.color-button {
  display: grid;
  place-items: center;

  width: 100%;
  aspect-ratio: 1;

  padding: 0;

  border: 1px solid var(--border);
  border-radius: 5px;

  color: #ffffff;

  transition: transform 0.15s;
}

.color-button:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: var(--accent);
}

.color-button.active {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.color-button svg {
  width: 16px;
  height: 16px;
}

/* ---------- Custom color ---------- */

.custom-color {
  display: flex;
  align-items: center;
  gap: 10px;

  padding: 8px 10px;

  background: var(--workspace);
  border: 1px solid var(--border);
  border-radius: 6px;

  color: var(--text);
  font-size: 12px;
}

.custom-color input {
  width: 28px;
  height: 26px;

  padding: 0;

  border: 0;
  background: transparent;

  cursor: pointer;
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>