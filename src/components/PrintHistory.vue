<script setup lang="ts">
import type { HistoryEntry } from '../types/printer'

defineProps<{
  history: HistoryEntry[]
  loading: boolean
}>()

const emit = defineEmits<{
  reuse: [entry: HistoryEntry]
}>()
</script>

<template>
  <section class="card">
    <h2 class="section-title">Recent jobs</h2>
    <p v-if="!history.length" class="empty">Jobs you send will show up here.</p>
    <ul v-else class="history">
      <li v-for="entry in history" :key="entry.id">
        <span class="dot" :class="entry.ok ? 'ok' : 'fail'" :title="entry.ok ? 'Sent' : 'Failed'" />
        <div class="history-main">
          <span class="history-text">{{ entry.items.map((i) => i.text).join(' · ') }}</span>
          <span class="history-meta">
            {{ entry.time }} · {{ entry.items.length }}
            {{ entry.items.length === 1 ? 'text' : 'texts' }} · ×{{ entry.copies }}
          </span>
        </div>
        <button type="button" class="btn small ghost" :disabled="loading" @click="emit('reuse', entry)">
          Use again
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped src="../assets/print-ui.css"></style>

<style scoped>
/* ---------- History ---------- */
.empty {
  font-size: 14px;
  color: var(--text);
}

.history {
  list-style: none;
  margin: 0;
  padding: 0;
}

.history li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  animation: pop-in 0.2s ease-out;
}

.history li + li {
  border-top: 1px solid var(--border);
}

.dot {
  flex: 0 0 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.ok {
  background: var(--success);
}

.dot.fail {
  background: var(--danger);
}

.history-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.history-text {
  font-size: 15px;
  color: var(--text-h);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-meta {
  font-size: 12px;
  font-family: var(--mono);
}
</style>
