//go:build windows

package main

import (
	"time"

	"github.com/go-vgo/robotgo"
	hook "github.com/robotn/gohook"
	"github.com/wailsapp/wails/v2/pkg/options"
)

// windowsPlatform implements platform for Windows builds.
type windowsPlatform struct {
	maxDisplayHeight int
}

// Compile-time check that windowsPlatform implements platform.
var _ platform = (*windowsPlatform)(nil)

// newPlatform returns the Windows-specific platform implementation, scanning
// connected displays for the largest vertical resolution.
func newPlatform() platform {
	maxHeight := 0
	num := robotgo.DisplaysNum()
	for i := 0; i < num; i++ {
		robotgo.DisplayID = i
		_, _, _, h := robotgo.GetDisplayBounds(i)
		if h > maxHeight {
			maxHeight = h
		}
	}
	return &windowsPlatform{maxDisplayHeight: maxHeight}
}

// referenceHeight returns the largest display height as the reference for
// graph coordinate translation on Windows.
func (p *windowsPlatform) referenceHeight(windowHeight int) int {
	if p.maxDisplayHeight > 0 {
		return p.maxDisplayHeight
	}
	return windowHeight
}

// startHotkeyListener registers the global V key release and triggers the
// paste handler when it is pressed.
func (p *windowsPlatform) startHotkeyListener(app *App, stopChan <-chan struct{}) {
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
func (p *windowsPlatform) typeValues(values []string) error {
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

// configurePlatformOptions applies Windows-specific Wails options. Currently
// no additional options are required beyond the cross-platform defaults.
func configurePlatformOptions(opts *options.App) {
	// Intentionally left empty for future Windows-specific options.
}
