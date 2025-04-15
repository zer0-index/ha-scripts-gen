// src/services/generator.js

// --- Helper Functions ---

/**
 * Selects a random element from an array.
 * @param {Array<any>} arr - The array to select from.
 * @returns {any | undefined} A random element, or undefined if the array is empty.
 */
function getRandomElement(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Retrieves the compatibility score for a specific direction (TagA -> TagB) from the dataset.
 * @param {string} tagA - The source tag.
 * @param {string} tagB - The target tag.
 * @param {object} compatibilityData - The complete compatibility score dataset.
 * @returns {number} The compatibility score (defaults to 0.0 if not found).
 */
function getCompatibilityScore(tagA, tagB, compatibilityData) {
    // Return only the score for the specific direction A -> B, or 0.0 if not defined.
    return compatibilityData[tagA]?.[tagB] ?? 0.0;
}

/**
 * Checks if a candidate tag is compatible with all previously selected tags,
 * based on a minimum required score for *at least one direction* of the pair.
 * @param {string} candidateTag - The tag to check.
 * @param {Array<string>} existingTags - The list of already selected tags.
 * @param {object} compatibilityData - The compatibility dataset.
 * @param {number} requiredScore - The minimum score required for a pair to be considered compatible.
 * @returns {boolean} True if the candidate is compatible with all existing tags, false otherwise.
 */
function isCompatibleWithAll(candidateTag, existingTags, compatibilityData, requiredScore) {
    if (existingTags.length === 0) return true; // Compatible with empty set

    for (const existingTag of existingTags) {
        // Check compatibility in both directions: Candidate -> Existing AND Existing -> Candidate
        const scoreForward = getCompatibilityScore(candidateTag, existingTag, compatibilityData);
        const scoreReverse = getCompatibilityScore(existingTag, candidateTag, compatibilityData);

        // If *neither* direction meets the required score, the candidate is incompatible with this existing tag
        if (scoreForward < requiredScore && scoreReverse < requiredScore) {
            // console.debug(`Compatibility fail: ${candidateTag} vs ${existingTag} (Scores: ${scoreForward}/${scoreReverse}, Required: ${requiredScore})`);
            return false;
        }
    }
    // If all checks passed, the tag is compatible
    return true;
}

/**
 * Filters a list of candidate tags, returning only those compatible with all existing tags.
 * Uses the updated isCompatibleWithAll logic.
 * @param {Array<string>} candidateTags - The list of potential tags to add.
 * @param {Array<string>} existingTags - The list of already selected tags.
 * @param {object} compatibilityData - The compatibility dataset.
 * @param {number} requiredScore - The minimum compatibility score required.
 * @returns {Array<string>} An array containing only the compatible tags from the candidate list.
 */
function findCompatibleTags(candidateTags, existingTags, compatibilityData, requiredScore) {
    if (!candidateTags || candidateTags.length === 0) return [];
    // Filter candidates based on compatibility with all existing tags
    return candidateTags.filter(tag => isCompatibleWithAll(tag, existingTags, compatibilityData, requiredScore));
}

/**
 * Helper to get a combined, unique list of available Theme and Event tags
 * from the expected key in activeTags.
 * @param {object} activeTags - The current state of available tags.
 * @returns {Array<string>} Unique list of Theme/Event tags.
 */
function getAvailableThemesEvents(activeTags) {
    // Use the single key found in the active-tags-list.json file
    const themeEventCategoryKey = "THEME_and_EVENTS";
    const available = new Set();

    // Check if the key exists and has tags
    if (activeTags[themeEventCategoryKey] && Array.isArray(activeTags[themeEventCategoryKey])) {
        activeTags[themeEventCategoryKey].forEach(tag => {
            available.add(tag);
        });
    } else {
        // Optionally log a warning if the key is missing or not an array
        console.warn(`Warning: Expected key "${themeEventCategoryKey}" not found or not an array in activeTags.`);
    }

    return Array.from(available); // Convert Set back to Array
}


// --- Main Generation Function ---

/**
 * Generates a single movie idea object based on active tags, compatibility data, and NEW parameters.
 * Follows the modified algorithm as per the Technical Specification.
 * @param {object} activeTagsInput - A deep copy of the user-provided active tags ({CategoryKey: [Tag1, ...]}).
 * @param {object} compatibilityData - The full compatibility dataset (read-only).
 * @param {object} params - Generation parameters (num_genres_target, min_score, num_themes_target, etc.).
 * @returns {object | null} The generated idea object, or null if generation fails at any critical step.
 */
export function generateMovieIdea(activeTagsInput, compatibilityData, params) {
    console.log("Starting idea generation with NEW params:", params);
    // Use the provided deep copy directly
    const activeTags = activeTagsInput;

    // Validate required parameters exist
    const requiredParams = ['min_score', 'num_genres_target', 'num_themes_target', 'num_finales_target', 'num_support_target', 'add_antagonist'];
    for (const p of requiredParams) {
        if (params[p] === undefined) {
            console.error(`Missing required parameter: ${p}`);
            return null; // Fail early if params are incomplete
        }
    }

    // Initialize the structure for the result
    const idea = {
        Genres: [],
        GenreWeights: [],
        Setting: null,
        Protagonist: null,
        Antagonist: null,
        SupportingChars: [],
        Finales: [],
        ThemesEvents: [],
        TotalScore: 0,
        AllTags: [], // Stores the final list of all selected tags for the idea
        Warnings: [] // Collects non-critical issues
    };

    // Keep track of selected tags for ongoing compatibility checks
    const selectedTags = [];

    // Calculate the fallback score for less strict compatibility checks where allowed
    const fallbackScore = Math.max(0.0, params.min_score - 1.0);
    console.log(`Using Min Score: ${params.min_score}, Fallback Score: ${fallbackScore}`);

    // --- Generation Steps ---
    try {
        // --- Step 1: Select Genres (Target: params.num_genres_target) ---
        console.log(`Step 1: Selecting ${params.num_genres_target} Genres`);
        if (!activeTags.GENRES || activeTags.GENRES.length === 0) {
            throw new Error("No active genres available for selection.");
        }
        if (params.num_genres_target < 1 || params.num_genres_target > 3) {
            throw new Error(`Invalid num_genres_target: ${params.num_genres_target}. Must be 1, 2, or 3.`);
        }

        // 1.1 Select the first genre (always mandatory)
        const firstGenre = getRandomElement(activeTags.GENRES);
        if (!firstGenre) throw new Error("Failed to select the first genre."); // Should not happen if check above passes
        idea.Genres.push(firstGenre);
        selectedTags.push(firstGenre);
        activeTags.GENRES = activeTags.GENRES.filter(g => g !== firstGenre); // Remove selected
        console.log(`Selected 1st Genre: ${firstGenre}`);

        // 1.2 Select the second genre (if target >= 2)
        if (params.num_genres_target >= 2) {
            if (activeTags.GENRES.length === 0) throw new Error("Not enough remaining genres to meet target (need 2nd).");
            let compatibleSecondGenres = findCompatibleTags(activeTags.GENRES, selectedTags, compatibilityData, params.min_score);
            if (compatibleSecondGenres.length === 0) {
                console.log(`No compatible 2nd genres at min_score ${params.min_score}, trying fallback ${fallbackScore}...`);
                compatibleSecondGenres = findCompatibleTags(activeTags.GENRES, selectedTags, compatibilityData, fallbackScore);
            }
            if (compatibleSecondGenres.length === 0) {
                throw new Error("Failed to find a compatible 2nd genre (even with fallback).");
            }
            const secondGenre = getRandomElement(compatibleSecondGenres);
            idea.Genres.push(secondGenre);
            selectedTags.push(secondGenre);
            activeTags.GENRES = activeTags.GENRES.filter(g => g !== secondGenre); // Remove selected
            console.log(`Selected 2nd Genre: ${secondGenre}`);
        }

        // 1.3 Select the third genre (if target == 3)
        if (params.num_genres_target === 3) {
            if (activeTags.GENRES.length === 0) throw new Error("Not enough remaining genres to meet target (need 3rd).");
            let compatibleThirdGenres = findCompatibleTags(activeTags.GENRES, selectedTags, compatibilityData, params.min_score);
            if (compatibleThirdGenres.length === 0) {
                console.log(`No compatible 3rd genres at min_score ${params.min_score}, trying fallback ${fallbackScore}...`);
                compatibleThirdGenres = findCompatibleTags(activeTags.GENRES, selectedTags, compatibilityData, fallbackScore);
            }
            if (compatibleThirdGenres.length === 0) {
                throw new Error("Failed to find a compatible 3rd genre (even with fallback).");
            }
            const thirdGenre = getRandomElement(compatibleThirdGenres);
            idea.Genres.push(thirdGenre);
            selectedTags.push(thirdGenre);
            activeTags.GENRES = activeTags.GENRES.filter(g => g !== thirdGenre); // Remove selected
            console.log(`Selected 3rd Genre: ${thirdGenre}`);
        }

        // 1.4 Calculate and normalize genre weights (same as before)
        const numGenres = idea.Genres.length;
        let weights = Array.from({length: numGenres}, () => Math.random());
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        idea.GenreWeights = (totalWeight > 0) ? weights.map(w => w / totalWeight) : Array(numGenres).fill(1 / numGenres); // Fallback to equal weights if random sum is 0
        console.log(`Calculated Genre Weights: ${idea.GenreWeights.map(w => w.toFixed(2)).join(', ')}`);


        // --- Step 2: Select Setting (Mandatory 1) ---
        console.log("Step 2: Selecting Setting");
        if (!activeTags.SETTING || activeTags.SETTING.length === 0) {
            throw new Error("No active settings available for selection.");
        }
        let compatibleSettings = findCompatibleTags(activeTags.SETTING, selectedTags, compatibilityData, params.min_score);
        if (compatibleSettings.length === 0) {
            console.log(`No compatible settings at min_score ${params.min_score}, trying fallback ${fallbackScore}...`);
            compatibleSettings = findCompatibleTags(activeTags.SETTING, selectedTags, compatibilityData, fallbackScore);
        }
        if (compatibleSettings.length === 0) {
            throw new Error("Failed to find a compatible setting (even with fallback).");
        }
        idea.Setting = getRandomElement(compatibleSettings);
        selectedTags.push(idea.Setting);
        // No need to remove from activeTags.SETTING as only one is selected and not reused
        console.log(`Selected Setting: ${idea.Setting}`);


        // --- Step 3: Select Protagonist (Mandatory 1) ---
        console.log("Step 3: Selecting Protagonist");
        if (!activeTags.PROTAGONIST || activeTags.PROTAGONIST.length === 0) {
            throw new Error("No active protagonists available for selection.");
        }
        let compatibleProtagonists = findCompatibleTags(activeTags.PROTAGONIST, selectedTags, compatibilityData, params.min_score);
        if (compatibleProtagonists.length === 0) {
            console.log(`No compatible protagonists at min_score ${params.min_score}, trying fallback ${fallbackScore}...`);
            compatibleProtagonists = findCompatibleTags(activeTags.PROTAGONIST, selectedTags, compatibilityData, fallbackScore);
        }
        if (compatibleProtagonists.length === 0) {
            throw new Error("Failed to find a compatible protagonist (even with fallback).");
        }
        idea.Protagonist = getRandomElement(compatibleProtagonists);
        selectedTags.push(idea.Protagonist);
        // Remove from pool if needed, though Protagonist is usually unique category
        activeTags.PROTAGONIST = activeTags.PROTAGONIST.filter(t => t !== idea.Protagonist);
        console.log(`Selected Protagonist: ${idea.Protagonist}`);


        // --- Step 4: Select Themes/Events (Target: params.num_themes_target) ---
        console.log(`Step 4: Selecting ${params.num_themes_target} Themes/Events`);
        if (params.num_themes_target < 1 || params.num_themes_target > 3) {
            throw new Error(`Invalid num_themes_target: ${params.num_themes_target}. Must be 1, 2, or 3.`);
        }

        let availableThemesEvents = getAvailableThemesEvents(activeTags);
        availableThemesEvents = availableThemesEvents.filter(tag => !selectedTags.includes(tag)); // Ensure not already selected

        if (availableThemesEvents.length === 0) {
            throw new Error("No active Theme/Event tags available for mandatory selection.");
        }

        let themesAddedCount = 0;
        for (let i = 0; i < params.num_themes_target; i++) {
            if (availableThemesEvents.length === 0) {
                if (i === 0) { // Failure to add the *first* one is critical
                    throw new Error("No remaining Theme/Event tags to select for mandatory first choice.");
                } else {
                    idea.Warnings.push(`Could not add Theme/Event #${i + 1} (target: ${params.num_themes_target}): No tags remaining.`);
                    console.warn(`Could not add Theme/Event #${i + 1}: No tags remaining.`);
                    break; // Stop trying if no tags left
                }
            }

            let compatibleThemesEvents;
            if (i === 0) { // First Theme/Event is mandatory, try fallback
                compatibleThemesEvents = findCompatibleTags(availableThemesEvents, selectedTags, compatibilityData, params.min_score);
                if (compatibleThemesEvents.length === 0) {
                    console.log(`No compatible 1st Theme/Event at min_score ${params.min_score}, trying fallback ${fallbackScore}...`);
                    compatibleThemesEvents = findCompatibleTags(availableThemesEvents, selectedTags, compatibilityData, fallbackScore);
                }
                if (compatibleThemesEvents.length === 0) {
                    throw new Error("Failed to find a compatible first Theme/Event (even with fallback).");
                }
            } else { // Subsequent Themes/Events use only min_score
                compatibleThemesEvents = findCompatibleTags(availableThemesEvents, selectedTags, compatibilityData, params.min_score);
                if (compatibleThemesEvents.length === 0) {
                    idea.Warnings.push(`Could not add Theme/Event #${i + 1} (target: ${params.num_themes_target}): No compatible tags found at min_score.`);
                    console.log(`Could not find compatible Theme/Event #${i + 1} (min_score only). Stopping Theme/Event selection.`);
                    break; // Stop adding if no compatible found
                }
            }

            // Select and add the tag
            const chosenThemeEvent = getRandomElement(compatibleThemesEvents);
            idea.ThemesEvents.push(chosenThemeEvent);
            selectedTags.push(chosenThemeEvent);
            themesAddedCount++;
            // Remove from available pool for this step
            availableThemesEvents = availableThemesEvents.filter(t => t !== chosenThemeEvent);
            // Also remove from the original activeTags structure to prevent potential selection by other categories (e.g., Finale if tags overlap)
            ["THEME", "EVENT"].forEach(category => {
                if (activeTags[category]) {
                    activeTags[category] = activeTags[category].filter(t => t !== chosenThemeEvent);
                }
            });
            console.log(`Selected Theme/Event #${themesAddedCount}: ${chosenThemeEvent}`);
        }


        // --- Step 5: Select Finales (Target: params.num_finales_target) ---
        console.log(`Step 5: Selecting ${params.num_finales_target} Finales`);
        if (params.num_finales_target < 1 || params.num_finales_target > 2) {
            throw new Error(`Invalid num_finales_target: ${params.num_finales_target}. Must be 1 or 2.`);
        }

        let availableFinales = (activeTags.FINALE || []).filter(tag => !selectedTags.includes(tag)); // Ensure not already selected

        if (availableFinales.length === 0) {
            throw new Error("No active Finale tags available for mandatory selection.");
        }

        let finalesAddedCount = 0;
        for (let i = 0; i < params.num_finales_target; i++) {
            if (availableFinales.length === 0) {
                if (i === 0) { // Failure to add the *first* one is critical
                    throw new Error("No remaining Finale tags to select for mandatory first choice.");
                } else {
                    idea.Warnings.push(`Could not add Finale #${i + 1} (target: ${params.num_finales_target}): No tags remaining.`);
                    console.warn(`Could not add Finale #${i + 1}: No tags remaining.`);
                    break; // Stop trying if no tags left
                }
            }

            let compatibleFinales;
            if (i === 0) { // First Finale is mandatory, try fallback
                compatibleFinales = findCompatibleTags(availableFinales, selectedTags, compatibilityData, params.min_score);
                if (compatibleFinales.length === 0) {
                    console.log(`No compatible 1st Finale at min_score ${params.min_score}, trying fallback ${fallbackScore}...`);
                    compatibleFinales = findCompatibleTags(availableFinales, selectedTags, compatibilityData, fallbackScore);
                }
                if (compatibleFinales.length === 0) {
                    throw new Error("Failed to find a compatible first Finale (even with fallback).");
                }
            } else { // Subsequent (second) Finale uses only min_score
                compatibleFinales = findCompatibleTags(availableFinales, selectedTags, compatibilityData, params.min_score);
                if (compatibleFinales.length === 0) {
                    idea.Warnings.push(`Could not add Finale #${i + 1} (target: ${params.num_finales_target}): No compatible tags found at min_score.`);
                    console.log(`Could not find compatible Finale #${i + 1} (min_score only). Stopping Finale selection.`);
                    break; // Stop adding if no compatible found
                }
            }

            // Select and add the tag
            const chosenFinale = getRandomElement(compatibleFinales);
            idea.Finales.push(chosenFinale);
            selectedTags.push(chosenFinale);
            finalesAddedCount++;
            // Remove from available pool for this step and original activeTags
            availableFinales = availableFinales.filter(t => t !== chosenFinale);
            activeTags.FINALE = (activeTags.FINALE || []).filter(t => t !== chosenFinale);
            console.log(`Selected Finale #${finalesAddedCount}: ${chosenFinale}`);
        }


        // --- Step 6: Select Antagonist (Optional, based on params.add_antagonist) ---
        console.log(`Step 6: Selecting Antagonist (Attempt: ${params.add_antagonist})`);
        if (params.add_antagonist) {
            let availableAntagonists = (activeTags.ANTAGONIST || []).filter(tag => !selectedTags.includes(tag));
            if (availableAntagonists.length > 0) {
                // Find compatible antagonists (strictly using min_score, no fallback)
                const compatibleAntagonists = findCompatibleTags(availableAntagonists, selectedTags, compatibilityData, params.min_score);
                if (compatibleAntagonists.length > 0) {
                    idea.Antagonist = getRandomElement(compatibleAntagonists);
                    selectedTags.push(idea.Antagonist);
                    activeTags.ANTAGONIST = activeTags.ANTAGONIST.filter(t => t !== idea.Antagonist); // Remove selected
                    console.log(`Selected Antagonist: ${idea.Antagonist}`);
                } else {
                    console.log("Could not find a compatible Antagonist (min_score only).");
                    idea.Warnings.push("Attempted to add antagonist, but none were compatible.");
                }
            } else {
                console.log("Attempted to add antagonist, but no tags were available in the active list.");
                idea.Warnings.push("Attempted to add antagonist, but no tags were available.");
            }
        } else {
            console.log("Skipping Antagonist selection based on parameter.");
        }


        // --- Step 7: Select Supporting Characters (Target: params.num_support_target) ---
        console.log(`Step 7: Selecting ${params.num_support_target} Supporting Characters`);
        if (params.num_support_target < 0 || params.num_support_target > 2) {
            // Allow 0, but cap at 2 for safety/specification
            console.warn(`Invalid num_support_target: ${params.num_support_target}. Using 0.`);
            params.num_support_target = 0;
        }

        let availableSupport = (activeTags.SUPPORTINGCHARACTER || []).filter(tag => !selectedTags.includes(tag));
        let supportAddedCount = 0;

        for (let i = 0; i < params.num_support_target; i++) {
            if (availableSupport.length === 0) {
                idea.Warnings.push(`Could not add Supporting Character #${i + 1} (target: ${params.num_support_target}): No tags remaining.`);
                console.warn(`Could not add Supporting Character #${i + 1}: No tags remaining.`);
                break; // Stop trying
            }

            // Find compatible characters (strictly using min_score)
            const compatibleSupport = findCompatibleTags(availableSupport, selectedTags, compatibilityData, params.min_score);

            if (compatibleSupport.length > 0) {
                const chosenSupport = getRandomElement(compatibleSupport);
                idea.SupportingChars.push(chosenSupport);
                selectedTags.push(chosenSupport);
                supportAddedCount++;
                // Remove from available pool and original activeTags
                availableSupport = availableSupport.filter(t => t !== chosenSupport);
                activeTags.SUPPORTINGCHARACTER = (activeTags.SUPPORTINGCHARACTER || []).filter(t => t !== chosenSupport);
                console.log(`Selected Supporting Character #${supportAddedCount}: ${chosenSupport}`);
            } else {
                idea.Warnings.push(`Could not add Supporting Character #${i + 1} (target: ${params.num_support_target}): No compatible tags found at min_score.`);
                console.log(`Could not find compatible Supporting Character #${i + 1} (min_score only). Stopping support character selection.`);
                break; // Stop trying if no compatible found
            }
        }


        // --- Step 8: Calculate Final Compatibility Score ---
        console.log("Step 8: Calculating Total Compatibility Score (Sum of A->B + B->A for all pairs)");
        let totalScore = 0;
        for (let i = 0; i < selectedTags.length; i++) {
            for (let j = i + 1; j < selectedTags.length; j++) {
                const tagA = selectedTags[i];
                const tagB = selectedTags[j];
                // Get score in both directions and add them
                const scoreForward = getCompatibilityScore(tagA, tagB, compatibilityData);
                const scoreReverse = getCompatibilityScore(tagB, tagA, compatibilityData);
                totalScore += scoreForward + scoreReverse;
                // console.debug(`Pair: ${tagA} <-> ${tagB}, Scores: ${scoreForward.toFixed(1)} + ${scoreReverse.toFixed(1)}, Cumulative Total: ${totalScore.toFixed(1)}`);
            }
        }
        // Round the final score to one decimal place
        idea.TotalScore = Math.round(totalScore * 10) / 10;
        console.log(`Calculated Final Total Score: ${idea.TotalScore}`);


        // --- Step 9: Finalize and Return ---
        idea.AllTags = [...selectedTags]; // Store the final list of selected tags
        console.log("Idea generation successful.");
        return idea; // Return the completed idea object

    } catch (error) {
        // Catch any errors thrown during critical steps
        console.error("Idea generation failed critically:", error.message);
        // console.error(error.stack); // Optional: Log stack trace for debugging
        return null; // Indicate failure by returning null
    }
}
