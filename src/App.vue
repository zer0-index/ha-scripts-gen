<script setup>
import {ref, reactive, onMounted, computed} from 'vue';
import ActiveTagsSelector from './components/ActiveTagsSelector.vue';
import ParameterSliders from './components/ParameterSliders.vue';
import ResultsDisplay from './components/ResultsDisplay.vue';
import CalculatorPanel from './components/CalculatorPanel.vue';
import {generateMovieIdeaWithRetry} from './services/generator.js';
import {
  runCalculations,
  calculateAverageAudienceAppeal,
  calculateAdvertiserMatches
} from './services/calculator.js';

const compatibilityData = ref(null);
const allTagsData = ref(null);
const defaultActiveTags = ref(null);
const selectedTagsByCategory = ref(null);
const audienceGroupsData = ref(null);
const audienceWeightsData = ref(null);
const advertisersData = ref(null);
const isLoadingStaticData = ref(true);
const staticDataError = ref(null);
const generationParams = reactive({
  min_score: 4.0,
  num_genres_target: 2,
  num_themes_target: 2,
  num_finales_target: 1,
  num_support_target: 1,
  add_antagonist: true,
});
const generatedIdeas = ref([]);
const generationStatusMessage = ref('');
const isGeneratorErrorStatus = ref(false);
const isGenerating = ref(false);
const calculationResults = ref(null);
const isCalculating = ref(false);
const calculatorDataError = ref(null);


const canUseGenerator = computed(() =>
    allTagsData.value !== null &&
    compatibilityData.value !== null &&
    selectedTagsByCategory.value !== null &&
    !isLoadingStaticData.value &&
    !staticDataError.value &&
    !isGenerating.value
);
const canUseCalculator = computed(() =>
    allTagsData.value !== null &&
    audienceGroupsData.value !== null &&
    audienceWeightsData.value !== null &&
    advertisersData.value !== null &&
    !isLoadingStaticData.value &&
    !staticDataError.value &&
    !calculatorDataError.value
);


onMounted(async () => {
  isLoadingStaticData.value = true;
  staticDataError.value = null;
  calculatorDataError.value = null;
  selectedTagsByCategory.value = null;

  try {
    console.log("Loading core data...");
    const [
      compatResponse, allTagsResponse, defaultTagsResponse,
      audienceGroupsResponse, audienceWeightsResponse, advertisersResponse
    ] = await Promise.all([
      fetch('./tags-compatibility.json').catch(e => ({
        error: true,
        statusText: e.message,
        url: './tags-compatibility.json'
      })),
      fetch('./tags-list.json').catch(e => ({error: true, statusText: e.message, url: './tags-list.json'})),
      fetch('./active-tags-list.json').catch(e => ({
        error: true,
        statusText: e.message,
        url: './active-tags-list.json'
      })),
      fetch('./audience-groups.json').catch(e => ({error: true, statusText: e.message, url: './audience-groups.json'})),
      fetch('./audience-weights.json').catch(e => ({
        error: true,
        statusText: e.message,
        url: './audience-weights.json'
      })),
      fetch('./advertisers.json').catch(e => ({error: true, statusText: e.message, url: './advertisers.json'}))
    ]);

    const generatorDataErrors = [];
    if (compatResponse.error || !compatResponse.ok) generatorDataErrors.push(`Failed to load ${compatResponse.url || 'tags-compatibility.json'}: ${compatResponse.statusText} (${compatResponse.status ?? 'Network Error'})`);
    if (allTagsResponse.error || !allTagsResponse.ok) generatorDataErrors.push(`Failed to load ${allTagsResponse.url || 'tags-list.json'}: ${allTagsResponse.statusText} (${allTagsResponse.status ?? 'Network Error'})`);
    if (defaultTagsResponse.error || !defaultTagsResponse.ok) {
      console.warn(`Could not load default tags from ${defaultTagsResponse.url || './active-tags-list.json'}.`);
      defaultActiveTags.value = {};
    }

    const calcDataErrors = [];
    if (audienceGroupsResponse.error || !audienceGroupsResponse.ok) calcDataErrors.push(`Failed to load ${audienceGroupsResponse.url || 'audience-groups.json'}: ${audienceGroupsResponse.statusText} (${audienceGroupsResponse.status ?? 'Network Error'})`);
    if (audienceWeightsResponse.error || !audienceWeightsResponse.ok) calcDataErrors.push(`Failed to load ${audienceWeightsResponse.url || 'audience-weights.json'}: ${audienceWeightsResponse.statusText} (${audienceWeightsResponse.status ?? 'Network Error'})`);
    if (advertisersResponse.error || !advertisersResponse.ok) calcDataErrors.push(`Failed to load ${advertisersResponse.url || 'advertisers.json'}: ${advertisersResponse.statusText} (${advertisersResponse.status ?? 'Network Error'})`);

    const allCriticalErrors = [...generatorDataErrors, ...calcDataErrors];
    if (allCriticalErrors.length > 0) throw new Error(`Critical data loading failed: ${allCriticalErrors.join('; ')}`);

    compatibilityData.value = await compatResponse.json();
    allTagsData.value = await allTagsResponse.json();
    if (!defaultActiveTags.value && !defaultTagsResponse.error && defaultTagsResponse.ok) defaultActiveTags.value = await defaultTagsResponse.json();
    else if (!defaultActiveTags.value) defaultActiveTags.value = {};
    audienceGroupsData.value = await audienceGroupsResponse.json();
    audienceWeightsData.value = await audienceWeightsResponse.json();
    advertisersData.value = await advertisersResponse.json();

    selectedTagsByCategory.value = JSON.parse(JSON.stringify(defaultActiveTags.value || {}));
    console.log("All static core data loaded successfully.");

  } catch (error) {
    console.error("Error loading critical static data:", error);
    staticDataError.value = `Failed to load critical data: ${error.message}. App may be partially functional. Please refresh.`;
    allTagsData.value = null;
    compatibilityData.value = null;
    audienceGroupsData.value = null;
    audienceWeightsData.value = null;
    advertisersData.value = null;
    selectedTagsByCategory.value = null;
  } finally {
    isLoadingStaticData.value = false;
  }
});


