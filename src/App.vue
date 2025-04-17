<script setup>
import {ref, reactive, onMounted, computed} from 'vue';
import ActiveTagsSelector from './components/ActiveTagsSelector.vue';
import ParameterSliders from './components/ParameterSliders.vue';
import ResultsDisplay from './components/ResultsDisplay.vue';
import {generateMovieIdeaWithRetry} from './services/generator.js';

// --- State ---

const compatibilityData = ref(null);
const allTagsData = ref(null);
const defaultActiveTags = ref(null);
const selectedTagsByCategory = ref(null);

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
const isErrorStatus = ref(false);
const isGenerating = ref(false);

// --- Computed Properties ---

const canGenerate = computed(() =>
    selectedTagsByCategory.value !== null && // Ensure selection state is initialized
    compatibilityData.value !== null &&    // Need compatibility data
    !isLoadingStaticData.value &&          // Core data must be loaded
    !staticDataError.value &&              // No core data errors
    !isGenerating.value                    // Not already generating
);

// --- Lifecycle Hooks ---

onMounted(async () => {
  isLoadingStaticData.value = true;
  staticDataError.value = null;
  selectedTagsByCategory.value = null;

  try {
    console.log("Loading core data (compatibility, all tags, default tags)...");
    const [compatResponse, allTagsResponse, defaultTagsResponse] = await Promise.all([
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
      }))
    ]);

    // Check responses individually for better error reporting
    if (compatResponse.error || !compatResponse.ok) {
      throw new Error(`Failed to load ${compatResponse.url || 'tags-compatibility.json'}: ${compatResponse.statusText} (${compatResponse.status ?? 'Network Error'})`);
    }
    if (allTagsResponse.error || !allTagsResponse.ok) {
      throw new Error(`Failed to load ${allTagsResponse.url || 'tags-list.json'}: ${allTagsResponse.statusText} (${allTagsResponse.status ?? 'Network Error'})`);
    }
    if (defaultTagsResponse.error || !defaultTagsResponse.ok) {
      console.warn(`Could not load default active tags from ${defaultTagsResponse.url || './active-tags-list.json'}: ${defaultTagsResponse.statusText} (${defaultTagsResponse.status ?? 'Network Error'}). Initializing with empty selection.`);
      defaultActiveTags.value = {};
      generationStatusMessage.value = 'Could not load default tag selection. Please select tags manually.';
    }

    // Parse core data
    compatibilityData.value = await compatResponse.json();
    allTagsData.value = await allTagsResponse.json();
    // Parse default tags only if fetch was successful
    if (!defaultActiveTags.value) {
      defaultActiveTags.value = await defaultTagsResponse.json();
    }

    selectedTagsByCategory.value = JSON.parse(JSON.stringify(defaultActiveTags.value || {}));

    console.log("Static core data loaded successfully. Initialized tag selection.");

  } catch (error) {
    console.error("Error loading critical static data:", error);
    staticDataError.value = `Failed to load critical data: ${error.message}. Generation unavailable. Please refresh.`;
    generationStatusMessage.value = staticDataError.value;
    isErrorStatus.value = true;
    allTagsData.value = null;
    compatibilityData.value = null;
    selectedTagsByCategory.value = null;
  } finally {
    isLoadingStaticData.value = false;
  }
});

// --- Event Handlers ---

/**
 * Updates reactive generationParams from child component.
 * @param {object} newParamsObject - The updated parameters.
 */
function updateGenerationParams(newParamsObject) {
  Object.assign(generationParams, newParamsObject);
}

/**
 * Initiates the movie idea generation process.
 */
