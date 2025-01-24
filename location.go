package main

import (
	"fmt"

	hook "github.com/robotn/gohook"

	"fyne.io/fyne/v2/widget"
	// "fyne.io/fyne/v2/driver/desktop"
	"strconv"

	"github.com/go-vgo/robotgo"
)

var clickCount int
var yAxisLocation int
var upperBound int
var lowerBound int

var january string
var february string
var march string
var april string
var may string
var june string
var july string
var august string
var september string
var october string
var november string
var december string

var months string
var description string

func updateDescription(desc *widget.Label) {
	switch clickCount {
	case 0:
		desc.SetText("Input y axis, hit enter, and click the top of the graph")
	case 1:
		desc.SetText("Set the origin")
	case 2:
		desc.SetText("Click January")
	case 3:
		desc.SetText("Click February")
	case 4:
		desc.SetText("Click March")
	case 5:
		desc.SetText("Click April")
	case 6:
		desc.SetText("Click May")
	case 7:
		desc.SetText("Click June")
	case 8:
		desc.SetText("Click July")
	case 9:
		desc.SetText("Click August")
	case 10:
		desc.SetText("Click September")
	case 11:
		desc.SetText("Click October")
	case 12:
		desc.SetText("Click November")
	case 13:
		desc.SetText("Click December")
	default:
		desc.SetText("Usage calculation completed. Click v with January field selected to paste")

		ok := hook.AddEvent("v")
		if ok {
			fmt.Println("pasted")
			robotgo.KeyTap("backspace")
			robotgo.TypeStr(january)
			robotgo.KeyTap("tab")
			robotgo.TypeStr(february)
			robotgo.KeyTap("tab")
			robotgo.TypeStr(march)
			robotgo.KeyTap("tab")
			robotgo.TypeStr(april)
			robotgo.KeyTap("tab")
			robotgo.TypeStr(may)
			robotgo.KeyTap("tab")
			robotgo.TypeStr(june)
			robotgo.KeyTap("tab")
			robotgo.TypeStr(july)
			robotgo.KeyTap("tab")
			robotgo.TypeStr(august)
			robotgo.KeyTap("tab")
			robotgo.TypeStr(september)
			robotgo.KeyTap("tab")
			robotgo.TypeStr(october)
			robotgo.KeyTap("tab")
			robotgo.TypeStr(november)
			robotgo.KeyTap("tab")
			robotgo.TypeStr(december)
			robotgo.KeyTap("tab")
		}
	}
}

func updateLocation(location *widget.Label) {

	// These comments are for getting cursor position with Windows API

	// userDLL := syscall.NewLazyDLL("user32.dll")
	// getWindowRectProc := userDLL.NewProc("GetCursorPos")

	// type POINT struct {
	// X, Y int32
	// }
	// var pt POINT

	mleft := hook.AddEvent("mleft")

	if mleft && confirmed {

		// _, _, eno := syscall.SyscallN(getWindowRectProc.Addr(), uintptr(unsafe.Pointer(&pt)))
		// if eno != 0 {
		// fmt.Println(eno)
		// }

		// correct := int32(maxYres) - int32(pt.Y)

		// using robotgo to get cursor position for Linux and potentially MacOS
		_, y := robotgo.Location()
		correct := maxYRes - y
		pos := fmt.Sprint(correct)
		yAxisLocation, _ = strconv.Atoi(pos)

		switch clickCount {
		case 0:
			fmt.Println("Maximum set")
			// set the pixel location of the top of the graph
			upperBound = yAxisLocation
		case 1:
			fmt.Println("Origin set")
			// set the pixel location of the origin of the graph
			lowerBound = yAxisLocation

		// run the calculation and format a string based on resulting usage based on maxgraph and the origin
		case 2:
			january = calcGraph(yAxisLocation)
			months = fmt.Sprint("January " + january)
			location.SetText(months)
		case 3:
			february = calcGraph(yAxisLocation)
			months = months + ("February " + february)
			location.SetText(months)
		case 4:
			march = calcGraph(yAxisLocation)
			months = months + ("March " + march)
			location.SetText(months)
		case 5:
			april = calcGraph(yAxisLocation)
			months = months + ("April " + april)
			location.SetText(months)
		case 6:
			may = calcGraph(yAxisLocation)
			months = months + ("May " + may)
			location.SetText(months)
		case 7:
			june = calcGraph(yAxisLocation)
			months = months + ("June " + june)
			location.SetText(months)
		case 8:
			july = calcGraph(yAxisLocation)
			months = months + ("July " + july)
			location.SetText(months)
		case 9:
			august = calcGraph(yAxisLocation)
			months = months + ("August " + august)
			location.SetText(months)
		case 10:
			september = calcGraph(yAxisLocation)
			months = months + ("September " + september)
			location.SetText(months)
		case 11:
			october = calcGraph(yAxisLocation)
			months = months + ("October " + october)
			location.SetText(months)
		case 12:
			november = calcGraph(yAxisLocation)
			months = months + ("November " + november)
			location.SetText(months)
		case 13:
			december = calcGraph(yAxisLocation)
			months = months + ("December " + december)
			location.SetText(months)
		default:
			fmt.Println("Completed")
			location.SetText(months)
		}
		// time.Sleep(500 * time.Millisecond)
		clickCount++
	}
	// fmt.Println(yAxisLocation)
	// fmt.Println(clickCount)
}

func calcGraph(ypos int) string {

	var usage float32
	var correctedUsage float32

	if ypos < lowerBound {
		ypos = 0
	}

	// min max calculation
	usage = (float32(ypos) - float32(lowerBound)) / (float32(upperBound) - float32(lowerBound))

	// take min max and times it by the inputted max value and add 1 to round
	correctedUsage = float32(inputYMax) * (usage * 1.01)

	// ensure no negative numbers
	if correctedUsage < 0 {
		correctedUsage = 0
	}

	monthStr := fmt.Sprintln(int(correctedUsage))
	// fmt.Printf(monthStr)

	return monthStr
}

func resetFunc() {
	clickCount = 0
	upperBound = 0
	lowerBound = 0
	months = ""
	confirmed = false
	fmt.Println("Reset pressed")
	// isActive := false
	//
	// return isActive

}