function updateGenerationParams(newParamsObject) {
  Object.assign(generationParams, newParamsObject);
}

async function handleGenerateIdeas() {
  generationStatusMessage.value = '';
  isGeneratorErrorStatus.value = false;

  if (!canUseGenerator.value) {
    if (isLoadingStaticData.value) generationStatusMessage.value = "Waiting for core data...";
    else if (staticDataError.value) generationStatusMessage.value = "Cannot generate: Core data failed.";
    else if (!selectedTagsByCategory.value) generationStatusMessage.value = "Error: Generator state not initialized.";
    else if (isGenerating.value) generationStatusMessage.value = "Generation in progress...";
    else generationStatusMessage.value = "Cannot generate.";
    isGeneratorErrorStatus.value = true;
    return;
  }
  const calculatorDataAvailable = canUseCalculator.value;
  if (!calculatorDataAvailable) {
    console.warn("Cannot enrich generated ideas: Calculator data not loaded.");
    generationStatusMessage.value = "Warning: Calculator data missing, ideas will lack audience/advertiser info.";
  }

  const totalSelected = Object.values(selectedTagsByCategory.value || {}).reduce((sum, arr) => sum + (arr?.length ?? 0), 0);
  if (totalSelected === 0) {
    generationStatusMessage.value = "Warning: No tags selected for generator.";
    isGeneratorErrorStatus.value = false;
    return;
  }

  isGenerating.value = true;
  generationStatusMessage.value = 'Generating & Analyzing Ideas... Please wait.';
  generatedIdeas.value = [];
  const successfulIdeas = [];
  const numberOfIdeasToGenerate = 6;

  console.log("Generating ideas with params:", JSON.parse(JSON.stringify(generationParams)));
  console.log("Using generator tags:", JSON.parse(JSON.stringify(selectedTagsByCategory.value)));

  try {
    await new Promise(resolve => setTimeout(resolve, 10));

    for (let i = 0; i < numberOfIdeasToGenerate; i++) {
      console.log(`Attempting generation #${i + 1}`);
      let currentIdea = null;
      try {
        const tagsCopy = JSON.parse(JSON.stringify(selectedTagsByCategory.value));
        const currentParams = {...generationParams};
        currentIdea = generateMovieIdeaWithRetry(tagsCopy, compatibilityData.value, currentParams);

        if (currentIdea && currentIdea.AllTags && calculatorDataAvailable) {
          console.log(`Enriching idea #${i + 1}...`);
          try {
            const appeal = calculateAverageAudienceAppeal(currentIdea.AllTags, audienceWeightsData.value, audienceGroupsData.value);
            const matches = calculateAdvertiserMatches(appeal, advertisersData.value);
            if (matches) {
              currentIdea.interestedAudiences = matches.interestedAudiences;
              currentIdea.topAdvertisers = matches.topAdvertisers;
              currentIdea.usedAudienceFallback = matches.usedAudienceFallback;
              currentIdea.usedAdvertiserFallback = matches.usedAdvertiserFallback;
            } else {
              console.warn(`Failed matches for idea #${i + 1}.`);
              currentIdea.interestedAudiences = [];
              currentIdea.topAdvertisers = [];
              currentIdea.usedAudienceFallback = false;
              currentIdea.usedAdvertiserFallback = false;
            }
          } catch (enrichError) {
            console.error(`Error enriching idea #${i + 1}:`, enrichError);
            currentIdea.interestedAudiences = [];
            currentIdea.topAdvertisers = [];
            currentIdea.usedAudienceFallback = false;
            currentIdea.usedAdvertiserFallback = false;
          }
        } else if (currentIdea) {
          currentIdea.interestedAudiences = [];
          currentIdea.topAdvertisers = [];
          currentIdea.usedAudienceFallback = false;
          currentIdea.usedAdvertiserFallback = false;
        }

        if (currentIdea) successfulIdeas.push(currentIdea);
        else console.warn(`Generation #${i + 1} failed critically.`);

      } catch (generationError) {
        console.error(`Error during single gen/enrich #${i + 1}:`, generationError);
      }
    }

    generatedIdeas.value = successfulIdeas;

    if (successfulIdeas.length === 0) {
      generationStatusMessage.value = 'Could not generate valid ideas.';
      isGeneratorErrorStatus.value = true;
    } else {
      generationStatusMessage.value = `Generation complete. ${successfulIdeas.length} valid ideas.`;
      isGeneratorErrorStatus.value = false;
    }
    if (!calculatorDataAvailable && successfulIdeas.length > 0) {
      generationStatusMessage.value += " (Audience/Advertiser data was unavailable).";
    }

  } catch (processError) {
    console.error("Unexpected error during generation process:", processError);
    generationStatusMessage.value = `Unexpected error: ${processError.message}`;
    isGeneratorErrorStatus.value = true;
    generatedIdeas.value = [];
  } finally {
    isGenerating.value = false;
  }
}

