<!-- /src/components/IdeaCard.vue -->
<script setup>
import { defineProps, computed } from 'vue';

const props = defineProps({
  idea: {
    type: Object,
    required: true,
  },
});

// Computes formatted genre string with percentages
const formattedGenres = computed(() => {
  // Basic check for necessary data
  if (!props.idea.Genres || !props.idea.GenreWeights || props.idea.Genres.length !== props.idea.GenreWeights.length) {
    // Return 'N/A' or the genres list if weights are missing/invalid
    return props.idea.Genres?.join(', ') || 'N/A';
  }
  // Map genres to include their calculated percentage weight
  return props.idea.Genres.map((genre, index) => {
    const weight = props.idea.GenreWeights[index];
    // Ensure weight is a valid number before calculating percentage
    const percentage = (typeof weight === 'number' && !isNaN(weight))
        ? (weight * 100).toFixed(0) // Calculate and format percentage
        : '??'; // Placeholder if weight is invalid
    return `${genre} (${percentage}%)`; // Combine genre name and percentage
  }).join(', '); // Join all formatted genre strings with commas
});

// Helper function to format lists of tags, returning 'None' if empty
const formatTagList = (list) => (list && list.length > 0 ? list.join(', ') : 'None');

// Computed property to check if there are any warnings
const hasWarnings = computed(() => props.idea.Warnings && props.idea.Warnings.length > 0);

</script>

<template>
  <div class="idea-card">
    <!-- Card Header: Include the Score -->
    <h4>Idea (Inner SUM of Tags: {{ idea.TotalScore?.toFixed(1) ?? 'N/A' }})</h4>

    <!-- Definition List for structured display of idea details -->
    <dl class="idea-details">
      <dt>Genres:</dt>
      <dd>{{ formattedGenres }}</dd>

      <dt>Setting:</dt>
      <dd>{{ idea.Setting }}</dd>

      <dt>Protagonist:</dt>
      <dd>{{ idea.Protagonist }}</dd>

      <dt>Antagonist:</dt>
      <dd>{{ idea.Antagonist || 'None' }}</dd>

      <dt>Supporting:</dt>
      <dd>{{ formatTagList(idea.SupportingChars) || 'None' }}</dd>

      <dt>Finales:</dt>
      <dd>{{ formatTagList(idea.Finales) }}</dd>

      <dt>Themes/Events:</dt>
      <dd>{{ formatTagList(idea.ThemesEvents) }}</dd>
    </dl>

    <h5>[dev]: bigger Score, most likely, better</h5>

    <!-- Collapsible Warnings Section -->
    <details v-if="hasWarnings" class="warnings-details">
      <summary>Warnings ({{ idea.Warnings.length }})</summary>
      <ul>
        <!-- List each warning -->
        <li v-for="(warning, index) in idea.Warnings" :key="index">{{ warning }}</li>
      </ul>
    </details>

  </div>
</template>

<style scoped>
.idea-card {
  border: 1px solid #555;
  border-radius: 6px; /* Slightly larger radius */
  padding: 15px 20px; /* More horizontal padding */
  background-color: #383c4a; /* Match ResultsDisplay example */
  color: #e0e0e0; /* Lighter text color */
  display: flex; /* Enable flexbox for vertical layout */
  flex-direction: column; /* Stack elements vertically */
  gap: 10px; /* Space between elements */
  overflow-wrap: break-word; /* Prevent long tags from overflowing badly */
}

h4 {
  margin-top: 0;
  margin-bottom: 5px; /* Reduced margin */
  border-bottom: 1px solid #666;
  padding-bottom: 8px;
  color: #FFFFFF;
  font-weight: 500; /* Slightly bolder */
  font-size: 1.1em;
}

.idea-details {
  margin: 0; /* Reset default dl margin */
  padding: 0; /* Reset default dl padding */
  display: grid; /* Use grid for layout */
  grid-template-columns: auto 1fr; /* Term column auto-width, Description takes rest */
  gap: 6px 10px; /* Row gap, Column gap */
  font-size: 0.95em; /* Base font size for details */
}

.idea-details dt { /* Definition Term (Label) */
  font-weight: 600; /* Make labels bolder */
  color: #bdbdbd; /* Slightly lighter grey for labels */
  grid-column: 1; /* Explicitly place in first column */
  white-space: nowrap; /* Prevent labels from wrapping */
}

.idea-details dd { /* Definition Description (Value) */
  margin: 0; /* Reset default dd margin */
  grid-column: 2; /* Explicitly place in second column */
  color: #e0e0e0; /* Value text color */
}

/* Warnings Section Styling */
.warnings-details {
  margin-top: 10px; /* Space above warnings */
  background-color: rgba(255, 193, 7, 0.1); /* Light warning background */
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 4px;
  padding: 5px 0; /* Padding around summary/list */
}

.warnings-details summary {
  cursor: pointer;
  font-weight: bold;
  color: #ffc107; /* Warning color */
  padding: 5px 10px; /* Padding inside summary */
  outline: none; /* Remove default focus outline */
  user-select: none; /* Prevent text selection */
}
.warnings-details summary::marker{
  /* Style the disclosure triangle */
  color: #ffc107;
}

.warnings-details ul {
  list-style-type: disc;
  margin: 5px 0 10px 35px; /* Top/Bottom margin, adjusted left indent */
  padding-left: 0;
  font-size: 0.9em;
  color: #ffebbb; /* Lighter warning text */
}
.warnings-details li {
  margin-bottom: 4px; /* Space between warning items */
}

</style>
