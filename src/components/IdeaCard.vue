<script setup>
import { defineProps, computed } from 'vue';
import { INTERESTED_AUDIENCE_FALLBACK_COUNT, ADVERTISER_MATCH_FALLBACK_COUNT } from '../services/calculator.js';

const props = defineProps({
  idea: {
    type: Object,
    required: true,
  },
});

const formattedGenres = computed(() => {
  if (!props.idea.Genres || !props.idea.GenreWeights || props.idea.Genres.length !== props.idea.GenreWeights.length) {
    return props.idea.Genres?.join(', ') || 'N/A';
  }
  return props.idea.Genres.map((genre, index) => {
    const weight = props.idea.GenreWeights[index];
    const percentage = (typeof weight === 'number' && !isNaN(weight)) ? (weight * 100).toFixed(0) : '??';
    const cleanGenre = genre.replace(/^GENRES_/i, '');
    return `${cleanGenre} (${percentage}%)`;
  }).join(', ');
});

const formatTagList = (list, categoryPrefix = '') => {
  if (!list || list.length === 0) return 'None';
  const prefixToRemove = categoryPrefix ? categoryPrefix.toUpperCase() + '_' : '';
  return list.map(tag => {
    let formatted = tag;
    if (prefixToRemove && tag.toUpperCase().startsWith(prefixToRemove)) {
      formatted = tag.substring(prefixToRemove.length);
    }
    if (categoryPrefix === 'THEME_and_EVENTS') {
      if (tag.startsWith('THEME_')) formatted = tag.substring('THEME_'.length);
      else if (tag.startsWith('EVENT_')) formatted = tag.substring('EVENT_'.length);
      else if (tag.startsWith('EVENTS_')) formatted = tag.substring('EVENTS_'.length);
    }
    return formatted.replace(/_/g, ' ');
  }).join(', ');
};

const formattedAudiences = computed(() => {
  const list = props.idea.interestedAudiences;
  return (list && list.length > 0) ? list.join(', ') : 'N/A';
});

const formattedAdvertisers = computed(() => {
  const list = props.idea.topAdvertisers;
  if (!list || list.length === 0) return 'N/A';
  return list.map(ad => `${ad.name} (Score: ${ad.score})`).join('; ');
});

const hasWarnings = computed(() => props.idea.Warnings && props.idea.Warnings.length > 0);

</script>

<template>
  <div class="idea-card">
    <h4>Idea (Compatibility Score: {{ idea.TotalScore?.toFixed(1) ?? 'N/A' }})</h4>
    <dl class="idea-details">
      <dt>Genres:</dt>
      <dd>{{ formattedGenres }}</dd>
      <dt>Setting:</dt>
      <dd>{{ formatTagList(idea.Setting ? [idea.Setting] : [], 'SETTING') }}</dd>
      <dt>Protagonist:</dt>
      <dd>{{ formatTagList(idea.Protagonist ? [idea.Protagonist] : [], 'PROTAGONIST') }}</dd>
      <dt>Antagonist:</dt>
      <dd>{{ formatTagList(idea.Antagonist ? [idea.Antagonist] : [], 'ANTAGONIST') }}</dd>
      <dt>Supporting:</dt>
      <dd>{{ formatTagList(idea.SupportingChars, 'SUPPORTINGCHARACTER') }}</dd>
      <dt>Finales:</dt>
      <dd>{{ formatTagList(idea.Finales, 'FINALE') }}</dd>
      <dt>Themes/Events:</dt>
      <dd>{{ formatTagList(idea.ThemesEvents, 'THEME_and_EVENTS') }}</dd>

      <dt>Interested Audiences:</dt>
      <dd>
        {{ formattedAudiences }}
        <em v-if="idea.usedAudienceFallback && idea.interestedAudiences?.length > 0">(Fallback: Top {{ INTERESTED_AUDIENCE_FALLBACK_COUNT }})</em>
        <em v-if="idea.usedAudienceFallback && idea.interestedAudiences?.length === 0">(Fallback used, none found)</em>
        <em v-if="!idea.usedAudienceFallback && idea.interestedAudiences?.length === 0">(None met threshold)</em>
      </dd>
      <dt>Top Advertisers:</dt>
      <dd>
        {{ formattedAdvertisers }}
        <em v-if="idea.usedAdvertiserFallback && idea.topAdvertisers?.length > 0">(Fallback: Top {{ ADVERTISER_MATCH_FALLBACK_COUNT }})</em>
        <em v-if="idea.usedAdvertiserFallback && idea.topAdvertisers?.length === 0">(Fallback used, none found)</em>
        <em v-if="!idea.usedAdvertiserFallback && idea.topAdvertisers?.length === 0">(None met threshold)</em>
      </dd>
    </dl>

    <details v-if="hasWarnings" class="warnings-details">
      <summary>Warnings ({{ idea.Warnings.length }})</summary>
      <ul>
        <li v-for="(warning, index) in idea.Warnings" :key="index">{{ warning }}</li>
      </ul>
    </details>
  </div>
</template>

<style scoped>
.idea-card { border: 1px solid #555; border-radius: 6px; padding: 15px 20px; background-color: #383c4a; color: #e0e0e0; display: flex; flex-direction: column; gap: 10px; overflow-wrap: break-word; }
h4 { margin-top: 0; margin-bottom: 5px; border-bottom: 1px solid #666; padding-bottom: 8px; color: #FFFFFF; font-weight: 500; font-size: 1.1em; }
.idea-details { margin: 0; padding: 0; display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; font-size: 0.95em; }
.idea-details dt { font-weight: 600; color: #bdbdbd; grid-column: 1; white-space: nowrap; text-align: right; padding-right: 5px; }
.idea-details dd { margin: 0; grid-column: 2; color: #e0e0e0; }
.idea-details dd em { font-size: 0.9em; color: #ffc107; margin-left: 8px; }
.warnings-details { margin-top: 10px; background-color: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 4px; padding: 5px 0; }
.warnings-details summary { cursor: pointer; font-weight: bold; color: #ffc107; padding: 5px 10px; outline: none; user-select: none; }
.warnings-details summary::marker{ color: #ffc107; }
.warnings-details ul { list-style-type: disc; margin: 5px 0 10px 35px; padding-left: 0; font-size: 0.9em; color: #ffebbb; }
.warnings-details li { margin-bottom: 4px; }
</style>
