// src/services/calculator.js

const ART_COMM_SCORE_SCALE_FACTOR = 5;
const ART_COMM_SCORE_MIN = 1;
export const ART_COMM_SCORE_MAX = 5;
const INTERESTED_AUDIENCE_THRESHOLD = 2.5;
export const INTERESTED_AUDIENCE_FALLBACK_COUNT = 2;
const ADVERTISER_MATCH_NO_OVERLAP_PENALTY = 0.5;
const ADVERTISER_MATCH_SCORE_THRESHOLD = 13.0;
export const ADVERTISER_MATCH_FALLBACK_COUNT = 3;

export function calculateAverageAudienceAppeal(selectedTags, audienceWeightsData, audienceGroupsData) {
    if (!selectedTags || !audienceWeightsData || !audienceGroupsData || Object.keys(audienceGroupsData).length === 0) {
        console.error("[Calculator Helper] Invalid input for calculateAverageAudienceAppeal.");
        return {};
    }
    const allAudienceIds = Object.keys(audienceGroupsData);
    if (selectedTags.length === 0) {
        const zeroScores = {};
        allAudienceIds.forEach(audienceId => { zeroScores[audienceId] = 0; });
        return zeroScores;
    }

    const audienceTotalScores = {};
    const audienceTagCounts = {};
    allAudienceIds.forEach(audienceId => {
        audienceTotalScores[audienceId] = 0;
        audienceTagCounts[audienceId] = 0;
    });

    selectedTags.forEach(tagId => {
        const tagWeights = audienceWeightsData[tagId]?.weights;
        if (tagWeights) {
            allAudienceIds.forEach(audienceId => {
                const scoreStr = tagWeights[audienceId];
                if (scoreStr !== undefined && scoreStr !== null && scoreStr !== '') {
                    const score = parseFloat(scoreStr);
                    if (!isNaN(score)) {
                        audienceTotalScores[audienceId] += score;
                        audienceTagCounts[audienceId] += 1;
                    }
                }
            });
        }
    });

    const averageScores = {};
    allAudienceIds.forEach(audienceId => {
        const totalScore = audienceTotalScores[audienceId];
        const tagCount = audienceTagCounts[audienceId];
        averageScores[audienceId] = (tagCount > 0) ? (totalScore / tagCount) : 0;
    });
    return averageScores;
}

function calculateArtisticCommercialScores(averageAudienceAppeal, audienceGroupsData) {
    if (!averageAudienceAppeal || !audienceGroupsData) return null;
    let artisticTotal = 0, commercialTotal = 0;
    Object.entries(averageAudienceAppeal).forEach(([audienceId, avgScore]) => {
        const groupData = audienceGroupsData[audienceId];
        if (groupData && avgScore > 0) {
            const artW = parseFloat(groupData.artWeight), commW = parseFloat(groupData.commercialWeight);
            if (!isNaN(artW)) artisticTotal += avgScore * artW;
            if (!isNaN(commW)) commercialTotal += avgScore * commW;
        }
    });
    let scaledArt = Math.max(ART_COMM_SCORE_MIN, Math.min(ART_COMM_SCORE_MAX, artisticTotal * ART_COMM_SCORE_SCALE_FACTOR));
    let scaledComm = Math.max(ART_COMM_SCORE_MIN, Math.min(ART_COMM_SCORE_MAX, commercialTotal * ART_COMM_SCORE_SCALE_FACTOR));
    return { artisticScore: Math.round(scaledArt*10)/10, commercialScore: Math.round(scaledComm*10)/10 };
}