async function handleGenerateIdeas() {
  generationStatusMessage.value = '';
  isErrorStatus.value = false;

  // --- Pre-generation Checks ---
  if (!canGenerate.value) {
    // Determine specific reason if needed (optional)
    if (isLoadingStaticData.value || staticDataError.value) {
      generationStatusMessage.value = "Error: Core data not loaded or failed to load.";
    } else if (!selectedTagsByCategory.value) {
      generationStatusMessage.value = "Error: Tag selection state not initialized.";
    } else if (isGenerating.value) {
      generationStatusMessage.value = "Generation is already in progress...";
    } else {
      generationStatusMessage.value = "Cannot generate. Please ensure tags are selected and parameters are set.";
    }
    isErrorStatus.value = true;
    console.warn("Generation prevented:", generationStatusMessage.value);
    return;
  }

  // Check if any tags are actually selected
  const totalSelected = Object.values(selectedTagsByCategory.value || {}).reduce((sum, arr) => sum + arr.length, 0);
  if (totalSelected === 0) {
    generationStatusMessage.value = "Warning: No tags selected. Please select some tags to generate ideas.";
    isErrorStatus.value = false;
    return;
  }


  // --- Start Generation ---
  isGenerating.value = true;
  generationStatusMessage.value = 'Generating ideas... Please wait.';
  generatedIdeas.value = []; // Clear previous results
  const successfulIdeas = [];
  const numberOfIdeasToGenerate = 6;

  console.log("Generating ideas with parameters:", JSON.parse(JSON.stringify(generationParams)));
  console.log("Using selected tags:", JSON.parse(JSON.stringify(selectedTagsByCategory.value)));

  try {
    await new Promise(resolve => setTimeout(resolve, 10));

    for (let i = 0; i < numberOfIdeasToGenerate; i++) {
      console.log(`Attempting generation #${i + 1} of ${numberOfIdeasToGenerate}`);
      try {
        // Deep copy the *currently selected* tags FOR THIS ITERATION
        const tagsCopy = JSON.parse(JSON.stringify(selectedTagsByCategory.value));
        // Shallow copy params FOR THIS ITERATION
        const currentParams = {...generationParams};

        const idea = generateMovieIdeaWithRetry(tagsCopy, compatibilityData.value, currentParams);

        if (idea) {
          successfulIdeas.push(idea);
        } else {
          console.warn(`Generation #${i + 1} failed (algorithm returned null).`);
        }
      } catch (generationError) {
        console.error(`Error during single idea generation #${i + 1}:`, generationError);
      }
    }

    generatedIdeas.value = successfulIdeas;

    // --- Update Final Status Message ---
    if (successfulIdeas.length === 0) {
      generationStatusMessage.value = 'Could not generate any valid ideas. Try adjusting parameters or selecting different tags.';
      isErrorStatus.value = true;
    } else {
      generationStatusMessage.value = `Generation complete. Generated ${successfulIdeas.length} valid ideas.`;
      isErrorStatus.value = false;
    }

  } catch (processError) {
    console.error("An unexpected error occurred during the generation process:", processError);
    generationStatusMessage.value = `An unexpected error occurred during generation: ${processError.message}`;
    isErrorStatus.value = true;
    generatedIdeas.value = [];
  } finally {
    isGenerating.value = false;
  }
}

</script>

<template>
  <div id="app-container">
    <h1>Movie Idea Generator</h1>
    <h5>[dev]: press "Generate Ideas" once for better page formatting</h5>

    <div v-if="isLoadingStaticData" class="loading-message">Loading core data and tag selectors...</div>

    <div v-if="staticDataError" class="error-message static-error">{{ staticDataError }}</div>

    <template v-if="!isLoadingStaticData && !staticDataError">

      <div class="controls-area">
        <div class="controls-block tags-block">
          <ActiveTagsSelector
              :all-tags="allTagsData"
              v-model="selectedTagsByCategory"
              v-if="allTagsData && selectedTagsByCategory"
          />
          <div v-else class="loading-tags-placeholder">Loading tag selector...</div>
        </div>

        <div class="controls-block params-block">
          <ParameterSliders
              :modelValue="generationParams"
              @update:modelValue="updateGenerationParams"
          />
        </div>
      </div>

      <div class="generate-button-container">
        <button @click="handleGenerateIdeas" :disabled="!canGenerate">
          {{ isGenerating ? 'Generating...' : 'Generate Ideas' }}
        </button>
      </div>


      <ResultsDisplay
          :ideas="generatedIdeas"
          :status-message="generationStatusMessage"
          :is-error-status="isErrorStatus"
      />
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
  display: block;
  background-color: #282c34;
  color: #F5F5DC;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  scrollbar-width: thin;
  scrollbar-color: #6c757d #343a40;
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
  max-width: 95%;
  margin: 30px auto 50px auto;
  padding: 25px 15px;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
}

.controls-area {
  display: grid;
  grid-template-columns: 1fr;
  gap: 30px;
  width: 100%;
  max-width: 1300px;
  justify-items: center;
}

@media (min-width: 992px) {
  .controls-area {
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    align-items: start;

    .controls-area > .controls-block {
      justify-self: center;
    }
  }
}

.controls-block {
  padding: 20px 25px;
  border: 1px solid #444;
  border-radius: 8px;
  background-color: #343a40;
  width: 100%;
  max-width: 800px;
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
  max-width: 800px;
  display: flex;
  justify-content: center;
  margin-top: -10px;
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

h1 {
  text-align: center;
  color: #FFFFFF;
  margin-top: 0;
  margin-bottom: 20px;
  font-weight: 300;
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
}

</style>
