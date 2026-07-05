// devserver runs the thin server's loopback static host on a desktop (no tsnet,
// no Android) so you can validate the embedded web build, COOP/COEP, cross-origin
// isolation, SAB and WebGPU in a normal browser:
//
//	go run ./cmd/devserver   # then open the printed http://127.0.0.1:PORT/chess/
//
// PORT pins the listen port (default: ephemeral) — used by the e2e android
// target (apps/e2e/target.ts), which needs a predictable baseURL.
package main

import (
	"fmt"
	"os"
	"strconv"

	"ca.proveo.chess/thinserver"
)

func main() {
	dir, err := os.MkdirTemp("", "chesscoach-dev")
	if err != nil {
		panic(err)
	}
	port := 0
	if p := os.Getenv("PORT"); p != "" {
		if port, err = strconv.Atoi(p); err != nil {
			panic(fmt.Sprintf("invalid PORT %q: %v", p, err))
		}
	}
	s := thinserver.NewServer(dir, nil)
	if err := s.StartOn(port); err != nil {
		panic(err)
	}
	fmt.Println("Dev server (static only, no tailnet):", s.LocalURL())
	fmt.Println("Open it in Chrome; check `crossOriginIsolated === true` in the console.")
	select {} // block forever
}
