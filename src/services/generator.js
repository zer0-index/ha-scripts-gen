// src/services/generator.js

const MAX_GENERATION_ATTEMPTS = 3;
const MIN_REQUIRED_SCORE = 44.0;

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
    if (existingTags.length === 0) return true;

    for (const existingTag of existingTags) {
        const scoreForward = getCompatibilityScore(candidateTag, existingTag, compatibilityData);
        const scoreReverse = getCompatibilityScore(existingTag, candidateTag, compatibilityData);
        if (scoreForward < requiredScore && scoreReverse < requiredScore) {
            return false;
        }
    }
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
    return candidateTags.filter(tag => isCompatibleWithAll(tag, existingTags, compatibilityData, requiredScore));
}

/**
 * Helper to get a combined, unique list of available Theme and Event tags
 * from the expected key in activeTags.
 * @param {object} activeTags - The current state of available tags.
 * @returns {Array<string>} Unique list of Theme/Event tags.
 */
function getAvailableThemesEvents(activeTags) {
    const themeEventCategoryKey = "THEME_and_EVENTS";
    const available = new Set();
    if (activeTags[themeEventCategoryKey] && Array.isArray(activeTags[themeEventCategoryKey])) {
        activeTags[themeEventCategoryKey].forEach(tag => {
            available.add(tag);
        });
    } else {
        console.warn(`Warning: Expected key "${themeEventCategoryKey}" not found or not an array in activeTags.`);
    }
    return Array.from(available);
}


/**
 * Wraps the generateMovieIdea function with retry logic based on TotalScore.
 * Tries up to MAX_GENERATION_ATTEMPTS times to get an idea with a score >= MIN_REQUIRED_SCORE.
 * @param {object} originalActiveTags - The initial set of active tags. Will be deep copied for each attempt.
 * @param {object} compatibilityData - The full compatibility dataset (read-only).
 * @param {object} params - Generation parameters.
 * @returns {object | null} The generated idea object (first successful or last attempt), or null if all attempts fail critically.
 */
export function generateMovieIdeaWithRetry(originalActiveTags, compatibilityData, params) {
    let lastGeneratedIdea = null;

    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
        console.log(`--- Starting Generation Attempt ${attempt} of ${MAX_GENERATION_ATTEMPTS} ---`);
        let activeTagsForAttempt;
        try {
            activeTagsForAttempt = JSON.parse(JSON.stringify(originalActiveTags));
        } catch (e) {
            console.error("Failed to deep copy activeTagsInput for retry attempt. Aborting.", e);
            return lastGeneratedIdea;
        }

        const currentIdea = generateMovieIdea(activeTagsForAttempt, compatibilityData, params);
        lastGeneratedIdea = currentIdea;

        if (currentIdea && currentIdea.TotalScore >= MIN_REQUIRED_SCORE) {
            console.log(`Attempt ${attempt} SUCCEEDED with score ${currentIdea.TotalScore} (>= ${MIN_REQUIRED_SCORE}). Returning this idea.`);
            return currentIdea;
        } else if (currentIdea) {
            console.log(`Attempt ${attempt} finished with score ${currentIdea.TotalScore} (< ${MIN_REQUIRED_SCORE}).`);
        } else {
            console.log(`Attempt ${attempt} failed critically (returned null).`);
        }

        if (attempt === MAX_GENERATION_ATTEMPTS) {
            console.log(`Max attempts (${MAX_GENERATION_ATTEMPTS}) reached.`);
            break;
        } else {
            console.log("Score too low or generation failed. Retrying...");
        }
    }

    console.log(`Returning result from the last attempt (Attempt ${MAX_GENERATION_ATTEMPTS}). Final Score: ${lastGeneratedIdea?.TotalScore ?? 'N/A'}`);
    return lastGeneratedIdea;
}


/**
 * Generates a single movie idea object based on active tags, compatibility data, and NEW parameters.
 * IMPORTANT: This function modifies the activeTagsInput object it receives.
 * @param {object} activeTagsInput - A deep copy of the user-provided active tags ({CategoryKey: [Tag1, ...]}).
 * @param {object} compatibilityData - The full compatibility dataset (read-only).
 * @param {object} params - Generation parameters (num_genres_target, min_score, num_themes_target, etc.).
 * @returns {object | null} The generated idea object, or null if generation fails at any critical step.
 */