async function handleCalculate(selectedCalculatorTags) {
  console.log("Handle Calculate triggered:", selectedCalculatorTags);
  if (!canUseCalculator.value) {
    console.warn("Calculation attempt failed: Required data not available.");
    calculationResults.value = {
      validation: {isValid: false, errorMessages: ["Calculator data not loaded or failed."]},
      results: null
    };
    return;
  }
  isCalculating.value = true;
  calculationResults.value = null;
  try {
    await new Promise(resolve => setTimeout(resolve, 10));
    const results = runCalculations(selectedCalculatorTags, audienceWeightsData.value, audienceGroupsData.value, advertisersData.value);
    console.log("Calculation Result:", results);
    calculationResults.value = results;
  } catch (error) {
    console.error("Error during handleCalculate:", error);
    calculationResults.value = {
      validation: {isValid: false, errorMessages: [`Calculation failed: ${error.message}`]},
      results: null
    };
  } finally {
    isCalculating.value = false;
  }
}

</script>

<template>
  <div id="app-container">
    <h1>Movie Idea Generator & Concept Calculator</h1>
    <div v-if="isLoadingStaticData" class="loading-message">Loading core data...</div>
    <div v-if="staticDataError" class="error-message static-error">{{ staticDataError }}</div>

    <template v-if="!isLoadingStaticData && !staticDataError">

      <section class="calculator-section">
        <div v-if="!canUseCalculator" class="loading-message">
          Calculator unavailable: Loading required data or error occurred.
          <div v-if="calculatorDataError" class="error-message static-error" style="margin-top: 10px;">
            {{ calculatorDataError }}
          </div>
        </div>
        <CalculatorPanel
            v-else
            :all-tags="allTagsData"
            :calculation-results="calculationResults"
            :is-loading="isCalculating"
            @calculate="handleCalculate"/>
      </section>

      <hr class="section-divider">

      <section class="generator-section">
        <h2>Idea Generator</h2>
        <div class="controls-area">
          <div class="controls-block tags-block">
            <ActiveTagsSelector
                :all-tags="allTagsData"
                v-model="selectedTagsByCategory"
                v-if="allTagsData && selectedTagsByCategory !== null"/>
            <div v-else class="loading-tags-placeholder">Loading generator tag selector...</div>
          </div>
          <div class="controls-block params-block">
            <ParameterSliders
                :modelValue="generationParams"
                @update:modelValue="updateGenerationParams"/>
          </div>
        </div>
        <div class="generate-button-container">
          <button @click="handleGenerateIdeas" :disabled="!canUseGenerator || isGenerating">
            {{ isGenerating ? 'Generating & Analyzing...' : 'Generate Ideas' }}
          </button>
        </div>
        <ResultsDisplay
            :ideas="generatedIdeas"
            :status-message="generationStatusMessage"
            :is-error-status="isGeneratorErrorStatus"/>
      </section>

      <hr class="section-divider">
    </template>
  </div>
