<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { FONTS, MAX_ITEMS } from '../services/printerService'
import type { PrintEditor } from '../composables/usePrintEditor'
import type { ActiveEditorSection } from '../types/printer'
import QuickEditor from './QuickEditor.vue'

const props = defineProps<{
  editor: PrintEditor
}>()

const activeSection = defineModel<ActiveEditorSection>(
    'activeSection',
    { required: true }
)

const {
  items,
  copies,
  selectedId,
  selectedIds,
  loading,
  status,
  grid,
  gridCount,
  maxX,
  maxY,
  toMm,
  isSelected,
  selectItem,
  addItem,
  removeItem,
  fillGrid,
  overflows,
  changeCopies,
  onSubmit
} = props.editor

const formEl = ref<HTMLFormElement | null>(null)

const directions = [
  { value: 1, label: '0°' },
  { value: 2, label: '90°' },
  { value: 3, label: '180°' },
  { value: 4, label: '270°' }
]

const isExpanded = (id: number) =>
    selectedIds.value.length === 1 &&
    selectedId.value === id

const handleAdd = async () => {
  if (loading.value || items.value.length >= MAX_ITEMS) return

  addItem()

  await nextTick()

  document
      .getElementById(`item-text-${selectedId.value}`)
      ?.focus()
}

const handleFillGrid = () => {
  if (loading.value) return

  grid.cols = Math.min(
      10,
      Math.max(1, Math.round(Number(grid.cols)) || 1)
  )

  grid.rows = Math.min(
      10,
      Math.max(1, Math.round(Number(grid.rows)) || 1)
  )

  const removedTexts = items.value
      .slice(gridCount.value)
      .some(item => item.text.trim())

  if (
      removedTexts &&
      !window.confirm(
          'Some existing texts will be removed. Continue?'
      )
  ) return

  fillGrid()

  activeSection.value = 'text'
}

/* ---------- Keyboard shortcuts ---------- */

const onFormKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'Enter' || e.isComposing) return

  if (e.metaKey || e.ctrlKey) {
    e.preventDefault()

    if (!loading.value) {
      formEl.value?.requestSubmit()
    }

    return
  }

  // Avoid accidental printing while editing text.
  if (e.target instanceof HTMLInputElement) {
    e.preventDefault()
  }
}

/* ---------- Validation of collapsed fields ---------- */

let handlingInvalid = false
let reportingInvalid = false

const onInvalid = async (event: Event) => {
  if (reportingInvalid) return

  event.preventDefault()

  if (handlingInvalid) return

  const field = event.target

  if (
      !(field instanceof HTMLInputElement) &&
      !(field instanceof HTMLSelectElement)
  ) return

  handlingInvalid = true

  const section = field
      .closest<HTMLElement>('[data-section]')
      ?.dataset.section

  if (
      section === 'text' ||
      section === 'grid' ||
      section === 'copies'
  ) {
    activeSection.value = section
  }

  const itemId = field
      .closest<HTMLElement>('[data-item-id]')
      ?.dataset.itemId

  if (itemId !== undefined) {
    selectItem(Number(itemId))
  }

  await nextTick()

  try {
    reportingInvalid = true

    field.focus()
    field.reportValidity()
  } finally {
    reportingInvalid = false
    handlingInvalid = false
  }
}
</script>

