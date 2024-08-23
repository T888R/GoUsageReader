package main

import (
	"fmt"

	hook "github.com/robotn/gohook"

	"fyne.io/fyne/v2/widget"
	"github.com/go-vgo/robotgo"
)

func updateLocation(location *widget.Label) {
	// formatted := time.Now().Format("Time: 03:04:05")
	// x, y := robotgo.GetMousePos()

	mleft := hook.AddEvent("mleft")
	if mleft == true {
		_, y := robotgo.Location()
		correct := maxHeight - y
		pos := fmt.Sprint(correct)
		location.SetText(pos)
		fmt.Println(pos)
	}
}
