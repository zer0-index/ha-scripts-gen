<script setup>
import {ref, computed, defineProps, defineEmits, watch, onMounted} from 'vue';
import {
  ART_COMM_SCORE_MAX,
  INTERESTED_AUDIENCE_FALLBACK_COUNT,
  ADVERTISER_MATCH_FALLBACK_COUNT
} from '../services/calculator.js'; // Import constants

const props = defineProps({
  allTags: {type: Object, required: true, default: () => ({})},
  calculationResults: {type: Object, default: null},
  isLoading: {type: Boolean, default: false}
});

const emit = defineEmits(['calculate']);

const initialSelectionState = () => ({
  GENRES: [], SETTING: [], PROTAGONIST: [], ANTAGONIST: [],
  FINALE: [], SUPPORTINGCHARACTER: [], THEME_and_EVENTS: []
});
const selectedCalculatorTags = ref(initialSelectionState());
const localErrorMessages = ref([]);

const hasMinimumSelections = computed(() => {
  const genreCount = selectedCalculatorTags.value['GENRES']?.length ?? 0;
  const settingSelected = selectedCalculatorTags.value['SETTING']?.length === 1;
  const protagonistSelected = selectedCalculatorTags.value['PROTAGONIST']?.length === 1;
  return genreCount >= 1 && genreCount <= 3 && settingSelected && protagonistSelected;
});

const canCalculate = computed(() => hasMinimumSelections.value && !props.isLoading);
const hasAnySelection = computed(() => Object.values(selectedCalculatorTags.value).some(arr => arr.length > 0));

const allErrors = computed(() => {
  const errors = [...localErrorMessages.value];
  if (props.calculationResults?.validation && !props.calculationResults.validation.isValid) {
    props.calculationResults.validation.errorMessages.forEach(msg => {
      if (!errors.includes(msg)) errors.push(msg);
    });
  }
  return errors;
});

const sortedCategories = computed(() => {
  if (!props.allTags) return [];
  const preferredOrder = ['GENRES', 'SETTING', 'PROTAGONIST', 'ANTAGONIST', 'SUPPORTINGCHARACTER', 'THEME_and_EVENTS', 'FINALE'];
  return Object.keys(props.allTags)
      .filter(cat => preferredOrder.includes(cat))
      .sort((a, b) => preferredOrder.indexOf(a) - preferredOrder.indexOf(b));
});

function formatTagForDisplay(category, tag) {
  if (!tag) return '';
  let prefix = '';
  if (category === 'THEME_and_EVENTS') {
    if (tag.startsWith('THEME_')) prefix = 'THEME_';
    else if (tag.startsWith('EVENT_')) prefix = 'EVENT_';
    else if (tag.startsWith('EVENTS_')) prefix = 'EVENTS_';
    else return tag;
  } else {
    const expectedPrefix = category + '_';
    if (tag.startsWith(expectedPrefix)) prefix = expectedPrefix;
    else return tag;
  }
  let formatted = tag.substring(prefix.length);
  return formatted.replace(/_/g, ' ');
}

function handleTagSelection(category, tag) {
  const currentSelection = selectedCalculatorTags.value[category];
  const tagIndex = currentSelection.indexOf(tag);
  switch (category) {
    case 'GENRES':
      if (tagIndex > -1) currentSelection.splice(tagIndex, 1);
      else if (currentSelection.length < 3) currentSelection.push(tag);
      selectedCalculatorTags.value[category] = [...currentSelection];
      break;
    case 'SETTING':
    case 'PROTAGONIST':
      if (!(tagIndex > -1 && currentSelection.length === 1 && currentSelection[0] === tag)) selectedCalculatorTags.value[category] = [tag];
      break;
    case 'ANTAGONIST':
    case 'FINALE':
      selectedCalculatorTags.value[category] = (tagIndex > -1) ? [] : [tag];
      break;
    case 'SUPPORTINGCHARACTER':
    case 'THEME_and_EVENTS':
      if (tagIndex > -1) currentSelection.splice(tagIndex, 1); else currentSelection.push(tag);
      selectedCalculatorTags.value[category] = [...currentSelection];
      break;
  }
  validateLocally();
}

