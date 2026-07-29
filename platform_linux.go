//go:build linux

package main

import (
	"log"
	"os/exec"
	"time"

	"github.com/jezek/xgb"
	"github.com/jezek/xgb/xproto"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
)

// linuxPlatform implements platform for Linux builds without relying on
// the CGO-heavy robotgo/gohook libraries, which have been observed to cause
// undefined behavior and crashes.
type linuxPlatform struct {
	xConn *xgb.Conn
}

// Compile-time check that linuxPlatform implements platform.
var _ platform = (*linuxPlatform)(nil)

// newPlatform returns the Linux-specific platform implementation.
func newPlatform() platform {
	return &linuxPlatform{}
}

// referenceHeight returns the window height as the reference for graph
// coordinate translation on Linux.
func (p *linuxPlatform) referenceHeight(windowHeight int) int {
	return windowHeight
}

// startHotkeyListener grabs the V key on the root window and listens for its
// release. This avoids the CGO-dependent gohook library.
func (p *linuxPlatform) startHotkeyListener(app *App, stopChan <-chan struct{}) {
	X, err := xgb.NewConn()
	if err != nil {
		log.Printf("linux hotkey: X11 connection failed: %v", err)
		return
	}
	p.xConn = X
	defer func() {
		p.xConn = nil
		X.Close()
	}()

	setup := xproto.Setup(X)
	if setup == nil || len(setup.Roots) == 0 {
		log.Println("linux hotkey: X11 setup has no screens")
		return
	}
	root := setup.Roots[0].Root

	minKC := setup.MinKeycode
	maxKC := setup.MaxKeycode
	count := byte(maxKC - minKC + 1)

	mapping, err := xproto.GetKeyboardMapping(X, minKC, count).Reply()
	if err != nil {
		log.Printf("linux hotkey: keyboard mapping failed: %v", err)
		return
	}

	keycode := findLinuxKeycode(mapping, minKC, count, xproto.Keysym(0x76)) // 'v'
	if keycode == 0 {
		log.Println("linux hotkey: could not find keycode for 'v'")
		return
	}

	// Grab the V key on the root window with any modifier combination.
	if err := xproto.GrabKeyChecked(X, false, root, xproto.ModMaskAny, keycode,
		xproto.GrabModeAsync, xproto.GrabModeAsync).Check(); err != nil {
		log.Printf("linux hotkey: GrabKey failed: %v", err)
		return
	}

	defer func() {
		_ = xproto.UngrabKeyChecked(X, keycode, root, xproto.ModMaskAny).Check()
	}()

	eventChan := make(chan xgb.Event, 16)
	eventErr := make(chan error, 1)
	go func() {
		for {
			ev, err := X.WaitForEvent()
			if err != nil {
				eventErr <- err
				return
			}
			eventChan <- ev
		}
	}()

	for {
		select {
		case <-stopChan:
			return
		case <-eventErr:
			return
		case ev := <-eventChan:
			if keyEvent, ok := ev.(xproto.KeyReleaseEvent); ok {
				if keyEvent.Detail == keycode {
					go app.typeMonthlyValues()
				}
			}
		}
	}
}

// findLinuxKeycode searches the X keyboard mapping for the keycode that
// produces the requested keysym.
func findLinuxKeycode(mapping *xproto.GetKeyboardMappingReply, minKeycode xproto.Keycode, count byte, keysym xproto.Keysym) xproto.Keycode {
	if mapping.KeysymsPerKeycode == 0 {
		return 0
	}
	for i := byte(0); i < count; i++ {
		for j := 0; j < int(mapping.KeysymsPerKeycode); j++ {
			idx := int(i)*int(mapping.KeysymsPerKeycode) + j
			if mapping.Keysyms[idx] == keysym {
				return minKeycode + xproto.Keycode(i)
			}
		}
	}
	return 0
}

// typeValues types the provided values into the focused application using
// xdotool. It sends backspace+tab for zero values and tab between values.
func (p *linuxPlatform) typeValues(values []string) error {
	if err := linuxXdotoolCheck(); err != nil {
		log.Printf("linux paste: xdotool not found in PATH: %v", err)
		return err
	}

	// Give the hotkey's own keystroke a moment to reach the target window
	// before we try to clear it.
	time.Sleep(50 * time.Millisecond)

	keys := []string{"BackSpace"}

	for i, value := range values {
		if value == "0" {
			keys = append(keys, "BackSpace", "Tab")
		} else {
			for _, r := range value {
				if r >= '0' && r <= '9' {
					keys = append(keys, string(r))
				} else if r == '-' {
					keys = append(keys, "minus")
				}
			}
			if i < len(values)-1 {
				keys = append(keys, "Tab")
			}
		}
	}

	if len(keys) == 0 {
		return nil
	}

	cmd := exec.Command("xdotool", append([]string{"key"}, keys...)...)
	if err := cmd.Run(); err != nil {
		log.Printf("linux paste: xdotool failed: %v", err)
		return err
	}

	// Small pause after the paste so the target application can process the
	// keystrokes before the next operation (e.g., a new image import).
	time.Sleep(50 * time.Millisecond)
	return nil
}

// linuxXdotoolCheck returns an error if xdotool is not available in PATH.
func linuxXdotoolCheck() error {
	_, err := exec.LookPath("xdotool")
	if err != nil {
		return err
	}
	return nil
}

// configurePlatformOptions applies Linux-specific Wails options.
func configurePlatformOptions(opts *options.App) {
	opts.Linux = &linux.Options{
		WebviewGpuPolicy: linux.WebviewGpuPolicyAlways,
	}
}
