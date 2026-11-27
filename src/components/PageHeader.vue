<script setup lang="ts">
import type { EditorSection } from '../types/printer'

defineProps<{
  eyebrow: string
  title: string
  subtitle: string
}>()

const activeSection = defineModel<EditorSection>('activeSection', {
  required: true
})

const options: { label: string; value: EditorSection }[] = [
  { label: 'Text', value: 'text' },
  { label: 'Grid', value: 'grid' },
  { label: 'Copies', value: 'copies' }
]
</script>

<template>
  <header class="page-header">

    <div class="header-info">
      <p class="eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p class="subtitle">{{ subtitle }}</p>
    </div>

    <nav class="header-nav" aria-label="Editor sections">
      <button
          v-for="option in options"
          :key="option.value"
          type="button"
          class="nav-button"
          :class="{ active: activeSection === option.value }"
          :aria-pressed="activeSection === option.value"
          @click="activeSection = option.value"
      >
        {{ option.label }}
      </button>
    </nav>

  </header>
</template>

<style scoped>
.page-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 24px;
  margin-bottom: 28px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.header-info {
  text-align: left;
  min-width: 0;
}

.eyebrow {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}

.header-info h1 {
  font-size: 34px;
  letter-spacing: -0.8px;
  margin: 4px 0 6px;
}

.subtitle {
  font-size: 14px;
  max-width: 52ch;
}

.header-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.nav-button {
  padding: 10px 22px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--code-bg);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-button:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.nav-button.active {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
}

.nav-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

@media (max-width: 900px) {
  .page-header {
    grid-template-columns: 1fr;
  }

  .header-nav {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .header-info h1 {
    font-size: 28px;
  }

  .nav-button {
    flex: 1;
    padding: 10px 12px;
  }
}
</style>