function validateLocally() {
  localErrorMessages.value = [];
  const genreCount = selectedCalculatorTags.value['GENRES']?.length ?? 0;
  if (genreCount < 1) localErrorMessages.value.push("At least one Genre must be selected.");
  if (genreCount > 3) localErrorMessages.value.push("No more than three Genres can be selected.");
  if (selectedCalculatorTags.value['SETTING']?.length !== 1) localErrorMessages.value.push("Setting selection is required.");
  if (selectedCalculatorTags.value['PROTAGONIST']?.length !== 1) localErrorMessages.value.push("Protagonist selection is required.");
}

function triggerCalculation() {
  validateLocally();
  if (hasMinimumSelections.value) emit('calculate', JSON.parse(JSON.stringify(selectedCalculatorTags.value)));
}

function clearSelection() {
  selectedCalculatorTags.value = initialSelectionState();
  validateLocally();
}

onMounted(validateLocally);

function isSelected(category, tag) {
  return selectedCalculatorTags.value[category]?.includes(tag) ?? false;
}

const formatList = (list) => (list && list.length > 0 ? list.join(', ') : 'N/A');
const formatAdvertisers = (list) => list?.length > 0 ? list.map(ad => `${ad.name} (Score: ${ad.score})`).join('; ') : 'N/A';

</script>

<template>
  <div class="calculator-panel">
    <h2>Concept Calculator</h2>
    <div class="calculator-content">
      <div class="calculator-selection">
        <h3>Select Tags for Calculation</h3>
        <p class="instructions">Select 1-3 Genres. Select exactly one Setting and Protagonist. Others optional (max 1
          Antagonist/Finale).</p>
        <div v-if="!allTags || Object.keys(allTags).length === 0" class="loading-tags">Loading tags...</div>
        <div v-else class="categories-container-calc">
          <details v-for="category in sortedCategories" :key="category" class="category-group-calc" open>
            <summary>
              {{ category.replace(/_/g, ' ') }}
              <span v-if="category === 'GENRES'" class="required-indicator">* (1-3)</span>
              <span v-else-if="category === 'SETTING' || category === 'PROTAGONIST'"
                    class="required-indicator">* (1)</span>
              ({{ selectedCalculatorTags[category]?.length ?? 0 }} selected)
              <span v-if="category === 'GENRES' && selectedCalculatorTags[category]?.length === 3"
                    class="max-indicator"> (MAX)</span>
            </summary>
            <div class="tags-wrapper-calc">
              <template v-if="category === 'GENRES'">
                <button v-for="tag in allTags[category]" :key="tag" type="button"
                        :class="{ 'tag-button-calc': true, 'selected': isSelected(category, tag) }"
                        @click="handleTagSelection(category, tag)" :title="tag"
                        :disabled="!isSelected(category, tag) && selectedCalculatorTags[category]?.length >= 3">
                  {{ formatTagForDisplay(category, tag) }}
                </button>
              </template>
              <template v-else-if="['SETTING', 'PROTAGONIST', 'ANTAGONIST', 'FINALE'].includes(category)">
                <button v-for="tag in allTags[category]" :key="tag" type="button"
                        :class="{ 'tag-button-calc': true, 'selected': isSelected(category, tag) }"
                        @click="handleTagSelection(category, tag)" :title="tag">{{ formatTagForDisplay(category, tag) }}
                </button>
              </template>
              <template v-else-if="['SUPPORTINGCHARACTER', 'THEME_and_EVENTS'].includes(category)">
                <button v-for="tag in allTags[category]" :key="tag" type="button"
                        :class="{ 'tag-button-calc': true, 'selected': isSelected(category, tag) }"
                        @click="handleTagSelection(category, tag)" :title="tag">{{ formatTagForDisplay(category, tag) }}
                </button>
              </template>
            </div>
          </details>
        </div>
        <div v-if="allErrors.length > 0" class="calc-error-messages">
          <strong>Please address the following:</strong>
          <ul>
            <li v-for="(error, index) in allErrors" :key="`err-${index}`">{{ error }}</li>
          </ul>
        </div>
        <div class="action-buttons-container">
          <button class="button-secondary" @click="clearSelection" :disabled="!hasAnySelection" type="button">Clear
            Selection
          </button>
          <button class="button-primary" @click="triggerCalculation" :disabled="!hasMinimumSelections || isLoading"
                  type="button">{{ isLoading ? 'Calculating...' : 'Calculate Scores' }}
          </button>
        </div>
      </div>
      <div class="calculator-results">
        <h3>Calculation Results</h3>
        <div v-if="!calculationResults" class="results-placeholder">Select required tags and click "Calculate Scores".
        </div>
        <div v-else-if="calculationResults.results?.error" class="calc-error-messages results-error"><strong>Calculation
          Error:</strong> {{ calculationResults.results.error }}
        </div>
        <div v-else-if="calculationResults.validation?.isValid && calculationResults.results" class="results-content">
          <dl>
            <!--            <dt>Artistic Score:</dt>-->
            <!--            <dd>{{ calculationResults.results.artisticScore?.toFixed(1) ?? 'N/A' }} / {{-->
            <!--                ART_COMM_SCORE_MAX.toFixed(1)-->
            <!--              }}-->
            <!--            </dd>-->
            <!--            <dt>Commercial Score:</dt>-->
            <!--            <dd>{{ calculationResults.results.commercialScore?.toFixed(1) ?? 'N/A' }} / {{-->
            <!--                ART_COMM_SCORE_MAX.toFixed(1)-->
            <!--              }}-->
            <!--            </dd>-->
            <dt>Interested Audiences:</dt>
            <dd>{{ formatList(calculationResults.results.interestedAudiences) }} <em
                v-if="calculationResults.results.usedAudienceFallback && calculationResults.results.interestedAudiences?.length > 0">(Fallback:
              Top {{ INTERESTED_AUDIENCE_FALLBACK_COUNT }})</em><em
                v-if="calculationResults.results.usedAudienceFallback && calculationResults.results.interestedAudiences?.length === 0">(Fallback
              used, none found)</em><em
                v-if="!calculationResults.results.usedAudienceFallback && calculationResults.results.interestedAudiences?.length === 0">(None
              met threshold)</em></dd>
            <dt>Top Advertisers:</dt>
            <dd>{{ formatAdvertisers(calculationResults.results.topAdvertisers) }} <em
                v-if="calculationResults.results.usedAdvertiserFallback && calculationResults.results.topAdvertisers?.length > 0">(Fallback:
              Top {{ ADVERTISER_MATCH_FALLBACK_COUNT }})</em><em
                v-if="calculationResults.results.usedAdvertiserFallback && calculationResults.results.topAdvertisers?.length === 0">(Fallback
              used, none found)</em><em
                v-if="!calculationResults.results.usedAdvertiserFallback && calculationResults.results.topAdvertisers?.length === 0">(None
              met threshold)</em></dd>
          </dl>
        </div>
        <div v-else class="results-placeholder">
          <div v-if="calculationResults.validation && !calculationResults.validation.isValid"
               class="calc-error-messages results-error"><strong>Validation Failed:</strong>
            <ul>
              <li v-for="(error, index) in calculationResults.validation.errorMessages" :key="`res-err-${index}`">
                {{ error }}
              </li>
            </ul>
          </div>
          <span v-else>Waiting for calculation results...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calculator-panel {
  border: 1px solid #444;
  border-radius: 8px;
  background-color: #3a3f4c;
  padding: 20px 25px;
  width: 100%;
  max-width: 1800px;
  box-sizing: border-box;
  margin-top: 30px
}

