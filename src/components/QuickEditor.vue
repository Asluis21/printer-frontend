<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { FONTS, MAX_ITEMS } from '../services/printerService'
import type { PrintEditor } from '../composables/usePrintEditor'

const props = defineProps<{
  editor: PrintEditor
}>()

const {
  items,
  selected,
  selectedIds,
  selectedIndex,
  loading,
  maxX,
  maxY,
  overflows,
  addItem,
  removeItem,
  updateSelectedText
} = props.editor

const bulkText = ref('')
const textInput = ref<HTMLInputElement | null>(null)

const directions = [
  { value: 1, label: '0°' },
  { value: 2, label: '90°' },
  { value: 3, label: '180°' },
  { value: 4, label: '270°' }
]

const handleAdd = async () => {
  if (loading.value || items.value.length >= MAX_ITEMS) return

  addItem()

  await nextTick()

  textInput.value?.focus()
}

const changeFontSize = (delta: number) => {
  if (!selected.value || loading.value) return

  selected.value.fontSize = Math.min(
      200,
      Math.max(
          4,
          (Number(selected.value.fontSize) || 12) + delta
      )
  )
}

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
  <section class="quick-editor">

    <div class="quick-header">
      <h2 class="section-title">Quick edit</h2>

      <span class="selection-count">
        {{ selectedIds.length }} selected
      </span>
    </div>

    <button
        type="button"
        class="btn ghost full-width"
        :disabled="loading || items.length >= MAX_ITEMS"
        @click="handleAdd"
    >
      + Add text
    </button>

    <!-- Single selection -->

    <template v-if="selectedIds.length === 1 && selected">

      <div class="tool-group">

        <div class="group-header">
          <h3>Text content</h3>
          <span>Text {{ selectedIndex + 1 }}</span>
        </div>

        <input
            ref="textInput"
            v-model="selected.text"
            type="text"
            aria-label="Text content"
            placeholder="Enter text"
            required
            :disabled="loading"
        />

      </div>

      <div class="tool-group">

        <h3>Typography</h3>

        <label class="field">
          <span>Font family</span>

          <select
              v-model="selected.font"
              :disabled="loading"
          >
            <option
                v-for="font in FONTS"
                :key="font"
                :value="font"
            >
              {{ font }}
            </option>
          </select>
        </label>

        <label for="quick-size">Font size (pt)</label>

        <div class="font-size">

          <button
              type="button"
              class="tool-button"
              aria-label="Decrease font size"
              :disabled="loading || selected.fontSize <= 4"
              @click="changeFontSize(-1)"
          >
            −
          </button>

          <input
              id="quick-size"
              v-model.number="selected.fontSize"
              type="number"
              min="4"
              max="200"
              required
              :disabled="loading"
          />

          <button
              type="button"
              class="tool-button"
              aria-label="Increase font size"
              :disabled="loading || selected.fontSize >= 200"
              @click="changeFontSize(1)"
          >
            +
          </button>

        </div>

      </div>

      <div class="tool-group">

        <h3>Position</h3>

        <div class="position-grid">

          <label class="field">
            <span>X (dots)</span>

            <input
                v-model.number="selected.x"
                type="number"
                min="0"
                :max="maxX"
                required
                :disabled="loading"
            />
          </label>

          <label class="field">
            <span>Y (dots)</span>

            <input
                v-model.number="selected.y"
                type="number"
                min="0"
                :max="maxY"
                required
                :disabled="loading"
            />
          </label>

        </div>

        <p class="hint">
          Drag the text on the label to reposition it.
        </p>

      </div>

      <div class="tool-group">

        <h3>Rotation</h3>

        <div class="rotation-buttons">

          <button
              v-for="direction in directions"
              :key="direction.value"
              type="button"
              class="tool-button"
              :class="{
              active: selected.dir === direction.value
            }"
              :aria-pressed="selected.dir === direction.value"
              :disabled="loading"
              @click="selected.dir = direction.value"
          >
            {{ direction.label }}
          </button>

        </div>

      </div>

      <p
          v-if="overflows(selected.id)"
          class="warning"
      >
        This text may extend outside the label.
      </p>

      <button
          type="button"
          class="remove-button"
          :disabled="loading || items.length <= 1"
          @click="removeItem(selected.id)"
      >
        Remove text
      </button>

    </template>

    <!-- Multiple selection -->

    <template v-else-if="selectedIds.length > 1">

      <div class="tool-group">

        <h3>Multiple selection</h3>

        <p class="hint">
          Update the content of all
          {{ selectedIds.length }} selected texts.
        </p>

        <label class="field">
          <span>Shared text</span>

          <input
              v-model="bulkText"
              type="text"
              placeholder="Enter new text"
              :disabled="loading"
              @keydown.enter.stop.prevent="applyBulkText"
          />
        </label>

        <button
            type="button"
            class="btn primary full-width"
            :disabled="loading || !bulkText.trim()"
            @click="applyBulkText"
        >
          Apply to selected
        </button>

        <p class="hint">
          Font, size, position and rotation will be preserved.
        </p>

      </div>

    </template>

    <!-- Empty selection -->

    <div v-else class="empty-selection">

      <span class="empty-icon">T</span>

      <strong>No text selected</strong>

      <p class="hint">
        Select a text on the label to edit its properties.
        Hold Cmd or Ctrl to select multiple texts.
      </p>

    </div>

  </section>
</template>

<style scoped src="../assets/print-ui.css"></style>

<style scoped>
.quick-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.quick-header,
.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-header .section-title {
  margin: 0;
}

.selection-count {
  color: var(--accent);
  background: var(--accent-bg);
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
}

.full-width {
  width: 100%;
}

.tool-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.tool-group h3 {
  color: var(--text);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.group-header span {
  color: var(--accent);
  font-size: 11px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

label {
  font-size: 12px;
  color: var(--text);
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

.font-size {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 36px;
  gap: 6px;
}

.font-size input {
  text-align: center;
  appearance: textfield;
}

.font-size input::-webkit-inner-spin-button,
.font-size input::-webkit-outer-spin-button {
  appearance: none;
}

.position-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.rotation-buttons {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
}

.tool-button {
  min-height: 36px;
  padding: 6px 4px;
  background: var(--control-bg);
  border: 1px solid var(--border);
  color: var(--text-h);
  border-radius: 6px;
  font-size: 13px;
  transition: background 0.15s, border-color 0.15s;
}

.tool-button:hover:not(:disabled) {
  border-color: var(--accent);
}

.tool-button.active {
  color: var(--accent-ink);
  background: var(--accent);
  border-color: var(--accent);
}

.tool-button:disabled {
  opacity: 0.45;
}

.remove-button {
  min-height: 36px;
  color: var(--danger);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
}

.remove-button:hover:not(:disabled) {
  background: var(--danger-bg);
  border-color: var(--danger);
}

.remove-button:disabled {
  opacity: 0.4;
}

.warning {
  color: var(--danger);
  background: var(--danger-bg);
  padding: 10px;
  border-radius: 6px;
  font-size: 12px;
}

.empty-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 32px 10px;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  color: var(--accent);
  background: var(--accent-bg);
  border: 1px dashed var(--accent);
  border-radius: 8px;
  font-size: 22px;
}
</style>