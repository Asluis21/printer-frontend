<script setup lang="ts">
import { ref, watch } from 'vue'
import { FONTS } from '../services/printerService'
import type { PrintEditor } from '../composables/usePrintEditor'

const props = defineProps<{
  editor: PrintEditor
}>()

const {
  selected,
  selectedIds,
  selectedIndex,
  loading,
  updateSelectedText
} = props.editor

const bulkText = ref('')

const directions = [
  { value: 1, label: '0°' },
  { value: 2, label: '90°' },
  { value: 3, label: '180°' },
  { value: 4, label: '270°' }
]

const changeFontSize = (delta: number) => {
  if (!selected.value || loading.value) return

  selected.value.fontSize = Math.min(
      200,
      Math.max(4, (Number(selected.value.fontSize) || 12) + delta)
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

    <!-- Single selection -->

    <template v-if="selectedIds.length === 1 && selected">

      <p class="hint">
        Editing text {{ selectedIndex + 1 }}
      </p>

      <div class="field">
        <label for="quick-text">Text</label>

        <input
            id="quick-text"
            v-model="selected.text"
            type="text"
            placeholder="Enter text"
            :disabled="loading"
        />
      </div>

      <div class="field">
        <label for="quick-font">Font</label>

        <select
            id="quick-font"
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
      </div>

      <div class="field">
        <label for="quick-size">Font size (pt)</label>

        <div class="font-size">

          <button
              type="button"
              class="btn ghost"
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
              :disabled="loading"
          />

          <button
              type="button"
              class="btn ghost"
              aria-label="Increase font size"
              :disabled="loading || selected.fontSize >= 200"
              @click="changeFontSize(1)"
          >
            +
          </button>

        </div>
      </div>

      <div class="field">
        <label>Rotation</label>

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

      <div class="position-info">
        <span>X: {{ selected.x }}</span>
        <span>Y: {{ selected.y }}</span>
      </div>

    </template>

    <!-- Multiple selection -->

    <template v-else-if="selectedIds.length > 1">

      <div class="field">
        <label for="quick-bulk-text">
          Edit selected texts
        </label>

        <input
            id="quick-bulk-text"
            v-model="bulkText"
            type="text"
            placeholder="Enter shared text"
            :disabled="loading"
            @keydown.enter.stop.prevent="applyBulkText"
        />
      </div>

      <button
          type="button"
          class="btn ghost apply-button"
          :disabled="loading || !bulkText.trim()"
          @click="applyBulkText"
      >
        Apply to selected
      </button>

      <p class="hint">
        Only text content will be modified.
        Other properties will be preserved.
      </p>

    </template>

    <!-- Empty selection -->

    <div v-else class="empty-selection">

      <span class="empty-icon">T</span>

      <p>Select a text to edit its properties.</p>

      <p class="hint">
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
  gap: 18px;
}

.quick-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.quick-header .section-title {
  margin: 0;
}

.selection-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-bg);
  border-radius: 6px;
  padding: 4px 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  color: var(--text-h);
  font-size: 13px;
  font-weight: 500;
}

input,
select {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  background: var(--bg);
  color: var(--text-h);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  font: inherit;
  font-size: 14px;
}

input:focus,
select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}

.font-size {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  gap: 6px;
}

.font-size input {
  text-align: center;
  appearance: textfield;
  -moz-appearance: textfield;
}

.font-size input::-webkit-inner-spin-button,
.font-size input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.font-size .btn {
  padding: 0;
  min-height: 38px;
}

.rotation-buttons {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.tool-button {
  background: var(--code-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 4px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.tool-button:hover:not(:disabled) {
  color: var(--accent);
  border-color: var(--accent);
}

.tool-button.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
}

.tool-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.position-info {
  display: flex;
  justify-content: space-between;
  font-family: var(--mono);
  font-size: 12px;
  padding: 12px 0 0;
  border-top: 1px solid var(--border);
}

.apply-button {
  width: 100%;
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
  width: 48px;
  height: 48px;
  border: 1px dashed var(--border);
  border-radius: 10px;
  color: var(--accent);
  font-size: 24px;
}
</style>