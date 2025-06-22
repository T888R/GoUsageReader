package main

import (
	"fmt"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/layout"
	"fyne.io/fyne/v2/widget"

	"github.com/go-vgo/robotgo"
)

var maxYRes int

func main() {
	app := app.New()
	window := app.NewWindow("Usage Reader")

	num := robotgo.DisplaysNum()
	for i := 0; i < num; i++ {
		robotgo.DisplayID = i
		_, _, _, h := robotgo.GetDisplayBounds(i)
		if h > maxYRes {
			maxYRes = h
		}
	}

	fmt.Println(maxYRes)

	// screenAmount := screenshot.NumActiveDisplays()
	//
	// for i := 0; i < screenAmount; i++ {
	// 	screenBounds := screenshot.GetDispl eayBounds(i)
	// 	height := screenBounds.Max.Y - screenBounds.Min.Y
	// 	if height > maxYRes {
	// 		maxYRes = height
	// 	}
	// }

	header := widget.NewLabel(`Welcome to the new usage reader. 
Please type the highest number on the y axis and click Enter`)
	header.Wrapping = fyne.TextWrapWord

	entry := newNumericalEntry()
	entry.SetPlaceHolder("Max number on Y axis")

	info := widget.NewLabel("Input y axis, hit enter, and click the top of the graph")

	readings := widget.NewLabel(months)

	standardUsage := widget.NewButton("Standard Usage", func() {
		fmt.Println("Standard usage pressed")
		inputYMax = entry.yAxis
		addonUsageBool = false
		regularUsageBool = true
	})

	addonUsage := widget.NewButton("Addon Usage", func() {
		fmt.Println("Addon usage pressed")
		inputYMax = entry.yAxis
		addonUsageBool = true
		regularUsageBool = false
		fmt.Printf("%d addon max\n", inputYMax)
	})

	// reset := widget.NewButton("Reset", func() {
	// 	resetFunc()
	// 	readings.Refresh()
	// 	info.Refresh()
	// })

	buttons := container.NewHBox(layout.NewSpacer(), standardUsage, addonUsage, layout.NewSpacer())
	content := container.NewVBox(header, buttons, entry, info, readings)
	window.Resize(fyne.NewSize(110, 250))
	window.SetFixedSize(true)

	window.SetContent(content)

	go func() {
		ticker := time.NewTicker(time.Millisecond)
		for range ticker.C {
			if regularUsageBool && inputYMax != 0 {
				updateLocation(readings)
				updateDescription(info)
			}
			if addonUsageBool && inputYMax != 0 {
				updateAddonLocation(readings)
				updateAddonDescription(info)
			}
		}
	}()

	window.ShowAndRun()
}