</template>

<style>
html, body {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  /* display: block; */
  background-color: #282c34;
  color: #F5F5DC;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  scrollbar-width: thin;
  scrollbar-color: #6c757d #343a40;
  display: flex;
  flex-direction: column;
  align-items: center;
}

body::-webkit-scrollbar {
  width: 8px;
}

body::-webkit-scrollbar-track {
  background: #343a40;
  border-radius: 4px;
}

body::-webkit-scrollbar-thumb {
  background-color: #6c757d;
  border-radius: 4px;
  border: 2px solid #343a40;
}

#app-container {
  /* max-width: 95%; */
  max-width: 1400px;
  margin: 30px auto 50px;
  padding: 25px 15px;
  width: 90vw;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
}

h1 {
  text-align: center;
  color: #FFFFFF;
  margin-top: 0;
  margin-bottom: 20px;
  font-weight: 300;
}

h2 {
  text-align: center;
  color: #e8e8e8;
  margin-top: 10px;
  margin-bottom: 20px;
  font-weight: 300;
  border-bottom: 1px solid #555;
  padding-bottom: 10px;
}

.generator-section, .calculator-section {
  width: 100%;
  max-width: 1800px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.controls-area {
  display: grid;
  grid-template-columns: 1fr;
  gap: 30px;
  width: 100%;
  max-width: 1800px;
  justify-items: center;
}

@media (min-width: 992px) {
  .controls-area {
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    align-items: start;
  }
}

.controls-block {
  padding: 20px 25px;
  border: 1px solid #444;
  border-radius: 8px;
  background-color: #343a40;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.loading-tags-placeholder {
  color: #aaa;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

.generate-button-container {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-top: 10px;
  margin-bottom: 10px;
}

button {
  padding: 12px 20px;
  cursor: pointer;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  font-weight: bold;
  transition: background-color 0.2s ease, opacity 0.2s ease;
}

button:hover:not(:disabled) {
  background-color: #0056b3;
}

button:disabled {
  background-color: #5a5a5a;
  opacity: 0.7;
  cursor: not-allowed;
}

a {
  color: #61dafb;
}

a:hover {
  color: #bbe1fa;
}

.error-message {
  color: #f8d7da;
  background-color: #721c24;
  border: 1px solid #f5c6cb;
  padding: 10px 15px;
  border-radius: 4px;
  line-height: 1.4;
}

.error-message.static-error {
  margin-bottom: 15px;
  text-align: center;
  font-weight: bold;
  width: 100%;
  max-width: 800px;
}

.loading-message {
  text-align: center;
  padding: 20px;
  color: #ccc;
  font-style: italic;
  font-size: 1.1em;
  width: 100%;
  max-width: 800px;
}

.section-divider {
  border: none;
  border-top: 1px solid #555;
  margin: 40px 0;
  width: 80%;
  max-width: 1800px;
}

.calculator-section .calculator-panel {
  width: 100%;
}

.generator-section,
.calculator-section,
.controls-block,
.calculator-panel {
  max-width: none;
}
</style>
