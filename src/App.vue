<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import ParameterSliders from './components/ParameterSliders.vue';
import FileInput from './components/FileInput.vue';
import ResultsDisplay from './components/ResultsDisplay.vue';
import { generateMovieIdea } from './services/generator.js';

// --- State ---

const compatibilityData = ref(null);
const tagsListData = ref(null); // List of all possible tags (for potential future validation etc.)
const isLoadingStaticData = ref(true); // Loading indicator for core data
const staticDataError = ref(null); // Error message for core data loading failure

const activeTagsData = ref(null); // Holds the currently active tags (from user file or default)
const fileErrorMessage = ref(''); // Error message specific to loading active-tags-list.json (user or default)
const isUsingDefaultTags = ref(false); // Flag to indicate if the default tags are currently active

// Generation parameters controlled by sliders/checkbox
const generationParams = reactive({
  min_score: 4.0,
  num_genres_target: 2,
  num_themes_target: 2,
  num_finales_target: 1,
  num_support_target: 1,
  add_antagonist: true,
});

const generatedIdeas = ref([]); // Array to hold successfully generated ideas
const generationStatusMessage = ref(''); // User feedback during/after generation
const isErrorStatus = ref(false); // Flag for styling the status message as an error
const isGenerating = ref(false); // Flag to disable button during generation

// --- Computed Properties ---

// Determines if active tags data (from any source) is loaded
const isFileLoaded = computed(() => activeTagsData.value !== null);

// Determines if the generate button should be enabled
const canGenerate = computed(() =>
    isFileLoaded.value &&          // Need active tags
    compatibilityData.value !== null && // Need compatibility data
    !isLoadingStaticData.value &&  // Core data must be loaded
    !staticDataError.value &&      // No core data errors
    !isGenerating.value            // Not already generating
);

// --- Helper Function ---

/**
 * Attempts to load the default active-tags-list.json file from the public directory.
 * Updates state if successful, otherwise sets a file error message.
 */
async function loadDefaultActiveTags() {
  // Only attempt to load default if no user file has been loaded yet
  if (activeTagsData.value) {
    console.log("Skipping default tags load, user file already present.");
    return;
  }
  try {
    console.log("Attempting to load default active-tags-list.json from /public...");
    const response = await fetch('./active-tags-list.json'); // Path relative to public folder

    if (!response.ok) {
      // Gracefully handle 404 or other fetch errors for the default file
      throw new Error(`Default file not found or fetch failed: ${response.statusText} (${response.status})`);
    }

    const defaultTagsData = await response.json();
    // Use a flag to signal to handleFileLoaded this is the default load
    handleFileLoaded(defaultTagsData, true); // Pass true for isDefaultLoad
    isUsingDefaultTags.value = true; // Explicitly set flag here too
    fileErrorMessage.value = ''; // Clear any previous file errors
    // Set specific status message for default load
    generationStatusMessage.value = 'Loaded default active tags template. Upload your own file to override.';
    console.log("Successfully loaded and applied default active-tags-list.json");

  } catch (error) {
    console.warn("Could not load default active-tags-list.json:", error.message); // Use warn for non-critical error
    // Display a less severe message if the default file is missing/fails
    fileErrorMessage.value = `Could not load default tags template. Please upload a file manually.`;
    isUsingDefaultTags.value = false;
  }
}

// --- Lifecycle Hooks ---

onMounted(async () => {
  isLoadingStaticData.value = true;
  staticDataError.value = null;
  isUsingDefaultTags.value = false; // Reset flag on mount

  try {
    // --- Load Core Data ---
    console.log("Loading core data (compatibility, tags list)...");
    const [compatResponse, tagsListResponse] = await Promise.all([
      fetch('./tags-compatibility.json'),
      fetch('./tags-list.json')
    ]);

    // Check core data responses
    if (!compatResponse.ok) {
      throw new Error(`Failed to load tags-compatibility.json: ${compatResponse.statusText} (${compatResponse.status})`);
    }
    if (!tagsListResponse.ok) {
      throw new Error(`Failed to load tags-list.json: ${tagsListResponse.statusText} (${tagsListResponse.status})`);
    }

    // Parse core data
    compatibilityData.value = await compatResponse.json();
    tagsListData.value = await tagsListResponse.json();
    console.log("Static core data loaded successfully.");

    // --- Attempt to Load Default Active Tags AFTER core data ---
    // This will only load if no user file is present yet
    await loadDefaultActiveTags();

  } catch (error) {
    // This catch handles critical errors from CORE data loading
    console.error("Error loading static CORE data:", error);
    staticDataError.value = `Failed to load core data: ${error.message}. Generation unavailable. Please refresh.`;
    generationStatusMessage.value = staticDataError.value; // Show critical error prominently
    isErrorStatus.value = true;
    // If core data fails, don't proceed further
  } finally {
    isLoadingStaticData.value = false; // Loading finished (even if errors occurred)
  }
});

