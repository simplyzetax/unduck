import { bangs as fallbackBangs } from "./util/bang";
import "./global.css";

// Types for bangs
interface Bang {
  c?: string;  // category (optional)
  d: string;   // domain
  r: number;   // rank
  s: string;   // site name
  sc?: string; // subcategory (optional)
  t: string;   // trigger
  u: string;   // url template
}

// Cache configuration
const CACHE_KEY = 'unduck-bangs';
const CACHE_VERSION_KEY = 'unduck-bangs-version';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

let bangs: Bang[] = fallbackBangs;

// Function to load bangs from cache or server
async function loadBangs(): Promise<Bang[]> {
  try {
    // Check cache first
    const cachedBangs = localStorage.getItem(CACHE_KEY);
    const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY);

    if (cachedBangs && cachedVersion) {
      const versionData = JSON.parse(cachedVersion);
      const age = Date.now() - versionData.timestamp;

      // If cache is still fresh, use it
      if (age < CACHE_DURATION) {
        return JSON.parse(cachedBangs);
      }
    }

    // Cache is stale or missing, fetch fresh data
    console.log('Fetching fresh bangs from server...');
    const response = await fetch('/bangs.js');

    if (!response.ok) {
      throw new Error(`Failed to fetch bangs: ${response.status}`);
    }

    const bangsScript = await response.text();

    // Parse the bangs from the JavaScript response
    // DuckDuckGo's bang.js sets window.ddg_spice_bang
    const extractedBangs = extractBangsFromScript(bangsScript);

    if (extractedBangs && extractedBangs.length > 0) {
      // Store in cache
      const versionData = {
        timestamp: Date.now(),
        hash: response.headers.get('X-Bangs-Hash') || '',
        version: response.headers.get('X-Bangs-Version') || ''
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(extractedBangs));
      localStorage.setItem(CACHE_VERSION_KEY, JSON.stringify(versionData));

      console.log('Bangs updated and cached successfully');
      return extractedBangs;
    } else {
      throw new Error('Failed to extract bangs from response');
    }

  } catch (error) {
    console.warn('Failed to load fresh bangs, using cached or fallback data:', error);

    // Try to use cached data even if stale
    const cachedBangs = localStorage.getItem(CACHE_KEY);
    if (cachedBangs) {
      try {
        return JSON.parse(cachedBangs);
      } catch (e) {
        console.warn('Cached bangs data is corrupted, using fallback');
      }
    }

    // Fall back to embedded bangs
    return fallbackBangs;
  }
}

// Extract bangs array from DuckDuckGo's bang.js script
function extractBangsFromScript(script: string): Bang[] | null {
  try {
    // Create a sandbox to safely execute the script
    const sandbox = {
      ddg_spice_bang: null as any
    };

    // Execute the script in our controlled environment
    const wrappedScript = `
      (function() {
        var window = arguments[0];
        ${script}
        return window.ddg_spice_bang;
      })
    `;

    const func = new Function('return ' + wrappedScript)();
    const result = func(sandbox);

    if (result && Array.isArray(result)) {
      return result;
    }

    return null;
  } catch (error) {
    console.error('Failed to extract bangs from script:', error);
    return null;
  }
}

function noSearchDefaultPageRender() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;">
      <div class="content-container">
        <h1>Und*ck</h1>
        <p>DuckDuckGo's bang redirects are too slow. Add the following URL as a custom search engine to your browser. Enables <a href="https://duckduckgo.com/bang.html" target="_blank">all of DuckDuckGo's bangs.</a></p>
        <div class="url-container"> 
          <input 
            type="text" 
            class="url-input"
            value="https://bangs.fortnite.ac?q=%s"
            readonly 
          />
          <button class="copy-button">
            <img src="/clipboard.svg" alt="Copy" />
          </button>
        </div>
      </div>
        <footer class="footer">
          <a href="https://fortnite.ac" target="_blank">fortnite.ac</a>
          •
          <a href="https://github.com/simplyzetax/unduck" target="_blank">github</a>
        </footer>
    </div>
  `;

  const copyButton = app.querySelector<HTMLButtonElement>(".copy-button")!;
  const copyIcon = copyButton.querySelector("img")!;
  const urlInput = app.querySelector<HTMLInputElement>(".url-input")!;

  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(urlInput.value);
    copyIcon.src = "/clipboard-check.svg";

    setTimeout(() => {
      copyIcon.src = "/clipboard.svg";
    }, 2000);
  });
}

// Initialize bangs loading
let bangsPromise: Promise<Bang[]> | null = null;
let bangsLoaded = false;

async function initializeBangs(): Promise<void> {
  if (!bangsPromise) {
    bangsPromise = loadBangs();
  }

  try {
    bangs = await bangsPromise;
    bangsLoaded = true;
  } catch (error) {
    console.error('Failed to initialize bangs:', error);
    bangs = fallbackBangs;
    bangsLoaded = true;
  }
}

// Background refresh function
async function refreshBangsInBackground(): Promise<void> {
  try {
    const freshBangs = await loadBangs();
    bangs = freshBangs;
    console.log('Bangs refreshed in background');
  } catch (error) {
    console.warn('Background bang refresh failed:', error);
  }
}

const LS_DEFAULT_BANG = localStorage.getItem("default-bang") ?? "g";

async function getBangredirectUrl(): Promise<string | null> {
  // Ensure bangs are loaded
  if (!bangsLoaded) {
    await initializeBangs();
  }

  const url = new URL(window.location.href);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    noSearchDefaultPageRender();
    return null;
  }

  const match = query.match(/!(\S+)/i);

  const bangCandidate = match?.[1]?.toLowerCase();
  const selectedBang = bangs.find((b) => b.t === bangCandidate) ?? bangs.find((b) => b.t === LS_DEFAULT_BANG);

  // Remove the first bang from the query
  const cleanQuery = query.replace(/!\S+\s*/i, "").trim();

  // If the query is just `!gh`, use `github.com` instead of `github.com/search?q=`
  if (cleanQuery === "")
    return selectedBang ? `https://${selectedBang.d}` : null;

  // Format of the url is:
  // https://www.google.com/search?q={{{s}}}
  const searchUrl = selectedBang?.u.replace(
    "{{{s}}}",
    // Replace %2F with / to fix formats like "!ghr+t3dotgg/unduck"
    encodeURIComponent(cleanQuery).replace(/%2F/g, "/"),
  );
  if (!searchUrl) return null;

  return searchUrl;
}

async function doRedirect(): Promise<void> {
  const searchUrl = await getBangredirectUrl();
  if (!searchUrl) return;
  window.location.replace(searchUrl);
}

// Initialize and start the application
async function main(): Promise<void> {
  // Start background initialization
  initializeBangs().then(() => {
    // After initial load, trigger redirect if needed
    const url = new URL(window.location.href);
    const query = url.searchParams.get("q")?.trim();
    if (query) {
      doRedirect();
    }
  });

  // Start background refresh (check every hour for updates)
  setInterval(() => {
    refreshBangsInBackground();
  }, 60 * 60 * 1000); // 1 hour
}

// Start the application
main();
