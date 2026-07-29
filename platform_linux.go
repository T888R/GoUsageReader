//go:build linux

package main

import (
	"time"

	"github.com/go-vgo/robotgo"
	hook "github.com/robotn/gohook"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
)

// linuxPlatform implements platform for Linux builds.
type linuxPlatform struct{}

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

// startHotkeyListener registers the global V key release and triggers the
// paste handler when it is pressed.
func (p *linuxPlatform) startHotkeyListener(app *App, stopChan <-chan struct{}) {
	hook.Register(hook.KeyUp, []string{"v"}, func(e hook.Event) {
		app.typeMonthlyValues()
	})
	s := hook.Start()

	go func() {
		<-hook.Process(s)
	}()

	<-stopChan
	hook.End()
}

// typeValues types the provided values into the focused application, sending
// backspace+tab for zero values and tab between values.
func (p *linuxPlatform) typeValues(values []string) error {
	robotgo.KeyTap("backspace")
	time.Sleep(10 * time.Millisecond)

	for i, value := range values {
		if value == "0" {
			robotgo.KeyTap("backspace")
			robotgo.KeyTap("tab")
		} else {
			robotgo.TypeStr(value)
			if i < len(values)-1 {
				robotgo.KeyTap("tab")
			}
		}
		time.Sleep(10 * time.Millisecond)
	}

	return nil
}

// configurePlatformOptions applies Linux-specific Wails options.
func configurePlatformOptions(opts *options.App) {
	opts.Linux = &linux.Options{
		WebviewGpuPolicy: linux.WebviewGpuPolicyAlways,
	}
}
