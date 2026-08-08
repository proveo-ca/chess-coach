/**
 * Compatibility redirect: /chess/starchess → /starchess/ (preserve search + hash).
 * // SPEC: _spec/apps/starchess/deployment.puml
 */
import { onMount, type Component } from "solid-js";

export const StarChessRedirect: Component = () => {
  onMount(() => {
    const { search, hash } = window.location;
    try {
      sessionStorage.setItem("starchess_from_chess", "1");
    } catch {
      /* ignore */
    }
    window.location.replace(`/starchess/${search}${hash}`);
  });
  return (
    <p style={{ margin: "2rem", "text-align": "center" }}>
      Opening StarChess…
    </p>
  );
};
