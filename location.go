package main

import (
	"fmt"

	hook "github.com/robotn/gohook"

	"fyne.io/fyne/v2/widget"
	"github.com/go-vgo/robotgo"
	"strconv"
)

var clickCount int

func updateLocation(location *widget.Label) {
	// formatted := time.Now().Format("Time: 03:04:05")
	// x, y := robotgo.GetMousePos()
	var top int

	mleft := hook.AddEvent("mleft")
	if mleft == true {
		_, y := robotgo.Location()
		correct := maxHeight - y
		pos := fmt.Sprint(correct)
		location.SetText(pos)
		top, _ = strconv.Atoi(pos)
		fmt.Println(top)
		clickCount++
	}
	fmt.Println(clickCount)
}