h2 {
  text-align: center;
  color: #fff;
  margin-top: 0;
  margin-bottom: 20px;
  font-weight: 300;
  border-bottom: 1px solid #555;
  padding-bottom: 10px
}

.calculator-content {
  display: grid;
  grid-template-columns:1fr;
  gap: 30px
}

@media (min-width: 992px) {
  .calculator-content {
    grid-template-columns:repeat(auto-fit, minmax(400px, 1fr));
    align-items: start
  }

  .calculator-selection {
    /* max-width: 600px; */
    justify-self: stretch;
  }

  .calculator-results {
    /* max-width: 600px; */
    justify-self: stretch;
  }
}

.calculator-selection, .calculator-results {
  background-color: #343a40;
  padding: 20px;
  border-radius: 6px;
  border: 1px solid #4a5058;
  display: flex;
  flex-direction: column
}

h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #e0e0e0;
  border-bottom: 1px solid #555;
  padding-bottom: 8px;
  font-weight: 400
}

.instructions {
  font-size: .9em;
  color: #ccc;
  margin-bottom: 15px;
  font-style: italic
}

.loading-tags {
  color: #ccc;
  font-style: italic;
  padding: 10px 0
}

.categories-container-calc {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 450px;
  overflow-y: auto;
  padding-right: 5px;
  margin-bottom: 20px;
  scrollbar-width: thin;
  scrollbar-color: #6c757d #3e444c
}

