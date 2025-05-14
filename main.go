package main

import (
	// "fmt"
	"fmt"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
	"github.com/kbinani/screenshot"
	// "github.com/go-vgo/robotgo"
)

var maxYRes int

func main() {
	app := app.New()
	window := app.NewWindow("Usage Reader")

	// num := robotgo.DisplaysNum()
	// for i := 0; i < num; i++ {
	// 	robotgo.DisplayID = i
	// 	_, _, _, h := robotgo.GetDisplayBounds(i)
	// 	if h > maxYRes {
	// 		maxYRes = h
	// 	}
	// }

	fmt.Println(maxYRes)

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

	readings := widget.NewLabel(months)

	content := container.NewVBox(header, entry, info, readings)
	window.Resize(fyne.NewSize(100, 450))

	window.SetContent(content)

	go func() {
		for range time.Tick(time.Millisecond) {
			updateLocation(readings)
			updateDescription(info)
		}
	}()

	window.ShowAndRun()
}
