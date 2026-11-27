<script setup lang="ts">
import type { HistoryEntry } from '../types/printer'

defineProps<{
  history: HistoryEntry[]
  loading: boolean
}>()

const emit = defineEmits<{
  reuse: [entry: HistoryEntry]
}>()

const jobTitle = (entry: HistoryEntry) =>
    entry.items.find(item => item.text.trim())?.text
    || 'Untitled label'
</script>

<template>
  <section class="card history-card">

    <!-- Header -->

    <div class="history-header">

      <div class="history-heading">

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
          <path d="M3 3v5h5M12 7v5l3 2" />
        </svg>

        <h2 class="section-title">Print history</h2>

      </div>

      <span class="history-count">
        {{ history.length }}
      </span>

    </div>

    <!-- Empty state -->

    <div v-if="!history.length" class="empty-history">

      <div class="empty-icon">

        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M8 7h8M8 11h8M8 15h5" />
        </svg>

      </div>

      <strong>No print jobs yet</strong>

      <p class="hint">
        Your recent print jobs will appear here.
        Print a label to get started.
      </p>

    </div>

    <!-- History entries -->

    <ul v-else class="history-list">

      <li
          v-for="entry in history"
          :key="entry.id"
          class="history-entry"
      >

        <div class="entry-header">

          <span
              class="job-status"
              :class="entry.ok ? 'success' : 'failed'"
          >
            <span class="status-dot"></span>

            {{ entry.ok ? 'Success' : 'Failed' }}
          </span>

          <time>{{ entry.time }}</time>

        </div>

        <strong
            class="job-title"
            :title="jobTitle(entry)"
        >
          {{ jobTitle(entry) }}
        </strong>

        <p class="job-meta">

          <span>
            {{ entry.items.length }}
            {{ entry.items.length === 1 ? 'text' : 'texts' }}
          </span>

          <span class="meta-divider">·</span>

          <span>
            {{ entry.copies }}
            {{ entry.copies === 1 ? 'copy' : 'copies' }}
          </span>

        </p>

        <button
            type="button"
            class="btn small ghost reuse-button"
            :disabled="loading"
            title="Load this job into the editor"
            @click="emit('reuse', entry)"
        >

          <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 8" />
            <path d="M3 3v5h5" />
          </svg>

          Reuse job

        </button>

      </li>

    </ul>

    <p v-if="history.length" class="history-footer">
      Reuse a job to load its configuration into the editor.
    </p>

  </section>
</template>

<style scoped src="../assets/print-ui.css"></style>

<style scoped>
.history-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---------- Header ---------- */

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.history-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.history-heading svg {
  width: 18px;
  height: 18px;
  color: var(--accent);
  flex-shrink: 0;
}

.history-heading .section-title {
  margin: 0;
}

.history-count {
  display: grid;
  place-items: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--workspace);
  color: var(--text);
  font: 11px var(--mono);
}

/* ---------- Empty state ---------- */

.empty-history {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 32px 8px;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--workspace);
  color: var(--accent);
}

.empty-icon svg {
  width: 24px;
  height: 24px;
}

.empty-history strong {
  font-size: 13px;
  font-weight: 500;
}

/* ---------- History list ---------- */

.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-entry {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  background: var(--workspace);
  border: 1px solid var(--border);
  border-radius: 7px;
}

.history-entry:hover {
  border-color: var(--accent-border);
}

.entry-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.job-status {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 6px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 4px;
}

.job-status.success {
  background: var(--success-bg);
  color: var(--success);
}

.job-status.failed {
  background: var(--danger-bg);
  color: var(--danger);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.entry-header time {
  color: var(--text);
  font: 10px var(--mono);
}

.job-title {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-h);
  font-size: 13px;
  font-weight: 600;
}

.job-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  color: var(--text);
  font-size: 11px;
}

.meta-divider {
  opacity: 0.5;
}

.reuse-button {
  width: 100%;
  color: var(--accent);
}

.reuse-button svg {
  width: 14px;
  height: 14px;
}

.history-footer {
  padding-top: 12px;
  border-top: 1px solid var(--border);
  color: var(--text);
  font-size: 11px;
  line-height: 1.5;
}
</style>