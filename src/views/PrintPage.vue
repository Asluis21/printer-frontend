<script setup lang="ts">
import { computed, ref } from 'vue'

import PageHeader from '../components/PageHeader.vue'
import PrintForm from '../components/PrintForm.vue'
import LabelPreview from '../components/LabelPreview.vue'
import PrintHistory from '../components/PrintHistory.vue'
import TextFormatting from '../components/TextFormatting.vue'
import { usePrintEditor } from '../composables/usePrintEditor'

import type {
  ActiveEditorSection
} from '../types/printer'

/* ---------- Shared editor state ---------- */

const editor = usePrintEditor()

const {
  history,
  loading,
  reuse,
  reset,
  items,
  copies,
  selectedIds,
  selected
} = editor

/* ---------- Navigation ---------- */

const activeSection = ref<ActiveEditorSection>(null)

const formId = 'print-form'

const panelName = computed(() =>
    activeSection.value === null
        ? 'Quick edit'
        : ({
          text: 'Text settings',
          grid: 'Grid settings',
          copies: 'Copies settings'
        }[activeSection.value])
)
</script>

<template>
  <section class="studio">

    <!-- Application header -->

    <PageHeader
        v-model:active-section="activeSection"
        :loading="loading"
        :copies="copies"
        :form-id="formId"
        @clear="reset"
    />

    <!-- Main workspace -->

    <main class="workspace">

      <!-- Left configuration panel -->

      <aside
          class="configuration-panel"
          :aria-label="panelName"
      >

        <PrintForm
            :id="formId"
            :editor="editor"
            v-model:active-section="activeSection"
        />

        <TextFormatting
            v-if="activeSection === null"
            :editor="editor"
        />

      </aside>

      <!-- Center preview panel -->

      <section
          class="preview-panel"
          aria-label="Label design workspace"
      >

        <LabelPreview
            :editor="editor"
        />

      </section>

      <!-- Right history panel -->

      <aside
          class="history-panel"
          aria-label="Print history"
      >

        <PrintHistory
            :history="history"
            :loading="loading"
            @reuse="reuse"
        />

      </aside>

    </main>

    <!-- Bottom status bar -->

    <footer class="status-bar">

      <div class="status-group">

        <span>
          {{ items.length }}
          {{ items.length === 1 ? 'text' : 'texts' }}
        </span>

        <span class="selected-count">
          {{ selectedIds.length }} selected
        </span>

        <span
            v-if="selected && selectedIds.length === 1"
        >
          X: {{ selected.x }} · Y: {{ selected.y }}
        </span>

      </div>

      <span>
        {{ panelName }}
      </span>

      <span>
        {{ copies }}
        {{ copies === 1 ? 'copy' : 'copies' }}
      </span>

    </footer>

  </section>
</template>

<style scoped>
/* ---------- Application layout ---------- */

.studio {
  display: grid;

  grid-template-rows:
    auto
    minmax(0, 1fr)
    auto;

  height: 100dvh;
  min-width: 0;

  text-align: left;
}

/* ---------- Workspace ---------- */

.workspace {
  display: grid;

  grid-template-columns:
    minmax(260px, 1.1fr)
    minmax(0, 2.8fr)
    minmax(220px, 0.9fr);

  gap: 12px;

  min-height: 0;

  padding: 12px;
}

/* ---------- Independent panels ---------- */

.configuration-panel,
.preview-panel,
.history-panel {
  min-width: 0;
  min-height: 0;

  overflow: auto;

  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

/* ---------- Status bar ---------- */

.status-bar {
  display: flex;

  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;

  gap: 8px 18px;

  padding: 8px 16px;

  background: var(--bg);

  border-top: 1px solid var(--border);

  color: var(--text);

  font: 11px var(--mono);
}

.status-group {
  display: flex;

  align-items: center;
  flex-wrap: wrap;

  gap: 8px 16px;
}

.selected-count {
  color: var(--accent);
}

/* ---------- Tablet layout ---------- */

@media (max-width: 1100px) {
  .studio {
    height: auto;
    min-height: 100dvh;

    grid-template-rows:
      auto
      1fr
      auto;
  }

  .workspace {
    grid-template-columns:
      minmax(250px, 1fr)
      minmax(0, 2fr);

    align-items: start;
  }

  .history-panel {
    grid-column: 1 / -1;
  }
}

/* ---------- Mobile layout ---------- */

@media (max-width: 720px) {
  .workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .history-panel {
    grid-column: auto;
  }

  .preview-panel {
    grid-row: 1;
  }
}

.configuration-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.configuration-panel > * {
  flex-shrink: 0;
}
</style>