<script setup>
import { defineProps, defineEmits } from 'vue';
import { computed } from 'vue';

const props = defineProps({
  allTags: {
    type: Object,
    required: true,
    default: () => ({})
  },
  modelValue: {
    type: Object,
    required: true,
    default: () => ({})
  }
});

const emit = defineEmits(['update:modelValue']);

/**
 * Formats a tag string for display by removing the category-based prefix.
 * @param {string} category - The category key (e.g., 'PROTAGONIST').
 * @param {string} tag - The full tag value (e.g., 'PROTAGONIST_ACCIDENTAL_HERO').
 * @returns {string} The formatted tag string (e.g., 'ACCIDENTAL HERO').
 */
function formatTagForDisplay(category, tag) {
  if (!tag) return '';

  let prefix = '';
  if (category === 'THEME_and_EVENTS') {
    if (tag.startsWith('THEME_')) {
      prefix = 'THEME_';
    } else if (tag.startsWith('EVENTS_')) {
      prefix = 'EVENTS_';
    }
    if (!prefix) return tag;
  } else {
    // For other categories, assume prefix matches category name + underscore
    const expectedPrefix = category + '_';
    if (tag.startsWith(expectedPrefix)) {
      prefix = expectedPrefix;
    } else {
      return tag;
    }
  }

  // Remove the prefix
  let formatted = tag.substring(prefix.length);
  formatted = formatted.replace(/_/g, ' ');
  return formatted;
}


function isTagSelected(category, tag) {
  return props.modelValue[category]?.includes(tag) ?? false;
}

function toggleTag(category, tag) {
  const newSelectedTags = JSON.parse(JSON.stringify(props.modelValue));
  if (!newSelectedTags[category]) {
    newSelectedTags[category] = [];
  }
  const categoryArray = newSelectedTags[category];
  const tagIndex = categoryArray.indexOf(tag);
  if (tagIndex > -1) {
    categoryArray.splice(tagIndex, 1);
  } else {
    categoryArray.push(tag);
  }
  emit('update:modelValue', newSelectedTags);
}

const sortedCategories = computed(() => {
  if (!props.allTags) return [];
  const preferredOrder = ['GENRES', 'SETTING', 'PROTAGONIST', 'ANTAGONIST', 'SUPPORTINGCHARACTER', 'THEME_and_EVENTS', 'FINALE'];
  return Object.keys(props.allTags).sort((a, b) => {
    const indexA = preferredOrder.indexOf(a);
    const indexB = preferredOrder.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });
});

</script>

<template>
  <div class="active-tags-selector">
    <h3>Active Tags Selection</h3>
    <div v-if="!allTags || Object.keys(allTags).length === 0" class="loading-tags">
      Loading available tags...
    </div>
    <div v-else class="categories-container">
      <details v-for="category in sortedCategories" :key="category" class="category-group">
        <summary>
          {{ category.replace(/_/g, ' ') }} ({{ modelValue[category]?.length ?? 0 }} selected)
        </summary>
        <div class="tags-wrapper">
          <button
              v-for="tag in allTags[category]"
              :key="tag"
              :class="{ 'tag-button': true, 'selected': isTagSelected(category, tag) }"
              @click="toggleTag(category, tag)"
              type="button"
              :title="tag" >
            {{ formatTagForDisplay(category, tag) }}
          </button>
        </div>
      </details>
    </div>
  </div>
</template>

<style scoped>
.active-tags-selector {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 15px;
}

h3 {
  margin-bottom: 10px;
  color: #FFFFFF;
  border-bottom: 1px solid #555;
  padding-bottom: 5px;
  font-weight: 300;
}

.loading-tags {
  color: #ccc;
  font-style: italic;
  padding: 10px 0;
}

.categories-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 5px;

  scrollbar-width: thin;
  scrollbar-color: #6c757d #3e444c;
}
/* Webkit scrollbar styling */
.categories-container::-webkit-scrollbar {
  width: 6px;
}
.categories-container::-webkit-scrollbar-track {
  background: #3e444c;
  border-radius: 3px;
}
.categories-container::-webkit-scrollbar-thumb {
  background-color: #6c757d;
  border-radius: 3px;
}


.category-group {
  border: 1px solid #4a5058;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.03);
}

.category-group[open] summary {
  border-bottom: 1px solid #4a5058;
}

.category-group summary {
  padding: 8px 12px;
  cursor: pointer;
  font-weight: bold;
  color: #e0e0e0;
  list-style: none;
  display: flex;
  align-items: center;
  user-select: none;
}

.category-group summary::before {
  content: '▶';
  display: inline-block;
  margin-right: 8px;
  font-size: 0.8em;
  transition: transform 0.2s ease-in-out;
}
.category-group[open] summary::before {
  transform: rotate(90deg);
}

.category-group summary::-webkit-details-marker {
  display: none;
}


.tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 12px;
}

.tag-button {
  padding: 4px 10px;
  border: 1px solid #6c757d;
  border-radius: 12px;
  background-color: #495057;
  color: #e0e0e0;
  cursor: pointer;
  font-size: 0.85em;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  user-select: none;
  font-family: inherit;
}

.tag-button:hover {
  background-color: #5a6268;
  border-color: #8a9197;
}

.tag-button.selected {
  background-color: #0056b3;
  border-color: #007bff;
  color: #ffffff;
}

.tag-button.selected:hover {
  background-color: #004085;
  border-color: #0056b3;
}

</style>
