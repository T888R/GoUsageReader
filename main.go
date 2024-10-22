package main

import (
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	"github.com/kbinani/screenshot"
)

var maxYRes int

func main() {

	app := app.New()
	window := app.NewWindow("Usage Reader")

	screenAmount := screenshot.NumActiveDisplays()

	for i := 0; i < screenAmount; i++ {
		screenBounds := screenshot.GetDisplayBounds(i)
		height := screenBounds.Max.Y - screenBounds.Min.Y
		if height > maxYRes {
			maxYRes = height
		}
	}

	header := widget.NewLabel(`Welcome to the new usage reader. 
Please type the highest number on the y axis and click Enter`)
	header.Wrapping = fyne.TextWrapWord

	entry := newNumericalEntry()
	entry.SetPlaceHolder("Max number on Y axis")

	info := widget.NewLabel("Input y axis, hit enter, and click the top of the graph")
	info.Wrapping = fyne.TextWrapWord

	readings := widget.NewLabel(months)

	content := container.NewVBox(header, entry, info, readings)

	window.SetContent(content)

	go func() {
		for range time.Tick(time.Millisecond) {
			updateLocation(readings)
			updateDescription(info)
		}
	}()

	window.Resize(fyne.NewSize(200, 600))

	window.ShowAndRun()

}