export function generateMovieIdea(activeTagsInput, compatibilityData, params) { // Exporting this function too
    console.log("Starting core idea generation with params:", params);
    const activeTags = activeTagsInput;

    const requiredParams = ['min_score', 'num_genres_target', 'num_themes_target', 'num_finales_target', 'num_support_target', 'add_antagonist'];
    for (const p of requiredParams) {
        if (params[p] === undefined) {
            console.error(`Missing required parameter: ${p}`);
            return null;
        }
    }

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
        AllTags: [],
        Warnings: []
    };

    const selectedTags = [];
    const fallbackScore = Math.max(0.0, params.min_score - 1.0);
    console.log(`Using Min Score: ${params.min_score}, Fallback Score: ${fallbackScore}`);

    try {
        console.log(`Step 1: Selecting ${params.num_genres_target} Genres`);
        if (!activeTags.GENRES || activeTags.GENRES.length === 0) {
            throw new Error("No active genres available for selection.");
        }
        if (params.num_genres_target < 1 || params.num_genres_target > 3) {
            throw new Error(`Invalid num_genres_target: ${params.num_genres_target}. Must be 1, 2, or 3.`);
        }

        const firstGenre = getRandomElement(activeTags.GENRES);
        if (!firstGenre) throw new Error("Failed to select the first genre.");
        idea.Genres.push(firstGenre);
        selectedTags.push(firstGenre);
        activeTags.GENRES = activeTags.GENRES.filter(g => g !== firstGenre);
        console.log(`Selected 1st Genre: ${firstGenre}`);

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
            activeTags.GENRES = activeTags.GENRES.filter(g => g !== secondGenre);
            console.log(`Selected 2nd Genre: ${secondGenre}`);
        }

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
            activeTags.GENRES = activeTags.GENRES.filter(g => g !== thirdGenre);
            console.log(`Selected 3rd Genre: ${thirdGenre}`);
        }

        const numGenres = idea.Genres.length;
        let finalWeights = [];
        switch (numGenres) {
            case 1: finalWeights = [1.0]; break;
            case 2: finalWeights = getRandomElement([[0.5, 0.5], [0.65, 0.35], [0.8, 0.2]]); break;
            case 3: finalWeights = getRandomElement([[0.4, 0.3, 0.3], [0.6, 0.2, 0.2]]); break;
            default:
                console.warn(`[Generator] Unexpected final number of genres (${numGenres}). Assigning equal weights.`);
                finalWeights = Array(numGenres).fill(1.0 / numGenres); break;
        }
        idea.GenreWeights = finalWeights;
        console.log(`Assigned Genre Weights: ${idea.GenreWeights.map(w => w.toFixed(2)).join(', ')}`);


        console.log("Step 2: Selecting Setting");
        if (!activeTags.SETTING || activeTags.SETTING.length === 0) throw new Error("No active settings available.");
        let compatibleSettings = findCompatibleTags(activeTags.SETTING, selectedTags, compatibilityData, params.min_score);
        if (compatibleSettings.length === 0) {
            console.log(`No compatible settings at min_score ${params.min_score}, trying fallback ${fallbackScore}...`);
            compatibleSettings = findCompatibleTags(activeTags.SETTING, selectedTags, compatibilityData, fallbackScore);
        }
        if (compatibleSettings.length === 0) throw new Error("Failed to find a compatible setting (even with fallback).");
        idea.Setting = getRandomElement(compatibleSettings);
        selectedTags.push(idea.Setting);
        console.log(`Selected Setting: ${idea.Setting}`);


        console.log("Step 3: Selecting Protagonist");
        if (!activeTags.PROTAGONIST || activeTags.PROTAGONIST.length === 0) throw new Error("No active protagonists available.");
        let compatibleProtagonists = findCompatibleTags(activeTags.PROTAGONIST, selectedTags, compatibilityData, params.min_score);
        if (compatibleProtagonists.length === 0) {
            console.log(`No compatible protagonists at min_score ${params.min_score}, trying fallback ${fallbackScore}...`);
            compatibleProtagonists = findCompatibleTags(activeTags.PROTAGONIST, selectedTags, compatibilityData, fallbackScore);
        }
        if (compatibleProtagonists.length === 0) throw new Error("Failed to find a compatible protagonist (even with fallback).");
        idea.Protagonist = getRandomElement(compatibleProtagonists);
        selectedTags.push(idea.Protagonist);
        activeTags.PROTAGONIST = activeTags.PROTAGONIST.filter(t => t !== idea.Protagonist);
        console.log(`Selected Protagonist: ${idea.Protagonist}`);


        console.log(`Step 4: Selecting ${params.num_themes_target} Themes/Events`);
        if (params.num_themes_target < 1 || params.num_themes_target > 3) throw new Error(`Invalid num_themes_target: ${params.num_themes_target}. Must be 1, 2, or 3.`);
        let availableThemesEvents = getAvailableThemesEvents(activeTags).filter(tag => !selectedTags.includes(tag));
        if (availableThemesEvents.length === 0 && params.num_themes_target > 0) throw new Error("No active Theme/Event tags available for mandatory selection.");
        let themesAddedCount = 0;
        for (let i = 0; i < params.num_themes_target; i++) {
            if (availableThemesEvents.length === 0) {
                const message = `Could not add Theme/Event #${i + 1} (target: ${params.num_themes_target}): No tags remaining.`;
                if (i === 0) throw new Error(message);
                idea.Warnings.push(message); console.warn(message); break;
            }
            let compatibleThemesEvents;
            const isFirst = (i === 0);
            const scoreToUse = params.min_score;
            compatibleThemesEvents = findCompatibleTags(availableThemesEvents, selectedTags, compatibilityData, scoreToUse);
            if (compatibleThemesEvents.length === 0 && isFirst) {
                console.log(`No compatible 1st Theme/Event at min_score ${scoreToUse}, trying fallback ${fallbackScore}...`);
                compatibleThemesEvents = findCompatibleTags(availableThemesEvents, selectedTags, compatibilityData, fallbackScore);
                if (compatibleThemesEvents.length === 0) throw new Error("Failed to find a compatible first Theme/Event (even with fallback).");
            } else if (compatibleThemesEvents.length === 0 && !isFirst) {
                const message = `Could not add Theme/Event #${i + 1} (target: ${params.num_themes_target}): No compatible tags found at min_score ${scoreToUse}.`;
                idea.Warnings.push(message); console.log(message); break;
            }
            if (compatibleThemesEvents.length === 0) {
                throw new Error("Failed to find a compatible first Theme/Event.");
            }
            const chosenThemeEvent = getRandomElement(compatibleThemesEvents);
            idea.ThemesEvents.push(chosenThemeEvent);
            selectedTags.push(chosenThemeEvent);
            themesAddedCount++;
            availableThemesEvents = availableThemesEvents.filter(t => t !== chosenThemeEvent);
            ["THEME", "EVENT", "THEME_and_EVENTS"].forEach(category => {
                if (activeTags[category]) activeTags[category] = activeTags[category].filter(t => t !== chosenThemeEvent);
            });
            console.log(`Selected Theme/Event #${themesAddedCount}: ${chosenThemeEvent}`);
        }


        console.log(`Step 5: Selecting ${params.num_finales_target} Finales`);
        if (params.num_finales_target < 1 || params.num_finales_target > 2) throw new Error(`Invalid num_finales_target: ${params.num_finales_target}. Must be 1 or 2.`);
        let availableFinales = (activeTags.FINALE || []).filter(tag => !selectedTags.includes(tag));
        if (availableFinales.length === 0 && params.num_finales_target > 0) throw new Error("No active Finale tags available for mandatory selection.");
        let finalesAddedCount = 0;
        for (let i = 0; i < params.num_finales_target; i++) {
            if (availableFinales.length === 0) {
                const message = `Could not add Finale #${i + 1} (target: ${params.num_finales_target}): No tags remaining.`;
                if (i === 0) throw new Error(message);
                idea.Warnings.push(message); console.warn(message); break;
            }
            let compatibleFinales;
            const isFirst = (i === 0);
            const scoreToUse = params.min_score;
            compatibleFinales = findCompatibleTags(availableFinales, selectedTags, compatibilityData, scoreToUse);
            if (compatibleFinales.length === 0 && isFirst) {
                console.log(`No compatible 1st Finale at min_score ${scoreToUse}, trying fallback ${fallbackScore}...`);
                compatibleFinales = findCompatibleTags(availableFinales, selectedTags, compatibilityData, fallbackScore);
                if (compatibleFinales.length === 0) throw new Error("Failed to find a compatible first Finale (even with fallback).");
            } else if (compatibleFinales.length === 0 && !isFirst) {
                const message = `Could not add Finale #${i + 1} (target: ${params.num_finales_target}): No compatible tags found at min_score ${scoreToUse}.`;
                idea.Warnings.push(message); console.log(message); break;
            }
            if (compatibleFinales.length === 0) {
                throw new Error("Failed to find a compatible first Finale.");
            }
            const chosenFinale = getRandomElement(compatibleFinales);
            idea.Finales.push(chosenFinale);
            selectedTags.push(chosenFinale);
            finalesAddedCount++;
            availableFinales = availableFinales.filter(t => t !== chosenFinale);
            activeTags.FINALE = (activeTags.FINALE || []).filter(t => t !== chosenFinale);
            console.log(`Selected Finale #${finalesAddedCount}: ${chosenFinale}`);
        }


        console.log(`Step 6: Selecting Antagonist (Attempt: ${params.add_antagonist})`);
        if (params.add_antagonist) {
            let availableAntagonists = (activeTags.ANTAGONIST || []).filter(tag => !selectedTags.includes(tag));
            if (availableAntagonists.length > 0) {
                const compatibleAntagonists = findCompatibleTags(availableAntagonists, selectedTags, compatibilityData, params.min_score);
                if (compatibleAntagonists.length > 0) {
                    idea.Antagonist = getRandomElement(compatibleAntagonists);
                    selectedTags.push(idea.Antagonist);
                    activeTags.ANTAGONIST = activeTags.ANTAGONIST.filter(t => t !== idea.Antagonist);
                    console.log(`Selected Antagonist: ${idea.Antagonist}`);
                } else {
                    idea.Warnings.push("Attempted to add antagonist, but none were compatible at min_score.");
                    console.log("Could not find a compatible Antagonist (min_score only).");
                }
            } else {
                idea.Warnings.push("Attempted to add antagonist, but no tags were available.");
                console.log("Attempted to add antagonist, but no tags were available in the active list.");
            }
        } else {
            console.log("Skipping Antagonist selection based on parameter.");
        }


        console.log(`Step 7: Selecting ${params.num_support_target} Supporting Characters`);
        if (params.num_support_target < 0) {
            console.warn(`Invalid num_support_target: ${params.num_support_target}. Using 0.`);
            params.num_support_target = 0;
        }

        let availableSupport = (activeTags.SUPPORTINGCHARACTER || []).filter(tag => !selectedTags.includes(tag));
        let supportAddedCount = 0;
        for (let i = 0; i < params.num_support_target; i++) {
            if (availableSupport.length === 0) {
                idea.Warnings.push(`Could not add Supporting Character #${i + 1} (target: ${params.num_support_target}): No tags remaining.`);
                console.warn(`Could not add Supporting Character #${i + 1}: No tags remaining.`);
                break;
            }
            const compatibleSupport = findCompatibleTags(availableSupport, selectedTags, compatibilityData, params.min_score);
            if (compatibleSupport.length > 0) {
                const chosenSupport = getRandomElement(compatibleSupport);
                idea.SupportingChars.push(chosenSupport);
                selectedTags.push(chosenSupport);
                supportAddedCount++;
                availableSupport = availableSupport.filter(t => t !== chosenSupport);
                activeTags.SUPPORTINGCHARACTER = (activeTags.SUPPORTINGCHARACTER || []).filter(t => t !== chosenSupport);
                console.log(`Selected Supporting Character #${supportAddedCount}: ${chosenSupport}`);
            } else {
                idea.Warnings.push(`Could not add Supporting Character #${i + 1} (target: ${params.num_support_target}): No compatible tags found at min_score.`);
                console.log(`Could not find compatible Supporting Character #${i + 1} (min_score only). Stopping selection.`);
                break;
            }
        }


        console.log("Step 8: Calculating Final Weighted Compatibility Score");
        let totalScore = 0;
        const genreWeightMap = new Map();
        idea.Genres.forEach((genre, index) => {
            if (index < idea.GenreWeights.length) {
                genreWeightMap.set(genre, idea.GenreWeights[index]);
            } else {
                console.warn(`[Score Calc] Mismatch: Genres(${idea.Genres.length}) vs Weights(${idea.GenreWeights.length}) for ${genre}`);
                genreWeightMap.set(genre, 1.0);
            }
        });
        if(idea.Genres.length > 0) console.log("Genre Weights for score calc:", Array.from(genreWeightMap.entries()).map(([g, w]) => `${g}: ${w.toFixed(2)}`).join(', '));

        for (let i = 0; i < selectedTags.length; i++) {
            for (let j = i + 1; j < selectedTags.length; j++) {
                const tagA = selectedTags[i];
                const tagB = selectedTags[j];
                const scoreForward = getCompatibilityScore(tagA, tagB, compatibilityData);
                const scoreReverse = getCompatibilityScore(tagB, tagA, compatibilityData);
                const weightA = genreWeightMap.get(tagA) ?? 1.0;
                const weightB = genreWeightMap.get(tagB) ?? 1.0;
                const weightedPairScore = (scoreForward * weightA) + (scoreReverse * weightB);
                totalScore += weightedPairScore;
            }
        }
        idea.TotalScore = Math.round(totalScore * 10) / 10;
        console.log(`Calculated Final Weighted Total Score: ${idea.TotalScore}`);


        idea.AllTags = [...selectedTags];
        console.log("Core idea generation successful.");
        return idea;

    } catch (error) {
        console.error("Core idea generation failed critically:", error.message);
        return null;
    }
}
