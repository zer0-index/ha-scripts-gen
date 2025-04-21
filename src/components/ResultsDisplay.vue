<!-- /src/components/ResultsDisplay.vue -->
<script setup>
import {defineProps} from 'vue';
import IdeaCard from './IdeaCard.vue'; // Assuming IdeaCard handles individual card display

const props = defineProps({
  ideas: {
    type: Array,
    required: true,
  },
  statusMessage: {
    type: String,
    default: ''
  },
  isErrorStatus: {
    type: Boolean,
    default: false
  }
});
</script>

<template>
  <div class="results-display">
    <!-- This heading is centered because .results-display is centered by its parent -->
    <h2>Generated Ideas</h2>

    <!-- Status Message -->
    <p v-if="statusMessage" class="status-message" :class="{ error: isErrorStatus }">
      {{ statusMessage }}
    </p>

    <!-- Grid container for idea cards -->
    <div v-if="ideas.length > 0" class="ideas-grid">
      <IdeaCard
          v-for="(idea, index) in ideas"
          :key="index"
          :idea="idea"
      />
    </div>

    <!-- Placeholder when no ideas and no status message -->
    <p v-else-if="ideas.length === 0 && !statusMessage" class="placeholder-text">
      Adjust parameters and click 'Generate Ideas' to start.
    </p>

  </div>
</template>

<style scoped>
.results-display {
  margin-top: 20px;
  min-height: 100px; /* Keep minimum height */
  width: 100%; /* Take full width provided by the centered parent */
  max-width: 900px; /* Optional: Match parent container's max-width */
  box-sizing: border-box; /* Include padding/border in width */
  /* No margin: auto needed here, centering is handled by #app-container's align-items: center */
}

h2 {
  color: #FFFFFF;
  text-align: center; /* Center the text within the block */
  margin-bottom: 15px;
  font-weight: 300;
}

.ideas-grid {
  display: grid;
  /* Default: 1 column taking full width */
  grid-template-columns: 1fr;
  gap: 25px;
  margin-top: 20px;
  width: 100%;
}

@media (min-width: 768px) {
  .ideas-grid {
    /* Switch to 2 equal-width columns */
    grid-template-columns: repeat(2, 1fr);
  }
}

.status-message {
  font-weight: bold;
  padding: 12px 15px;
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
  border: 1px solid transparent;
  color: #FFFFFF;
}

.status-message:not(.error) {
  background-color: #28a745;
  border-color: #28a745;
}

.status-message.error {
  background-color: #dc3545;
  border-color: #dc3545;
}

.placeholder-text {
  text-align: center;
  color: #aaa;
  font-style: italic;
  margin-top: 20px;
  padding: 20px;
}

</style>
