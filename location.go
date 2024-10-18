package main

import (
	"fmt"

	hook "github.com/robotn/gohook"

	"fyne.io/fyne/v2/widget"
	"github.com/go-vgo/robotgo"
	"strconv"
)

type usage struct {
}

var clickCount int

func updateLocation(location *widget.Label) {
	var maxGraph int

	mleft := hook.AddEvent("mleft")
	if mleft == true {
		_, y := robotgo.Location()
		correct := maxHeight - y
		pos := fmt.Sprint(correct)
		location.SetText(pos)
		maxGraph, _ = strconv.Atoi(pos)
	}
	if mleft == true && confirmed == true {
		switch clickCount {
		case 0:
			fmt.Println("Maximum set")
		case 1:
			fmt.Println("Origin set")
		case 2:
			fmt.Println("January")
		case 3:
			fmt.Println("February")
		case 4:
			fmt.Println("March")
		case 5:
			fmt.Println("April")
		case 6:
			fmt.Println("May")
		case 7:
			fmt.Println("June")
		case 8:
			fmt.Println("July")
		case 9:
			fmt.Println("August")
		case 10:
			fmt.Println("September")
		case 11:
			fmt.Println("October")
		case 12:
			fmt.Println("November")
		case 13:
			fmt.Println("December")
		default:
			fmt.Println("Completed")
		}
		clickCount++
	}
	fmt.Println(maxGraph)
	fmt.Println(clickCount)
}
