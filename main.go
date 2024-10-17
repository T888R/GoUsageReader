package main

import (
	// "image/color"
	// "fmt"
	"time"

	// "fyne.io/fyne/v2"
	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"

	// "fyne.io/fyne/v2/canvas"
	// "fyne.io/fyne/v2/container"
	"github.com/kbinani/screenshot"

	// "fyne.io/fyne/v2/dialog"
	// "fyne.io/fyne/v2/layout"

	// "fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
)

var topWindow fyne.Window
var maxHeight int

func main() {

	app := app.New()
	window := app.NewWindow("Usage Reader")
	topWindow = window

	screenAmount := screenshot.NumActiveDisplays()

	for i := 0; i < screenAmount; i++ {
		screenBounds := screenshot.GetDisplayBounds(i)
		height := screenBounds.Max.Y - screenBounds.Min.Y
		if height > maxHeight {
			maxHeight = height
		}
	}

	// content := container.NewStack()
	location := widget.NewLabel("")

	entry := newNumericalEntry()
	entry.SetPlaceHolder("Max number on Y axis")

	// image := canvas.NewImageFromResource(theme.FyneLogo())

	// input := widget.NewEntry()
	// input.SetPlaceHolder("Enter text...")

	// split := container.NewHSplit(content, entry)

	window.SetContent(entry)

	go func() {
		for range time.Tick(time.Millisecond) {
			updateLocation(location)
		}
	}()

	window.ShowAndRun()

}