// --- Event Handlers ---

/**
 * Handles successful loading/clearing of active tags file (user OR default).
 * @param {object | null} data - Parsed JSON data or null if cleared.
 * @param {boolean} [isDefaultLoad=false] - Flag indicating if this is the default load.
 */
function handleFileLoaded(data, isDefaultLoad = false) {
  activeTagsData.value = data;

  if (data) {
    // If it's NOT the initial default load, it's a user action
    if (!isDefaultLoad) {
      isUsingDefaultTags.value = false; // User uploaded, not using default anymore
      fileErrorMessage.value = ''; // Clear errors
      generationStatusMessage.value = ''; // Clear default load message
      console.log("Active tags file loaded/updated by user.");
    } else {
      // It IS the default load, keep isUsingDefaultTags true (set in loadDefaultActiveTags)
      console.log("Default active tags file processed by handleFileLoaded.");
      // Keep the specific status message set by loadDefaultActiveTags
    }
  } else {
    // File selection was cleared by the user
    isUsingDefaultTags.value = false;
    activeTagsData.value = null; // Ensure data is null
    fileErrorMessage.value = '';
    generationStatusMessage.value = ''; // Clear status message
    console.log("Active tags file selection cleared.");
    // Optionally try reloading default here if desired, or just wait for user upload
    // loadDefaultActiveTags(); // Example: Uncomment to immediately reload default when user clears
  }

  // Always reset results when active tags change
  generatedIdeas.value = [];
  isErrorStatus.value = false; // Reset error status unless set elsewhere
}

/**
 * Handles errors during file loading/parsing (user OR default).
 * @param {string} message - The error message.
 */
