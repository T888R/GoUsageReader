package main

import (
	// "fmt"
	"strconv"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/driver/mobile"
	"fyne.io/fyne/v2/widget"
)

var confirmed bool
var inputYMax int

type numericalEntry struct {
	widget.Entry
	yAxis int
}

func newNumericalEntry() *numericalEntry {
	entry := &numericalEntry{}
	entry.ExtendBaseWidget(entry)
	return entry
}

func (e *numericalEntry) TypedRune(r rune) {
	if r >= '0' && r <= '9' {
		e.Entry.TypedRune(r)
		text, err := strconv.Atoi(e.Entry.Text)
		if err != nil {
			return
		}
		e.yAxis = text
	}
}

func (e *numericalEntry) KeyUp(event *fyne.KeyEvent) {
	switch event.Name {
	case fyne.KeyReturn:
		inputYMax = e.yAxis
		confirmed = true
	case fyne.KeyBackspace:
		text, err := strconv.Atoi(e.Entry.Text)
		if err != nil {
			return
		}
		e.yAxis = text
	}
}

func (e *numericalEntry) TypedShortcut(shortcut fyne.Shortcut) {
	paste, ok := shortcut.(*fyne.ShortcutPaste)
	if !ok {
		e.Entry.TypedShortcut(shortcut)
		return
	}

	content := paste.Clipboard.Content()
	if _, err := strconv.ParseFloat(content, 64); err == nil {
		e.Entry.TypedShortcut(shortcut)
	}
}

func (e *numericalEntry) Keyboard() mobile.KeyboardType {
	return mobile.NumberKeyboard
}
