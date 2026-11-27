<script setup lang="ts">
import type {
  EditorSection,
  ActiveEditorSection
} from '../types/printer'

const props = defineProps<{
  loading: boolean
  copies: number
  formId: string
}>()

const activeSection = defineModel<ActiveEditorSection>(
    'activeSection',
    { required: true }
)

const emit = defineEmits<{
  clear: []
}>()

const options: {
  label: string
  value: EditorSection
}[] = [
  { label: 'Text', value: 'text' },
  { label: 'Grid', value: 'grid' },
  { label: 'Copies', value: 'copies' }
]

const toggleSection = (section: EditorSection) => {
  activeSection.value =
      activeSection.value === section
          ? null
          : section
}
</script>

<template>
  <header class="page-header">

    <!-- Application branding -->

    <div class="brand">

      <div class="brand-icon" aria-hidden="true">

        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
          <path
              d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6zM17 12h1"
          />
        </svg>

      </div>

      <div>
        <h1>Label Designer</h1>
        <p>203 DPI · 811 × 598 dots</p>
      </div>

    </div>

    <!-- Navigation -->

    <nav
        class="header-nav"
        aria-label="Editor panels"
    >

      <button
          v-for="option in options"
          :key="option.value"
          type="button"
          class="nav-button"
          :class="{
          active: activeSection === option.value
        }"
          :aria-pressed="activeSection === option.value"
          :title="
          activeSection === option.value
            ? 'Return to Quick edit'
            : `Open ${option.label} settings`
        "
          @click="toggleSection(option.value)"
      >

        <!-- Text icon -->

        <svg
            v-if="option.value === 'text'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
        >
          <path d="M4 6h16M12 6v14M8 20h8M4 6v3M20 6v3" />
        </svg>

        <!-- Grid icon -->

        <svg
            v-else-if="option.value === 'grid'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>

        <!-- Copies icon -->

        <svg
            v-else
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linejoin="round"
        >
          <rect x="8" y="8" width="12" height="13" rx="2" />

          <path
              d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"
          />
        </svg>

        {{ option.label }}

      </button>

    </nav>

    <!-- Main actions -->

    <div class="header-actions">

      <button
          type="button"
          class="btn ghost"
          :disabled="props.loading"
          @click="emit('clear')"
      >
        Clear
      </button>

      <button
          type="submit"
          :form="props.formId"
          class="btn primary"
          :disabled="props.loading"
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
          <path
              d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z"
          />
        </svg>

        {{ props.loading ? 'Printing…' : 'Print label' }}

        <span
            v-if="!props.loading && props.copies > 1"
            class="copies-count"
        >
          ×{{ props.copies }}
        </span>

      </button>

    </div>

  </header>
</template>

<style scoped src="../assets/print-ui.css"></style>

<style scoped>
/* ---------- Header layout ---------- */

.page-header {
  display: grid;

  grid-template-columns:
    minmax(0, 1fr)
    auto
    minmax(0, 1fr);

  align-items: center;
  gap: 16px;

  padding: 12px 20px;

  border-bottom: 1px solid var(--component-border);
  background: var(--bg);
}

.brand,
.header-actions,
.header-nav {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ---------- Branding ---------- */

.brand {
  min-width: 0;
}

.brand-icon {
  display: grid;
  place-items: center;

  width: 38px;
  height: 38px;
  flex: 0 0 38px;

  border-radius: 8px;

  background: var(--accent-bg);
  color: var(--accent);
}

.brand-icon svg {
  width: 22px;
  height: 22px;
}

.brand h1 {
  font-size: 16px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.brand p {
  font: 11px var(--mono);
  color: var(--text);
  margin-top: 3px;
}

/* ---------- Navigation ---------- */

.header-nav {
  gap: 4px;

  background: var(--workspace);

  padding: 4px;

  border: 1px solid var(--border);
  border-radius: 8px;
}

.nav-button {
  display: flex;
  gap: 7px;

  align-items: center;
  justify-content: center;

  min-height: 34px;
  padding: 0 14px;

  border: 1px solid transparent;
  border-radius: 5px;

  background: transparent;
  color: var(--text);

  font-weight: 600;
  font-size: 13px;
}

.nav-button:hover {
  background: var(--control-bg);
  color: var(--text-h);
}

.nav-button.active {
  color: var(--accent-ink);
  background: var(--accent);
}

.nav-button svg,
.header-actions svg {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
}

/* ---------- Main actions ---------- */

.header-actions {
  justify-content: flex-end;
}

.copies-count {
  font-family: var(--mono);
  font-size: 12px;
}

/* ---------- Responsive ---------- */

@media (max-width: 960px) {
  .page-header {
    grid-template-columns: 1fr auto;
  }

  .header-nav {
    grid-row: 2;
    grid-column: 1 / -1;
    justify-self: center;
  }
}

@media (max-width: 520px) {
  .page-header {
    padding: 10px 12px;
    gap: 10px;
  }

  .brand p {
    display: none;
  }

  .brand-icon {
    width: 30px;
    height: 30px;
    flex-basis: 30px;
  }

  .brand h1 {
    font-size: 13px;
  }

  .header-actions {
    gap: 5px;
  }

  .header-actions .btn {
    padding: 0 8px;
    font-size: 12px;
  }

  .header-actions svg {
    display: none;
  }
}
</style>