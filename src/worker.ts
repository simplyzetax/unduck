import { Hono } from "hono/quick";

const app = new Hono<{ Bindings: Env }>();
const BANGS_CACHE_URL = "https://internal.cache/bangs-data";

// Serve cached bangs or fetch fresh ones
app.get("/bangs.js", async () => {
    const cache = await caches.open("bangs");

    // Try to get cached bangs
    const cached = await cache.match(BANGS_CACHE_URL);
    if (cached) {
        console.log("Serving cached bangs");
        return new Response(cached.body, {
            headers: {
                "Content-Type": "application/javascript; charset=utf-8",
                "Cache-Control": "public, max-age=3600"
            }
        });
    }

    // Fetch fresh bangs if no cache
    const response = await fetch("https://duckduckgo.com/bang.js");
    if (response.ok) {
        await cache.put(BANGS_CACHE_URL, response.clone());
    }

    return new Response(response.body, {
        headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=3600"
        }
    });
});

// Serve static assets
app.get("*", async (c) => {
    return c.env.ASSETS.fetch(c.req.raw);
});

export default {
    fetch: app.fetch,

    // Update bangs cache daily
    async scheduled() {
        console.log("Updating bangs cache...");

        const cache = await caches.open("bangs");
        const response = await fetch("https://duckduckgo.com/bang.js");

        if (response.ok) {
            await cache.put(BANGS_CACHE_URL, response);
            console.log("Bangs cache updated successfully");
        } else {
            console.error("Failed to update bangs cache:", response.status);
        }
    }
};