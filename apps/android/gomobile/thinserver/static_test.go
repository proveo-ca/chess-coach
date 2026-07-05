package thinserver

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"
)

// Serve the handler tree exactly as staticHandler mounts it, but over an
// in-memory webroot so the test doesn't depend on a synced UI build.
func testHandler() http.Handler {
	sub := fstest.MapFS{
		"index.html":  &fstest.MapFile{Data: []byte("<html>app</html>")},
		"assets/a.js": &fstest.MapFile{Data: []byte("console.log(1)")},
	}
	fileServer := http.FileServer(http.FS(sub))
	return http.StripPrefix("/chess/", coopCoep(spaFallback(sub, fileServer)))
}

// SPA routes — including NESTED ones like /chess/review/<id> — must serve
// index.html directly (200), never redirect. The previous implementation
// rewrote to /index.html and let http.FileServer serve it, which 301s
// "/index.html" → "./" and redirect-loops on nested routes.
func TestSPAFallback(t *testing.T) {
	h := testHandler()
	for _, path := range []string{
		"/chess/",
		"/chess/review",
		"/chess/review/test-review-fixture-0001", // nested: the redirect-loop case
		"/chess/lan/host/deep/er",
	} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Errorf("%s → %d (want 200, no redirect)", path, rec.Code)
			continue
		}
		body, _ := io.ReadAll(rec.Body)
		if string(body) != "<html>app</html>" {
			t.Errorf("%s → body %q, want index.html content", path, body)
		}
		if got := rec.Header().Get("Cross-Origin-Embedder-Policy"); got != "require-corp" {
			t.Errorf("%s → COEP %q, want require-corp", path, got)
		}
	}
}

// Real assets are served as themselves, not swallowed by the SPA fallback.
func TestStaticAssetServed(t *testing.T) {
	h := testHandler()
	req := httptest.NewRequest(http.MethodGet, "/chess/assets/a.js", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("asset → %d, want 200", rec.Code)
	}
	body, _ := io.ReadAll(rec.Body)
	if string(body) != "console.log(1)" {
		t.Errorf("asset body %q", body)
	}
	if got := rec.Header().Get("Content-Type"); got != "text/javascript; charset=utf-8" {
		t.Errorf("asset Content-Type %q", got)
	}
}