export function calculateAdvertiserMatches(averageAudienceAppeal, advertisersData) {
    if (!averageAudienceAppeal || !advertisersData) {
        console.error("[Calculator Helper] Invalid input for calculateAdvertiserMatches.");
        return null;
    }

    let interestedAudiences = [];
    let usedAudienceFallback = false;

    const appealingAudiences = Object.entries(averageAudienceAppeal)
        .filter(([_, score]) => score >= INTERESTED_AUDIENCE_THRESHOLD)
        .map(([audienceId, _]) => audienceId);

    if (appealingAudiences.length > 0) {
        interestedAudiences = appealingAudiences;
    } else {
        usedAudienceFallback = true;
        const sortedAudiences = Object.entries(averageAudienceAppeal)
            .filter(([_, score]) => score > 0)
            .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);
        interestedAudiences = sortedAudiences
            .slice(0, INTERESTED_AUDIENCE_FALLBACK_COUNT)
            .map(([audienceId, _]) => audienceId);
    }

    if (interestedAudiences.length === 0) {
        return { interestedAudiences: [], topAdvertisers: [], usedAudienceFallback: usedAudienceFallback, usedAdvertiserFallback: false };
    }

    const evaluatedAdvertisers = [];
    const interestedAudienceSet = new Set(interestedAudiences);

    Object.values(advertisersData).forEach((adData) => {
        const quality = parseFloat(adData.quality) || 0;
        const targetAudiences = adData.targetAudience ?? {};
        const displayName = adData.displayName || adData.id || 'Unknown Advertiser';
        let scoreFromOverlap = 0;
        let hasOverlap = false;

        Object.entries(targetAudiences).forEach(([audienceId, importanceStr]) => {
            if (interestedAudienceSet.has(audienceId)) {
                const importance = parseFloat(importanceStr);
                if (!isNaN(importance) && importance > 0) {
                    hasOverlap = true;
                    const appeal = averageAudienceAppeal[audienceId] ?? 0;
                    scoreFromOverlap += importance * appeal;
                }
            }
        });

        let finalMatchScore = hasOverlap ? (quality + scoreFromOverlap) : (quality * ADVERTISER_MATCH_NO_OVERLAP_PENALTY);
        evaluatedAdvertisers.push({ name: displayName, score: finalMatchScore });
    });

    evaluatedAdvertisers.sort((a, b) => b.score - a.score);

    let topAdvertisers = [];
    let usedAdvertiserFallback = false;
    const goodMatchAdvertisers = evaluatedAdvertisers.filter(ad => ad.score >= ADVERTISER_MATCH_SCORE_THRESHOLD);

    if (goodMatchAdvertisers.length > 0) {
        topAdvertisers = goodMatchAdvertisers;
    } else {
        usedAdvertiserFallback = true;
        if (evaluatedAdvertisers.length > 0) {
            topAdvertisers = evaluatedAdvertisers.slice(0, ADVERTISER_MATCH_FALLBACK_COUNT);
        }
    }

    const finalAdvertiserList = topAdvertisers.map(ad => ({ name: ad.name, score: Math.round(ad.score * 10) / 10 }));

    return { interestedAudiences, topAdvertisers: finalAdvertiserList, usedAudienceFallback, usedAdvertiserFallback };
}

function validateSelectedTags(selectedTagsByCategory) {
    const errors = [];
    const getCount = (category) => selectedTagsByCategory[category]?.length ?? 0;
    const genreCount = getCount('GENRES');
    if (genreCount < 1 || genreCount > 3) errors.push("Select between 1 and 3 Genres.");
    if (getCount('SETTING') !== 1) errors.push("Exactly one Setting must be selected.");
    if (getCount('PROTAGONIST') !== 1) errors.push("Exactly one Protagonist must be selected.");
    if (getCount('ANTAGONIST') > 1) errors.push("At most one Antagonist can be selected.");
    if (getCount('FINALE') > 1) errors.push("At most one Finale can be selected.");
    const totalSelected = Object.values(selectedTagsByCategory || {}).flat().length;
    if (totalSelected === 0 && errors.length === 0) errors.push("No tags were selected for calculation.");
    return { isValid: errors.length === 0, errorMessages: errors };
}

export function runCalculations(selectedTagsByCategory, audienceWeightsData, audienceGroupsData, advertisersData) {
    if (!audienceWeightsData || !audienceGroupsData || !advertisersData || !selectedTagsByCategory) {
        return { validation: { isValid: false, errorMessages: ["Internal Error: Missing required calculation data."] }, results: null };
    }
    const validation = validateSelectedTags(selectedTagsByCategory);
    if (!validation.isValid) { return { validation, results: null }; }
    const allSelectedTags = Object.values(selectedTagsByCategory).flat();
    try {
        const averageAudienceAppeal = calculateAverageAudienceAppeal(allSelectedTags, audienceWeightsData, audienceGroupsData);
        if (Object.keys(averageAudienceAppeal).length === 0 && Object.keys(audienceGroupsData).length > 0) {
            throw new Error("Audience appeal calculation failed critically.");
        }
        const isAppealUniversallyZero = Object.values(averageAudienceAppeal).every(score => score === 0);
        if (isAppealUniversallyZero && allSelectedTags.length > 0) {
            return { validation, results: { artisticScore: ART_COMM_SCORE_MIN, commercialScore: ART_COMM_SCORE_MIN, interestedAudiences: [], topAdvertisers: [], usedAudienceFallback: false, usedAdvertiserFallback: false, error: "Selected tags have no measurable appeal." } };
        }
        const scores = calculateArtisticCommercialScores(averageAudienceAppeal, audienceGroupsData);
        if (!scores) throw new Error("Failed to calculate artistic/commercial scores.");
        const matches = calculateAdvertiserMatches(averageAudienceAppeal, advertisersData);
        if (!matches) throw new Error("Failed to calculate advertiser matches.");
        return { validation, results: { ...scores, ...matches, error: null } };
    } catch (error) {
        console.error("[Calculator] Error during runCalculations:", error);
        return { validation, results: { artisticScore: null, commercialScore: null, interestedAudiences: null, topAdvertisers: null, usedAudienceFallback: false, usedAdvertiserFallback: false, error: `Calculation failed: ${error.message}` } };
    }
}