function handleFileError(message) {
  activeTagsData.value = null; // Ensure no active tags
  isUsingDefaultTags.value = false; // Not using default if there was an error
  fileErrorMessage.value = message; // Display the specific file error
  // Reset results and status
  generatedIdeas.value = [];
  generationStatusMessage.value = '';
  isErrorStatus.value = false;
}

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
  // Clear previous status (unless it's the 'default loaded' message)
  if (!isUsingDefaultTags.value || generatedIdeas.value.length > 0) {
    generationStatusMessage.value = '';
  }
  isErrorStatus.value = false;

  // --- Pre-generation Checks ---
  if (!isFileLoaded.value) {
    // This case should be less likely now with default loading, but keep as safeguard
    generationStatusMessage.value = "Error: No active tags loaded. Please upload a file or ensure the default template is available.";
    isErrorStatus.value = true;
    return;
  }
  if (!compatibilityData.value || isLoadingStaticData.value || staticDataError.value) {
    // Critical core data missing
    generationStatusMessage.value = "Error: Core compatibility data unavailable. Cannot generate.";
    isErrorStatus.value = true;
    return;
  }
  if (isGenerating.value) {
    // Prevent concurrent generation
    // generationStatusMessage.value = "Generation is already in progress..."; // Avoid spamming this
    return;
  }

  // --- Start Generation ---
  isGenerating.value = true;
  // Set generating message, potentially overwriting 'default loaded' message now
  generationStatusMessage.value = 'Generating ideas... Please wait.';
  generatedIdeas.value = []; // Clear previous results
  const successfulIdeas = [];
  const numberOfIdeasToGenerate = 6;

  console.log("Generating ideas with parameters:", JSON.parse(JSON.stringify(generationParams)));

  try {
    await new Promise(resolve => setTimeout(resolve, 10)); // UI update delay

    for (let i = 0; i < numberOfIdeasToGenerate; i++) {
      console.log(`Attempting generation #${i + 1} of ${numberOfIdeasToGenerate}`);
      try {
        // Deep copy active tags FOR THIS ITERATION
        const tagsCopy = JSON.parse(JSON.stringify(activeTagsData.value));
        // Shallow copy params FOR THIS ITERATION
        const currentParams = { ...generationParams };

        const idea = generateMovieIdea(tagsCopy, compatibilityData.value, currentParams);

        if (idea) {
          successfulIdeas.push(idea);
          // console.log(`Generation #${i + 1} successful.`); // Less verbose success log
        } else {
          console.warn(`Generation #${i + 1} failed (algorithm returned null).`);
        }
      } catch (generationError) {
        console.error(`Error during single idea generation #${i + 1}:`, generationError);
      }
    } // End loop

    generatedIdeas.value = successfulIdeas;

    // --- Update Final Status Message ---
    if (successfulIdeas.length === 0) {
      generationStatusMessage.value = 'Could not generate any valid ideas. Try adjusting parameters or using different active tags.';
      isErrorStatus.value = true;
    } else {
      generationStatusMessage.value = `Generation complete. Generated ${successfulIdeas.length} valid ideas.`;
      isErrorStatus.value = false;
      // If default was used, maybe remove the indicator now that results exist?
      // isUsingDefaultTags.value = false; // Optional: uncomment if desired
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

    <!-- Loading State for Core Data -->
    <div v-if="isLoadingStaticData" class="loading-message">Loading core data...</div>

    <!-- Static Data Loading Error Message -->
    <div v-if="staticDataError" class="error-message static-error">{{ staticDataError }}</div>

    <!-- Main Content Area -->
    <template v-if="!isLoadingStaticData && !staticDataError">
      <!-- Controls Section -->
      <div class="controls">

        <!-- File Input & Default Actions -->
        <FileInput @file-loaded="handleFileLoaded" @file-error="handleFileError"/>
        <div class="default-file-actions">
          <a href="/active-tags-list.json" download="active-tags-list-template.json" class="download-link" title="Download default active tags template">
            Download Template
          </a>
          <span v-if="isUsingDefaultTags" class="default-loaded-indicator" title="Currently using the default tags template">
             (Using Default)
          </span>
        </div>
        <div v-if="fileErrorMessage" class="error-message file-error">{{ fileErrorMessage }}</div>

        <!-- Generation Parameters -->
        <ParameterSliders
            :modelValue="generationParams"
            @update:modelValue="updateGenerationParams"
        />

        <!-- Generate Button -->
        <button @click="handleGenerateIdeas" :disabled="!canGenerate">
          {{ isGenerating ? 'Generating...' : 'Generate Ideas' }}
        </button>
      </div>

      <!-- Results Display Area -->
      <ResultsDisplay
          :ideas="generatedIdeas"
          :status-message="generationStatusMessage"
          :is-error-status="isErrorStatus"
      />
    </template>

  </div>
</template>

<style>
/* --- Global Styles --- */
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
  /* Improve scrollbar appearance */
  scrollbar-width: thin;
  scrollbar-color: #6c757d #343a40;
}
/* Webkit scrollbar styling */
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


/* --- App Container --- */
#app-container {
  max-width: 900px;
  margin: 30px auto 50px auto; /* Top, H-Auto, Bottom */
  padding: 25px 15px;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
}

/* --- Controls Block --- */
.controls {
  display: flex;
  flex-direction: column;
  gap: 15px; /* Reduced gap inside controls */
  padding: 20px 25px;
  border: 1px solid #444;
  border-radius: 8px;
  background-color: #343a40;
  width: 100%;
  max-width: 600px;
  box-sizing: border-box;
}

/* --- Default File Actions (Download Link/Indicator) --- */
.default-file-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: -5px; /* Pull closer to file input */
  margin-bottom: 5px;
  font-size: 0.9em;
}

.download-link {
  color: #61dafb;
  text-decoration: none;
  padding: 4px 0;
}
.download-link:hover {
  color: #bbe1fa;
  text-decoration: underline;
}

.default-loaded-indicator {
  color: #28a745; /* Green indicator */
  font-style: italic;
  font-size: 0.9em;
}

/* --- Button --- */
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
  margin-top: 10px;
}
button:hover:not(:disabled) { background-color: #0056b3; }
button:disabled { background-color: #5a5a5a; opacity: 0.7; cursor: not-allowed; }

/* --- Headings & Links --- */
h1 {
  text-align: center;
  color: #FFFFFF;
  margin-top: 0;
  margin-bottom: 20px;
  font-weight: 300;
}
a { color: #61dafb; }
a:hover { color: #bbe1fa; }

/* --- Messages --- */
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
  max-width: 600px; /* Match controls */
}
.error-message.file-error {
  margin-top: -5px; /* Adjust spacing relative to actions */
  margin-bottom: 5px;
}

.loading-message {
  text-align: center;
  padding: 20px;
  color: #ccc;
  font-style: italic;
  font-size: 1.1em;
}

</style>
