import { useEffect } from "react";

// Injects <meta name="robots" content="noindex,nofollow"> for as long as the
// calling page is mounted, then removes it on unmount. Payment screens carry
// amounts and one-time link ids in the URL and must never reach a search index.
// This is the client-side guard; the canonical block lives in robots.txt and the
// X-Robots-Tag header set per path in vercel.json. We keep all three because a
// crawler that ignores robots.txt still honors the meta tag, and the header
// covers responses that never execute JS.
export function useNoIndex(): void {
  useEffect(() => {
    const existing = document.querySelector<HTMLMetaElement>(
      'meta[name="robots"]',
    );
    const meta = existing ?? document.createElement("meta");
    const owned = !existing;

    meta.setAttribute("name", "robots");
    const previous = existing?.getAttribute("content") ?? null;
    meta.setAttribute("content", "noindex,nofollow");

    if (owned) {
      document.head.appendChild(meta);
    }

    return () => {
      if (owned) {
        meta.remove();
        return;
      }
      if (previous === null) {
        meta.removeAttribute("content");
      } else {
        meta.setAttribute("content", previous);
      }
    };
  }, []);
}
