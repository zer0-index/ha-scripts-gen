<script setup>
import {defineProps, defineEmits, computed} from 'vue';

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
    // Ensure the modelValue has the expected keys for type safety/clarity
    validator: (value) => {
      return [
        'min_score',
        'num_genres_target',
        'num_themes_target',
        'num_finales_target',
        'num_support_target',
        'add_antagonist'
      ].every(key => key in value);
    }
  },
});

const emit = defineEmits(['update:modelValue']);

/**
 * Handles updates from range sliders and the checkbox.
 * Emits an 'update:modelValue' event with the modified parameters object.
 * @param {string} key - The parameter key (e.g., 'min_score').
 * @param {Event} event - The input or change event.
 */
function updateParam(key, event) {
  const target = event.target;
  let value;

  if (target.type === 'checkbox') {
    value = target.checked;
  } else { // Assumed range input
    const rawValue = target.value;
    // Use parseFloat only for min_score, parseInt for all target counts
    value = key === 'min_score' ? parseFloat(rawValue) : parseInt(rawValue, 10);
  }

  // Create a new object for the emit to ensure reactivity
  const updatedParams = {...props.modelValue, [key]: value};
  emit('update:modelValue', updatedParams);
}

// Computed property for the Min Score label, adding "(max)" marker
const minScoreLabel = computed(() => {
  const score = props.modelValue.min_score;
  // Use toFixed(1) for consistent display (e.g., 4.0)
  return score === 5.0 ? `${score.toFixed(1)} (max)` : `${score.toFixed(1)}`;
});

// Computed property for displaying the potential *maximum* number of plot-related tags
// based on the current target settings. This is purely informational.
const potentialPlotTagsTotal = computed(() => {
  const params = props.modelValue;
  const protagonistCount = 1; // Always 1 Protagonist
  const antagonistCount = params.add_antagonist ? 1 : 0; // 0 or 1 Antagonist based on toggle

  // Sum the mandatory protagonist, target themes, target finales,
  // potential antagonist, and target support characters.
  return protagonistCount +
      params.num_themes_target +  // 1-3
      params.num_finales_target +   // 1-2
      antagonistCount +           // 0-1
      params.num_support_target;  // 0-2
});

</script>

<template>
  <div class="parameter-sliders">
    <h3>Generation Parameters</h3>

    <!-- Min Compatibility Score -->
    <div class="slider-group">
      <label for="min_score">Min Compatibility Score (2.0-5.0): {{ minScoreLabel }}</label>
      <!-- Note: Using step="0.1" allows finer control, but the generator logic uses fallbackScore = min_score - 1.0, -->
      <!-- making integer steps (2.0, 3.0, 4.0, 5.0) more impactful. Keeping step="1.0" for simplicity based on original code. -->
      <input type="range" id="min_score" min="2.0" max="5.0" step="1.0" :value="props.modelValue.min_score"
             @input="updateParam('min_score', $event)"/>
      <div class="slider-ticks"><span>2.0</span><span>3.0</span><span>4.0</span><span>5.0 (max)</span></div>
    </div>

    <!-- Target Number of Genres -->
    <div class="slider-group">
      <!-- Label directly reflects the value -->
      <label for="num_genres_target">Target Number of Genres (1-3): {{ props.modelValue.num_genres_target }}</label>
      <input type="range" id="num_genres_target" min="1" max="3" step="1" :value="props.modelValue.num_genres_target"
             @input="updateParam('num_genres_target', $event)"/>
      <div class="slider-ticks"><span>1</span><span>2</span><span>3</span></div>
    </div>

    <!-- Target Themes/Events -->
    <div class="slider-group">
      <label for="num_themes_target">Target Themes/Events (1-3): {{ props.modelValue.num_themes_target }}</label>
      <input type="range" id="num_themes_target" min="1" max="3" step="1" :value="props.modelValue.num_themes_target"
             @input="updateParam('num_themes_target', $event)"/>
      <div class="slider-ticks"><span>1</span><span>2</span><span>3</span></div>
    </div>

    <!-- Target Finales -->
    <div class="slider-group">
      <label for="num_finales_target">Target Finales (1-2): {{ props.modelValue.num_finales_target }}</label>
      <input type="range" id="num_finales_target" min="1" max="2" step="1" :value="props.modelValue.num_finales_target"
             @input="updateParam('num_finales_target', $event)"/>
      <div class="slider-ticks"><span>1</span><span>2</span></div>
    </div>

    <!-- Target Supporting Characters -->
    <div class="slider-group">
      <label for="num_support_target">Target Supporting Chars (0-2): {{ props.modelValue.num_support_target }}</label>
      <input type="range" id="num_support_target" min="0" max="2" step="1" :value="props.modelValue.num_support_target"
             @input="updateParam('num_support_target', $event)"/>
      <div class="slider-ticks"><span>0</span><span>1</span><span>2</span></div>
    </div>

    <!-- Add Antagonist Toggle -->
    <div class="checkbox-group">
      <input type="checkbox" id="add_antagonist" :checked="props.modelValue.add_antagonist"
             @change="updateParam('add_antagonist', $event)"/>
      <label for="add_antagonist">Attempt to Add Antagonist</label>
    </div>

    <!-- Informational Display -->
    <div class="info-display">
      <span>Potential Max Plot Tags: <strong>{{ potentialPlotTagsTotal }}</strong></span>
      <!-- Clarified label to indicate this is a sum of targets/flags -->
    </div>

  </div>
</template>

<style scoped>
/* Styles remain unchanged */
.parameter-sliders {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.slider-group {
  display: flex;
  flex-direction: column;
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 5px;
}

.checkbox-group input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #007bff;
}

/* Modern way to style checkbox color */
.checkbox-group label {
  margin-bottom: 0;
  font-size: 0.9em;
  color: #ccc;
  cursor: pointer;
  user-select: none; /* Prevent text selection on label click */
}

label {
  margin-bottom: 8px;
  font-size: 0.9em;
  color: #ccc;
}

input[type="range"] {
  width: 100%;
  cursor: pointer;
  accent-color: #007bff;
}

/* Modern way to style slider color */
.slider-ticks {
  display: flex;
  justify-content: space-between;
  margin-top: 5px;
  font-size: 0.75em;
  color: #aaa;
  padding: 0 5px;
}

.slider-ticks span {
  text-align: center;
  flex-basis: auto;
  min-width: 20px;
}

h3 {
  margin-bottom: 10px;
  color: #FFFFFF;
  border-bottom: 1px solid #555;
  padding-bottom: 5px;
  font-weight: 300;
}

/* Style for informational display */
.info-display {
  margin-top: 10px;
  padding: 8px 10px;
  background-color: rgba(255, 255, 255, 0.05); /* Subtle background */
  border-radius: 4px;
  font-size: 0.9em;
  color: #ccc;
}

.info-display strong {
  color: #FFFFFF; /* White for emphasis */
  font-weight: 600;
}
</style>
