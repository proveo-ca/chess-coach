//go:build tools

package thinserver

// Keeps golang.org/x/mobile in the module graph across `go mod tidy`:
// `gomobile bind` generates code that imports x/mobile/bind, but nothing in
// the real build does, so tidy would otherwise drop the requirement.
import _ "golang.org/x/mobile/bind"
