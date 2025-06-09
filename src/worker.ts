import { Hono } from "hono/quick";

const app = new Hono<{ Bindings: Env }>();

const BANG_JS_URL = "https://duckduckgo.com/bang.js";
const CACHE_NAME = "bangs-cache";
const VERSION_KEY = "https://internal.cache/bangs-version";

// Helper function to generate hash for content
async function generateHash(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

app.get("/bangs.js", async () => {
    const cache = await caches.open(CACHE_NAME);

    // Try to get cached bangs
    const cachedAsset = await cache.match(BANG_JS_URL);
    const cachedVersion = await cache.match(VERSION_KEY);

    if (cachedAsset && cachedVersion) {
        const versionText = await cachedVersion.text();
        const version = JSON.parse(versionText);

        return new Response(cachedAsset.body, {
            headers: {
                "Content-Type": "application/javascript; charset=utf-8",
                "Cache-Control": "public, max-age=86400", // Cache for 24 hours
                "ETag": `"${version.hash}"`,
                "X-Bangs-Version": version.timestamp.toString(),
                "X-Bangs-Hash": version.hash
            },
        });
    }

    // If no cache, fetch fresh data
    const response = await fetch(BANG_JS_URL);
    if (!response.ok) {
        return new Response("Failed to fetch bangs.js", { status: response.status });
    }

    // Store in cache and return
    await cache.put(BANG_JS_URL, response.clone());

    // Create version info
    const text = await response.clone().text();
    const hash = await generateHash(text);
    const version = {
        timestamp: Date.now(),
        hash: hash
    };

    await cache.put(VERSION_KEY, new Response(JSON.stringify(version)));

    return new Response(response.body, {
        headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
            "ETag": `"${hash}"`,
            "X-Bangs-Version": version.timestamp.toString(),
            "X-Bangs-Hash": hash
        },
    });
})

app.get("*", async (c) => {
    const url = new URL(c.req.url);
    let pathname = url.pathname;
    
    // If requesting root, serve index.html
    if (pathname === "/" || pathname === "") {
        pathname = "/index.html";
    }
    
    const cache = await caches.open(CACHE_NAME);
    const requestToCache = new Request(url.origin + pathname);
    const cachedAsset = await cache.match(requestToCache);
    
    if (cachedAsset) {
        return new Response(cachedAsset.body, {
            headers: {
                "Content-Type": cachedAsset.headers.get("content-type") || "text/html",
            },
        });
    }
    
    const assetResponse = await c.env.ASSETS.fetch(requestToCache);
    return assetResponse;
});

export default {
    fetch: app.fetch,
    async scheduled(
        _controller: ScheduledController,
        _env: Env,
        _ctx: ExecutionContext,
    ) {
        console.log("Updating bangs cache at:", new Date().toISOString());

        const cache = await caches.open(CACHE_NAME);

        // Fetch fresh bangs from DuckDuckGo
        const response = await fetch(BANG_JS_URL);
        if (!response.ok) {
            console.error("Failed to fetch bang.js:", response.status, response.statusText);
            return;
        }

        const text = await response.text();
        const hash = await generateHash(text);
        const newVersion = {
            timestamp: Date.now(),
            hash: hash
        };

        // Check if content has actually changed
        const oldVersionResponse = await cache.match(VERSION_KEY);
        if (oldVersionResponse) {
            const oldVersion = JSON.parse(await oldVersionResponse.text());
            if (oldVersion.hash === hash) {
                console.log("Bangs content unchanged, updating timestamp only");
                const updatedVersion = {
                    ...oldVersion,
                    timestamp: Date.now()
                };
                await cache.put(VERSION_KEY, new Response(JSON.stringify(updatedVersion)));
                return;
            }
        }

        // Store the new bangs and version
        await cache.put(BANG_JS_URL, new Response(text, {
            headers: { "Content-Type": "application/javascript; charset=utf-8" }
        }));
        await cache.put(VERSION_KEY, new Response(JSON.stringify(newVersion)));

        console.log("Bangs cache updated. New hash:", hash);
    },
}