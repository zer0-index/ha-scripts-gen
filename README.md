# Movie Idea Generator

## Disclaimer

This project is a community-created tool from fans for fans of "Hollywood Animal."
It does not contain, depend on, or interact with the game's codebase or assets.

If you are the rights holder of "Hollywood Animal" and wish for this project to be removed or modified,
please open an issue or contact the maintainers directly. We will comply with your request.

## Description

A single-page web application built with Vue.js 3 and Vite that generates movie plot ideas based on user-provided tags and configurable parameters.

## Features

* **Tag-Based Generation:** Generates ideas using tags loaded from external JSON files.
* **User Tag Input:** Loads "active" tags (genres, settings, characters, etc.) from a user-provided `active_tags.json` file.
* **Compatibility Engine:** Uses pre-defined compatibility scores between tags (from `video-tags.json`) to guide the selection process.
* **Configurable Parameters:** Allows users to adjust generation logic via UI controls:
    * **Target Number of Genres:** 1-3 (selecting 3 is "limited" and may increase generation failure chance due to stricter compatibility).
    * **Minimum Compatibility Score:** 2.0-5.0 (setting 5.0 is "limited", requiring very high compatibility).
    * **Target Themes/Events:** 1-3 (at least 1 is mandatory).
    * **Target Finales:** 1-2 (at least 1 is mandatory).
    * **Target Supporting Characters:** 0-2.
    * **Attempt Antagonist:** Toggle whether to try adding an antagonist.
* **Dynamic Plot Tag Count:** Displays the potential total number of plot-related tags based on current settings.
* **Multiple Idea Generation:** Generates several distinct ideas per run.
* **Clear Results:** Displays generated ideas in formatted cards.

## Tech Stack

* **Framework:** [Vue.js 3](https://vuejs.org/) (Composition API)
* **Build Tool:** [Vite](https://vitejs.dev/)
* **Language:** JavaScript
* **Styling:** CSS

## Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (includes npm) installed (required for development, building, and running the provided start scripts).

### Installation

1.  Clone the repository (optional):
    ```bash
    git clone https://github.com/zer0-index/ha-scripts-gen.git
    cd ha-scripts-gen
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

### Running the Development Server

This is useful for making changes to the code.

```bash
npm run dev
```

This will start a local development server (usually at `http://localhost:5173`) with hot module replacement.

### Building for Local Use

This creates an optimized static build of the application in the `dist` folder.

```bash
npm run build
```

### Running the Built Application Locally

The built application (inside the `dist` folder) is designed to be run using a simple local HTTP server due to browser security restrictions with `file:///` URLs and JavaScript modules.

**Using the Provided Start Scripts (Recommended):**

1.  After running `npm run build`, the necessary start scripts (`start_windows.bat`, `start_unix.sh`) will be inside the `dist` folder (as they were placed in `public/`).
2.  Navigate **inside** the `dist` folder.
3.  **Windows:** Double-click `start_windows.bat`.
4.  **Linux/macOS:** You might need to make the script executable first. Open a terminal **inside the `dist` folder** and run `chmod +x start_unix.sh`. Then, run it with `./start_unix.sh` or by double-clicking.
5.  The script will start a local server using `npx serve@latest -o` and attempt to open the application automatically in your default browser (usually at `http://localhost:3000`). Press `Ctrl+C` in the terminal window to stop the server.

**Alternatively (Manual Server Start):**

If you prefer, you can manually start a server from within the `dist` directory using `npx serve` or Python's built-in server:

* Using `npx`: `cd dist && npx serve@latest` (using `@latest` is recommended)
* Using Python 3: `cd dist && python -m http.server`

Then manually open `http://localhost:3000` (for serve) or `http://localhost:8000` (for Python) in your browser.

### Input Files

* **`public/video-tags.json`:** Contains the tag compatibility scores. (Included in build)
* **`public/tags-list.json`:** Contains lists of tags grouped by category. (Included in build)
* **`active_tags.json` (User Provided):** This file must be provided by the user at runtime via the "Upload" button in the application. It should contain arrays of tags (strings) for the categories the user wants to use in generation (e.g., `GENRES`, `SETTING`, `PROTAGONIST`, `ANTAGONIST`, `SUPPORTINGCHARACTER`, `FINALE`, `THEME`, `EVENT`). Example structure:
    ```json
    {
      "GENRES": ["ACTION", "COMEDY", "SCI_FI"],
      "SETTING": ["SPACE_STATION", "DYSTOPIAN_CITY"],
      "PROTAGONIST": ["PROTAGONIST_ROGUE_AI", "PROTAGONIST_CYBORG"],
      "THEME": ["MAN_VS_MACHINE", "IDENTITY"],
      "EVENT": ["CHASE", "ESCAPE"]
    }
    ```

## Configuration

Adjust the generation parameters using the sliders and checkbox in the UI to influence the generated ideas:

* **Target Number of Genres:** Controls how many genres (1, 2, or 3) the generator aims for.
* **Min Compatibility Score:** Sets the threshold for considering tags compatible. Higher values lead to more thematically consistent but potentially fewer results. 5.0 is very strict.
* **Target Themes/Events:** Controls how many theme/event tags (1 to 3) are included.
* **Target Finales:** Controls how many finale tags (1 or 2) are included.
* **Target Supporting Chars:** Controls how many supporting character tags (0 to 2) are included.
* **Attempt to Add Antagonist:** If checked, the generator will try to find and include a compatible antagonist.

## Generator Logic Overview

The core generator (`src/services/generator.js`) works as follows:

1.  Selects the target number of **Genres** based on compatibility (using fallback scores if needed for 2nd/3rd).
2.  Selects a **Setting** compatible with the chosen Genres (using fallback).
3.  Selects a **Protagonist** compatible with Genres and Setting (using fallback).
4.  Selects the target number of **Themes/Events** (1st is mandatory with fallback, subsequent use min score only).
5.  Selects the target number of **Finales** (1st is mandatory with fallback, 2nd uses min score only).
6.  Optionally attempts to add an **Antagonist** (min score only).
7.  Attempts to add the target number of **Supporting Characters** (min score only), stopping if compatibility fails.
8.  Calculates a **Total Compatibility Score** based on the sum of scores between all pairs of selected tags (in both directions).

*Mandatory steps (Genre, Setting, Protagonist, Theme/Event 1, Finale 1) will cause generation failure if a compatible tag cannot be found.*
