package main

import (
	"fmt"
	"strconv"

	hook "github.com/robotn/gohook"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/widget"
	// "fyne.io/fyne/v2/driver/desktop"

	"github.com/go-vgo/robotgo"
)

var (
	clickCount    int
	yAxisLocation int
	upperBound    int
	lowerBound    int
)

var (
	january   string
	february  string
	march     string
	april     string
	may       string
	june      string
	july      string
	august    string
	september string
	october   string
	november  string
	december  string
)

var (
	months      string
	description string
)

func updateDescription(desc *widget.Label) {
	switch clickCount {
	case 0:
		fyne.DoAndWait(func() {
			desc.SetText("Input y axis, hit enter, and click the top of the graph")
		})
	case 1:
		fyne.DoAndWait(func() {
			desc.SetText("Set the origin")
		})
	case 2:
		fyne.DoAndWait(func() {
			desc.SetText("Click January")
		})
	case 3:
		fyne.DoAndWait(func() {
			desc.SetText("Click February")
		})
	case 4:
		fyne.DoAndWait(func() {
			desc.SetText("Click March")
		})
	case 5:
		fyne.DoAndWait(func() {
			desc.SetText("Click April")
		})
	case 6:
		fyne.DoAndWait(func() {
			desc.SetText("Click May")
		})
	case 7:
		fyne.DoAndWait(func() {
			desc.SetText("Click June")
		})
	case 8:
		fyne.DoAndWait(func() {
			desc.SetText("Click July")
		})
	case 9:
		fyne.DoAndWait(func() {
			desc.SetText("Click August")
		})
	case 10:
		fyne.DoAndWait(func() {
			desc.SetText("Click September")
		})
	case 11:
		fyne.DoAndWait(func() {
			desc.SetText("Click October")
		})
	case 12:
		fyne.DoAndWait(func() {
			desc.SetText("Click November")
		})
	case 13:
		fyne.DoAndWait(func() {
			desc.SetText("Click December")
		})
	default:
		fyne.DoAndWait(func() {
			desc.SetText("Usage calculation completed. Click v with January field selected to paste")
		})

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
			resetFunc()
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

	if mleft {

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
			fyne.Do(func() {
				location.SetText(months)
			})
		case 3:
			february = calcGraph(yAxisLocation)
			months = months + ("February " + february)
			fyne.Do(func() {
				location.SetText(months)
			})
		case 4:
			march = calcGraph(yAxisLocation)
			months = months + ("March " + march)
			fyne.Do(func() {
				location.SetText(months)
			})
		case 5:
			april = calcGraph(yAxisLocation)
			months = months + ("April " + april)
			fyne.Do(func() {
				location.SetText(months)
			})
		case 6:
			may = calcGraph(yAxisLocation)
			months = months + ("May " + may)
			fyne.Do(func() {
				location.SetText(months)
			})
		case 7:
			june = calcGraph(yAxisLocation)
			months = months + ("June " + june)
			fyne.Do(func() {
				location.SetText(months)
			})
		case 8:
			july = calcGraph(yAxisLocation)
			months = months + ("July " + july)
			fyne.Do(func() {
				location.SetText(months)
			})
		case 9:
			august = calcGraph(yAxisLocation)
			months = months + ("August " + august)
			fyne.Do(func() {
				location.SetText(months)
			})
		case 10:
			september = calcGraph(yAxisLocation)
			months = months + ("September " + september)
			fyne.Do(func() {
				location.SetText(months)
			})
		case 11:
			october = calcGraph(yAxisLocation)
			months = months + ("October " + october)
			fyne.Do(func() {
				location.SetText(months)
			})
		case 12:
			november = calcGraph(yAxisLocation)
			months = months + ("November " + november)
			fyne.Do(func() {
				location.SetText(months)
			})
		case 13:
			december = calcGraph(yAxisLocation)
			months = months + ("December " + december)
			fyne.Do(func() {
				location.SetText(months)
			})
		default:
			fmt.Println("Completed")
		}
		// time.Sleep(500 * time.Millisecond)
		clickCount++
	}
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

	return monthStr
}

// Reset state
func resetFunc() {
	upperBound = 0
	lowerBound = 0
	months = ""
	confirmed = false
	regularUsageBool = false
	addonUsageBool = false
	clickCount = 0
	fmt.Println("Reset pressed")
}
