import "./global.css";

interface Bang {
  d: string;   // domain
  t: string;   // trigger
  u: string;   // url template
}

let bangs: Bang[] = [];

async function loadBangs(): Promise<void> {
  try {
    const response = await fetch('/bangs.js');
    const script = await response.text();
    bangs = script.trim().startsWith('[') ? JSON.parse(script) : [];
  } catch {
    bangs = [{ d: "google.com", t: "g", u: "https://www.google.com/search?q={{{s}}}" }];
  }
}

function renderHomePage() {
  document.querySelector("#app")!.innerHTML = `
    <div class="flex flex-col items-center justify-center h-screen">
      <div class="content-container">
        <h1>D*cker</h1>
        <p>A rewritten version of Und*ck. Hosted on Cloudflare Workers to allow for daily bangs updates:</p>
        <div class="url-container"> 
          <input type="text" class="url-input" value="https://duck.codes?q=%s" readonly />
          <button class="copy-button"><img src="/assets/clipboard.svg" alt="Copy" /></button>
        </div>
      </div>
      <footer class="footer">
        <a href="https://omnisell.io">omnisell.io</a> • 
        <a href="https://github.com/simplyzetax/unduck">github</a>
      </footer>
    </div>
  `;

  document.querySelector(".copy-button")!.addEventListener("click", async () => {
    const input = document.querySelector(".url-input") as HTMLInputElement;
    const icon = document.querySelector(".copy-button img") as HTMLImageElement;
    await navigator.clipboard.writeText(input.value);
    icon.src = "/assets/clipboard-check.svg";
    setTimeout(() => icon.src = "/assets/clipboard.svg", 2000);
  });
}

async function main() {
  await loadBangs();

  const query = new URLSearchParams(location.search).get("q")?.trim();
  if (!query) return renderHomePage();

  const match = query.match(/!(\S+)/i);
  const bangTrigger = match?.[1]?.toLowerCase() || "g";
  const bang = bangs.find(b => b.t === bangTrigger) || bangs[0];

  if (!bang) return renderHomePage();

  const searchQuery = query.replace(/!\S+\s*/i, "").trim();
  const url = searchQuery
    ? bang.u.replace("{{{s}}}", encodeURIComponent(searchQuery).replace(/%2F/g, "/"))
    : `https://${bang.d}`;

  location.replace(url);
}

main();