/**
 * Cloudflare Worker for the StarChess PWA at /starchess/.
 * No COOP/COEP (no SharedArrayBuffer). No per-request debug logging.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Canonicalize /starchess → /starchess/ while preserving query.
    // (URL fragments never reach the server.)
    if (url.pathname === "/starchess") {
      const dest = new URL(url.href);
      dest.pathname = "/starchess/";
      return Response.redirect(dest.toString(), 308);
    }

    let response = await env.ASSETS.fetch(request);
    let servedIndexFallback = false;

    const isNavigation =
      request.method === "GET" &&
      request.headers.get("Sec-Fetch-Mode") === "navigate";

    // SPA fallback only for navigations. Extensioned asset misses stay 404.
    if (response.status === 404) {
      const hasExtension = /\.\w+$/.test(url.pathname);
      if (isNavigation && !hasExtension) {
        response = await env.ASSETS.fetch(
          new Request(new URL("/starchess/index.html", url.origin), request),
        );
        servedIndexFallback = true;
      }
    }

    const out = new Response(response.body, response);

    const isBootstrap =
      servedIndexFallback ||
      url.pathname.endsWith("/sw.js") ||
      url.pathname.endsWith("/registerSW.js") ||
      url.pathname.endsWith("/manifest.webmanifest") ||
      url.pathname.endsWith("/index.html") ||
      url.pathname === "/starchess" ||
      url.pathname === "/starchess/";
    if (isBootstrap) {
      out.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    }

    return out;
  },
};
