<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { FONTS, MAX_ITEMS } from '../services/printerService'
import type { PrintEditor } from '../composables/usePrintEditor'
import QuickEditor from './QuickEditor.vue'
import type { ActiveEditorSection } from '../types/printer'

const activeSection = defineModel<ActiveEditorSection>(
    'activeSection',
    { required: true }
)

const props = defineProps<{
  editor: PrintEditor
}>()

const {
  items,
  copies,
  selectedId,
  loading,
  status,
  grid,
  gridCount,
  maxX,
  maxY,
  dirDegrees,
  toMm,
  addItem,
  removeItem,
  fillGrid,
  overflows,
  changeCopies,
  reset,
  onSubmit,
  isSelected,
  selectItem
} = props.editor

const formEl = ref<HTMLFormElement | null>(null)

const directions = [
  { value: 1, label: '0°' },
  { value: 2, label: '90°' },
  { value: 3, label: '180°' },
  { value: 4, label: '270°' }
]

const handleAddItem = async () => {
  addItem()

  await nextTick()

  document
      .getElementById(`item-text-${selectedId.value}`)
      ?.focus()
}

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)
const shortcutLabel = isMac ? '⌘ Enter' : 'Ctrl Enter'

const onFormKeydown = (e: KeyboardEvent) => {
  if (
      e.key === 'Enter' &&
      (e.metaKey || e.ctrlKey) &&
      !loading.value
  ) {
    e.preventDefault()
    formEl.value?.requestSubmit()
  }
}

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
      <div
          v-show="activeSection === 'text'"
          class="section"
          data-section="text"
      >
        <div class="section-head">
          <h2 class="section-title">
            Texts <span class="count">{{ items.length }} / {{ MAX_ITEMS }}</span>
          </h2>
          <button
              type="button"
              class="btn small ghost"
              :disabled="items.length >= MAX_ITEMS"
              @click="handleAddItem"
          >
            + Add text
          </button>
        </div>

        <ol class="items">
          <li
              v-for="(item, index) in items"
              :key="item.id"
              class="item"
              :class="{ selected: isSelected(item.id) }"
              @focusin="selectItem(item.id)"
              @click="selectItem(item.id)"
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

      <div
          v-show="activeSection === 'grid'"
          class="section"
          data-section="grid"
      >
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

      <div
          v-show="activeSection === 'copies'"
          class="section"
          data-section="copies"
      >
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

      <QuickEditor
          v-if="activeSection === null"
          :editor="editor"
      />

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
</template>

<style scoped src="../assets/print-ui.css"></style>

<style scoped>
fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}

/* ---------- Fields ---------- */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
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

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 28px;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
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
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  margin-top: 10px;
}

.segmented.compact {
  flex: none;
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
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
}

.grid-helper .field {
  width: 90px;
}

.grid-helper .times {
  padding-bottom: 10px;
}

.stepper button:focus-visible,
.segmented button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 480px) {
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