<template>
  <form
      ref="formEl"
      class="card"
      @submit.prevent="onSubmit"
      @keydown="onFormKeydown"
      @invalid.capture="onInvalid"
  >

    <fieldset :disabled="loading">

      <!-- QUICK EDIT -->

      <QuickEditor
          v-if="activeSection === null"
          :editor="editor"
      />

      <!-- TEXT SETTINGS -->

      <div
          v-show="activeSection === 'text'"
          class="section"
          data-section="text"
      >

        <div class="section-head">
          <h2 class="section-title">Text elements</h2>

          <span class="count">
            {{ items.length }} / {{ MAX_ITEMS }}
          </span>
        </div>

        <button
            type="button"
            class="btn ghost full-width add-button"
            :disabled="items.length >= MAX_ITEMS"
            @click="handleAdd"
        >
          + Add text
        </button>

        <ol class="items">

          <li
              v-for="(item, index) in items"
              :key="item.id"
              :data-item-id="item.id"
              class="item"
              :class="{
              selected: isSelected(item.id)
            }"
          >

            <div class="item-head">

              <button
                  type="button"
                  class="item-toggle"
                  :aria-expanded="isExpanded(item.id)"
                  @click="selectItem(
                  item.id,
                  $event.metaKey || $event.ctrlKey
                )"
              >

                <span class="item-number">
                  {{ String(index + 1).padStart(2, '0') }}
                </span>

                <span class="item-summary">

                  <strong class="item-name">
                    {{ item.text || `Text ${index + 1}` }}
                  </strong>

                  <span class="item-meta">
                    {{ item.font }} · {{ item.fontSize }} pt
                  </span>

                </span>

                <svg
                    class="chevron"
                    :class="{ expanded: isExpanded(item.id) }"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>

              </button>

              <button
                  type="button"
                  class="icon-button"
                  title="Remove text"
                  :aria-label="`Remove text ${index + 1}`"
                  :disabled="items.length <= 1"
                  @click="removeItem(item.id)"
              >
                ×
              </button>

            </div>

            <!-- Keep fields mounted for native validation -->

            <div
                v-show="isExpanded(item.id)"
                class="item-properties"
            >

              <label class="field">
                <span>Content</span>

                <input
                    :id="`item-text-${item.id}`"
                    v-model="item.text"
                    type="text"
                    required
                    :placeholder="`Text ${index + 1}`"
                />
              </label>

              <label class="field">
                <span>Font family</span>

                <select v-model="item.font">
                  <option
                      v-for="font in FONTS"
                      :key="font"
                      :value="font"
                  >
                    {{ font }}
                  </option>
                </select>
              </label>

              <label class="field">
                <span>Font size (pt)</span>

                <input
                    v-model.number="item.fontSize"
                    type="number"
                    min="4"
                    max="200"
                    required
                />
              </label>

              <div class="item-grid">

                <label class="field">
                  <span>X (dots)</span>

                  <input
                      v-model.number="item.x"
                      type="number"
                      min="0"
                      :max="maxX"
                      required
                  />
                </label>

                <label class="field">
                  <span>Y (dots)</span>

                  <input
                      v-model.number="item.y"
                      type="number"
                      min="0"
                      :max="maxY"
                      required
                  />
                </label>

              </div>

              <span class="hint">
                Position:
                {{ toMm(item.x) }} × {{ toMm(item.y) }} mm
              </span>

              <div class="field">

                <span>Rotation</span>

                <div class="segmented">

                  <button
                      v-for="direction in directions"
                      :key="direction.value"
                      type="button"
                      :class="{
                      active: item.dir === direction.value
                    }"
                      :aria-pressed="item.dir === direction.value"
                      @click="item.dir = direction.value"
                  >
                    {{ direction.label }}
                  </button>

                </div>

              </div>

            </div>

            <p
                v-if="overflows(item.id)"
                class="warning"
            >
              Text may extend outside the label.
            </p>

          </li>

        </ol>

        <p
            v-if="selectedIds.length > 1"
            class="hint selection-hint"
        >
          {{ selectedIds.length }} texts selected.
          Close Text settings to edit them together.
        </p>

      </div>

      <!-- GRID SETTINGS -->

      <div
          v-show="activeSection === 'grid'"
          class="section"
          data-section="grid"
      >

        <h2 class="section-title">Grid settings</h2>

        <p class="hint">
          Automatically distribute texts across the label.
        </p>

        <div class="grid-fields">

          <label class="field">
            <span>Columns</span>

            <input
                v-model.number="grid.cols"
                type="number"
                step="any"
            />
          </label>

          <label class="field">
            <span>Rows</span>

            <input
                v-model.number="grid.rows"
                type="number"
                step="any"
            />
          </label>

        </div>

        <div class="grid-result">

          <strong>{{ gridCount }}</strong>

          <span>Text elements</span>

        </div>

        <button
            type="button"
            class="btn primary full-width"
            @click="handleFillGrid"
        >
          Fill label
        </button>

        <p class="hint">
          Up to 10 rows and 10 columns,
          with a maximum of {{ MAX_ITEMS }} texts.
          Existing content is preserved in order
          when possible.
        </p>

      </div>

      <!-- COPIES SETTINGS -->

      <!-- COPIES SETTINGS -->

      <div
          v-show="activeSection === 'copies'"
          class="section"
          data-section="copies"
      >
        <h2 class="section-title">
          Copies settings
        </h2>

        <p class="hint">
          Choose how many identical labels to print.
        </p>

        <label class="field" for="copies">
          Number of copies
        </label>

        <div class="stepper">

          <button
              type="button"
              aria-label="Decrease copies"
              :disabled="copies <= 1"
              @click="changeCopies(-1)"
          >
            −
          </button>

          <input
              id="copies"
              v-model.number="copies"
              type="number"
              min="1"
              max="99"
              required
          />

          <button
              type="button"
              aria-label="Increase copies"
              :disabled="copies >= 99"
              @click="changeCopies(1)"
          >
            +
          </button>

        </div>

        <p class="hint">
          Maximum 99 copies per print job.
        </p>
      </div>

    </fieldset>

    <!-- Printing status -->

    <div aria-live="polite">

      <p
          v-if="status"
          class="status"
          :class="status.kind"
      >
        {{ status.kind === 'success' ? '✓' : '!' }}
        {{ status.text }}
      </p>

    </div>

  </form>
