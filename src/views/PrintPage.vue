<script setup lang="ts">
import { ref } from 'vue'

import PageHeader from '../components/PageHeader.vue'
import PrintForm from '../components/PrintForm.vue'
import LabelPreview from '../components/LabelPreview.vue'
import PrintHistory from '../components/PrintHistory.vue'
import { usePrintEditor } from '../composables/usePrintEditor'
import type { ActiveEditorSection } from '../types/printer'

const editor = usePrintEditor()

const { history, loading, reuse } = editor

const activeSection = ref<ActiveEditorSection>(null)
</script>

<template>
  <section class="page">

    <PageHeader
        v-model:active-section="activeSection"
        eyebrow="Printer"
        title="New print job"
        subtitle="Add one or more texts, then drag each one on the label to place it."
    />

    <div class="layout">

      <PrintForm
          :editor="editor"
          v-model:active-section="activeSection"
      />

      <LabelPreview :editor="editor" />

      <PrintHistory
          :history="history"
          :loading="loading"
          @reuse="reuse"
      />

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

.layout {
  display: grid;
  grid-template-columns:
      minmax(0, 1fr)
      minmax(0, 1.5fr)
      minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.layout > * {
  min-width: 0;
}

@media (prefers-color-scheme: dark) {
  .page {
    --success: #4ade80;
    --success-bg: rgba(74, 222, 128, 0.12);
    --danger: #f87171;
    --danger-bg: rgba(248, 113, 113, 0.12);
  }
}

@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr 1.5fr;
  }

  .layout > :last-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 768px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>