.categories-container-calc::-webkit-scrollbar {
  width: 6px
}

.categories-container-calc::-webkit-scrollbar-track {
  background: #3e444c;
  border-radius: 3px
}

.categories-container-calc::-webkit-scrollbar-thumb {
  background-color: #6c757d;
  border-radius: 3px
}

.category-group-calc {
  border: 1px solid #4a5058;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, .03)
}

.category-group-calc[open] summary {
  border-bottom: 1px solid #4a5058
}

.category-group-calc summary {
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 700;
  color: #e0e0e0;
  list-style: none;
  display: flex;
  align-items: center;
  user-select: none;
  gap: 4px
}

.category-group-calc summary::before {
  content: '▶';
  display: inline-block;
  margin-right: 8px;
  font-size: .8em;
  transition: transform .2s ease-in-out;
  flex-shrink: 0
}

.category-group-calc[open] summary::before {
  transform: rotate(90deg)
}

.category-group-calc summary::-webkit-details-marker {
  display: none
}

.required-indicator, .max-indicator {
  color: #ffc107;
  font-weight: 400;
  font-size: .9em;
  margin-left: 2px
}

.max-indicator {
  color: #fd7e14
}

.tags-wrapper-calc {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 12px
}

.tag-button-calc {
  padding: 4px 10px;
  border: 1px solid #6c757d;
  border-radius: 12px;
  background-color: #495057;
  color: #e0e0e0;
  cursor: pointer;
  font-size: .85em;
  transition: background-color .2s ease, border-color .2s ease, color .2s ease, opacity .2s ease;
  user-select: none
}

.tag-button-calc:hover:not(:disabled) {
  background-color: #5a6268;
  border-color: #8a9197
}

.tag-button-calc.selected {
  background-color: #007bff;
  border-color: #0056b3;
  color: #fff;
  font-weight: 700
}

.tag-button-calc.selected:hover {
  background-color: #0056b3;
  border-color: #004085
}

.tag-button-calc:disabled {
  opacity: .5;
  cursor: not-allowed;
  background-color: #495057;
  border-color: #6c757d
}

.calc-error-messages {
  color: #f8d7da;
  background-color: rgba(114, 28, 36, .5);
  border: 1px solid #f5c6cb;
  padding: 10px 15px;
  border-radius: 4px;
  margin-top: 15px;
  font-size: .9em
}

.calc-error-messages ul {
  margin: 5px 0 0 20px;
  padding-left: 0
}

.calc-error-messages.results-error {
  background-color: rgba(114, 28, 36, .7);
  margin-top: 0;
  margin-bottom: 10px
}

.action-buttons-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 20px;
  gap: 15px
}

.action-buttons-container button {
  padding: 10px 18px;
  cursor: pointer;
  border: none;
  border-radius: 5px;
  font-size: 1em;
  font-weight: 700;
  transition: background-color .2s ease, opacity .2s ease;
  flex-grow: 1;
  max-width: 48%
}

.action-buttons-container .button-primary {
  background-color: #28a745;
  color: #fff
}

.action-buttons-container .button-primary:hover:not(:disabled) {
  background-color: #218838
}

.action-buttons-container .button-secondary {
  background-color: #6c757d;
  color: #fff
}

.action-buttons-container .button-secondary:hover:not(:disabled) {
  background-color: #5a6268
}

.action-buttons-container button:disabled {
  background-color: #5a5a5a;
  opacity: .6;
  cursor: not-allowed
}

.results-placeholder {
  color: #aaa;
  font-style: italic;
  text-align: center;
  padding: 30px 10px;
  border: 1px dashed #555;
  border-radius: 4px;
  margin-top: 10px;
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center
}

.results-content {
  flex-grow: 1
}

.results-content dl {
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns:auto 1fr;
  gap: 8px 12px;
  font-size: .95em
}

.results-content dt {
  font-weight: 600;
  color: #bdbdbd;
  grid-column: 1;
  white-space: nowrap;
  text-align: right
}

.results-content dd {
  margin: 0;
  grid-column: 2;
  color: #e0e0e0
}

.results-content dd em {
  font-size: .9em;
  color: #ffc107;
  margin-left: 8px
}
</style>