import { getAssetFromKV } from "@cloudflare/kv-asset-handler";
import manifestJSON from "__STATIC_CONTENT_MANIFEST";

const assetManifest = JSON.parse(manifestJSON);

interface Env {
    __STATIC_CONTENT: KVNamespace;
    API_WORKER: Fetcher;
}

export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext
    ): Promise<Response> {
        const { pathname } = new URL(request.url);
        if (pathname === "/api/turn" || pathname.startsWith("/api/")) {
            return env.API_WORKER.fetch(request);
        }

        try {
            return await getAssetFromKV(
                { request, waitUntil: ctx.waitUntil.bind(ctx) },
                {
                    ASSET_NAMESPACE: env.__STATIC_CONTENT,
                    ASSET_MANIFEST: assetManifest,
                }
            );
        } catch {
            return new Response("Not found", { status: 404 });
        }
    },
};
