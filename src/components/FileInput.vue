<script setup>
import {ref, defineEmits} from 'vue';

const emit = defineEmits(['file-loaded', 'file-error']);
const selectedFileName = ref('No file selected');
const fileInput = ref(null);

function handleFileChange(event) {
  const file = event.target.files[0];
  if (!file) {
    selectedFileName.value = 'No file selected';
    emit('file-loaded', null);
    return;
  }

  if (file.type !== 'application/json') {
    selectedFileName.value = 'Error: Please select a .json file!';
    emit('file-error', 'Invalid file type. Please select a .json file.');
    if (fileInput.value) {
      fileInput.value.value = '';
    }
    return;
  }

  selectedFileName.value = file.name;
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      emit('file-loaded', data);
    } catch (error) {
      selectedFileName.value = 'Error parsing JSON!';
      console.error("JSON Parse Error:", error);
      emit('file-error', `Error parsing file ${file.name}: ${error.message}`);
      if (fileInput.value) {
        fileInput.value.value = '';
      }
    }
  };

  reader.onerror = (e) => {
    selectedFileName.value = 'Error reading file!';
    console.error("FileReader Error:", e);
    emit('file-error', `Could not read file ${file.name}.`);
    if (fileInput.value) {
      fileInput.value.value = '';
    }
  };

  reader.readAsText(file);
}
</script>

<template>
  <div class="file-input">
    <label for="active-tags-file">Upload `active-tags-list.json`:</label>
    <input
        ref="fileInput"
        type="file"
        id="active-tags-file"
        accept=".json"
        @change="handleFileChange"
    />
    <span class="file-status">{{ selectedFileName }}</span>
  </div>
</template>

<style scoped>
.file-input {
  display: flex;
  align-items: center;
  gap: 10px;
}

input[type="file"]::file-selector-button {
  padding: 5px 10px;
  border: 1px solid #555;
  border-radius: 4px;
  background-color: #555;
  color: #eee;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

input[type="file"]::file-selector-button:hover {
  background-color: #666;
}

.file-status {
  font-style: italic;
  font-size: 0.9em;
  color: #aaa;
}

label {
  color: #ccc;
}
</style>
