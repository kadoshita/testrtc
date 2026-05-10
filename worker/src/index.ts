import { SkyWayAuthToken } from "@skyway-sdk/token";

interface Env {
    SKYWAY_APP_ID: string;
    SKYWAY_SECRET_KEY: string;
    ALLOWED_ORIGINS?: string;
}

interface IceParams {
    turn: {
        domain: string;
        port: number;
        username: string;
        credential: string;
    };
    stun: {
        domain: string;
        port: number;
    };
}

const getCorsHeaders = (env: Env): Record<string, string> => {
    const origin = env.ALLOWED_ORIGINS ?? "*";
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };
};

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const corsHeaders = getCorsHeaders(env);

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }
        if (request.method !== "POST") {
            return new Response(
                JSON.stringify({ error: "Method Not Allowed. Use POST." }),
                {
                    status: 405,
                    headers: {
                        "Content-Type": "application/json",
                        ...corsHeaders,
                    },
                }
            );
        }

        const { SKYWAY_APP_ID: appId, SKYWAY_SECRET_KEY: secretKey } = env;

        if (!appId || !secretKey) {
            return new Response(
                JSON.stringify({ error: "appId or secretKey is empty." }),
                {
                    status: 500,
                    headers: {
                        "Content-Type": "application/json",
                        ...corsHeaders,
                    },
                }
            );
        }

        const token = new SkyWayAuthToken({
            jti: crypto.randomUUID(),
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 1, // 1 hour
            scope: {
                app: {
                    id: appId,
                    turn: true,
                    actions: ["read"],
                },
            },
        });
        const tokenString = token.encode(secretKey);

        const iceResponse = await fetch(
            "https://ice-params.skyway.ntt.com/v1/ice-params",
            {
                method: "POST",
                headers: {
                    authorization: `Bearer ${tokenString}`,
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    memberId: crypto.randomUUID(),
                    channelId: crypto.randomUUID(),
                    ttl: 120,
                }),
            }
        );

        const { turn, stun } = (await iceResponse.json()) as IceParams;
        const obj = {
            iceServers: [
                {
                    urls: [
                        `turn:${turn.domain}:${turn.port}?transport=tcp`,
                        `turn:${turn.domain}:${turn.port}?transport=udp`,
                        `turns:${turn.domain}:${turn.port}?transport=tcp`,
                    ],
                    credential: turn.credential,
                    username: turn.username,
                },
                {
                    urls: `stun:${stun.domain}:${stun.port}`,
                },
            ],
        };

        return new Response(JSON.stringify(obj), {
            headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
            },
        });
    },
};