</template>

<style scoped src="../assets/print-ui.css"></style>

<style scoped>
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-title {
  margin: 0;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.count {
  font-family: var(--mono);
  color: var(--text);
  font-size: 11px;
}

.full-width {
  width: 100%;
}

.add-button {
  border-style: dashed;
  color: var(--accent);
}

.items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item {
  background: var(--workspace);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px;
}

.item.selected {
  border-color: var(--accent);
  background: var(--accent-bg);
}

.item-head {
  display: flex;
  align-items: center;
  gap: 5px;
}

.item-toggle {
  flex: 1;
  display: flex;
  align-items: center;
  text-align: left;
  gap: 8px;
  min-width: 0;
  color: var(--text-h);
  background: transparent;
  border: 0;
  padding: 4px 0;
}

.item-number {
  color: var(--accent);
  font: 11px var(--mono);
}

.item-summary {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.item-name,
.item-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-name {
  font-size: 13px;
  font-weight: 500;
}

.item-meta {
  font-size: 11px;
  color: var(--text);
}

.chevron {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  transition: transform 0.15s;
}

.chevron.expanded {
  transform: rotate(180deg);
}

.icon-button {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text);
  font-size: 18px;
}

.icon-button:hover:not(:disabled) {
  color: var(--danger);
  background: var(--danger-bg);
}

.icon-button:disabled {
  opacity: 0.35;
}

.item-properties {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
  margin-top: 10px;
  border-top: 1px solid var(--border);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--text);
  font-size: 12px;
  min-width: 0;
}

input,
select {
  width: 100%;
  min-width: 0;
  height: 36px;
  padding: 8px 10px;
  background: var(--workspace);
  color: var(--text-h);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
}

input:focus,
select:focus {
  outline: none;
  border-color: var(--accent);
}

.item-grid,
.grid-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.segmented {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
}

.segmented button {
  padding: 7px 4px;
  background: var(--control-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 5px;
}

.segmented button.active {
  background: var(--accent);
  color: var(--accent-ink);
  border-color: var(--accent);
}

.grid-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 10px;
  background: var(--workspace);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.grid-result strong {
  font: 32px var(--mono);
  color: var(--accent);
}

.grid-result span {
  font-size: 12px;
  color: var(--text);
}

.stepper {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  gap: 6px;
}

.stepper input {
  text-align: center;
  appearance: textfield;
}

.stepper input::-webkit-inner-spin-button,
.stepper input::-webkit-outer-spin-button {
  appearance: none;
}

.stepper button {
  background: var(--control-bg);
  color: var(--text-h);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 18px;
}

.stepper button:disabled {
  opacity: 0.4;
}

.selection-hint {
  padding: 8px;
  background: var(--accent-bg);
  border-radius: 5px;
}

.warning {
  margin-top: 8px;
  color: var(--danger);
  font-size: 11px;
}

.status {
  padding: 12px;
  margin-top: 16px;
  border-radius: 6px;
  font-size: 13px;
}

.status.success {
  background: var(--success-bg);
  color: var(--success);
}

.status.error {
  background: var(--danger-bg);
  color: var(--danger);
}
</style>