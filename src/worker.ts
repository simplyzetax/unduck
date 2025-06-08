export default {
    async fetch(request: Request, env: Env) {
        const url = new URL(request.url);
        const pathname = url.pathname;
        const asset = await env.ASSETS.fetch(new Request(url.origin + pathname));
        if (asset) {
            return new Response(asset.body, {
                headers: {
                    "Content-Type": asset.headers.get("content-type") || "text/plain",
                },
            });
        }
        return new Response("Not found", { status: 404 });
    }
}