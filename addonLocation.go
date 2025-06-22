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
	janA int
	febA int
	marA int
	aprA int
	mayA int
	junA int
	julA int
	augA int
	sepA int
	octA int
	novA int
	decA int

	janB int
	febB int
	marB int
	aprB int
	mayB int
	junB int
	julB int
	augB int
	sepB int
	octB int
	novB int
	decB int
)

func updateAddonDescription(desc *widget.Label) {
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
			desc.SetText("Click January consumption")
		})
	case 3:
		fyne.DoAndWait(func() {
			desc.SetText("Click January production")
		})
	case 4:
		fyne.DoAndWait(func() {
			desc.SetText("Click February consumption")
		})
	case 5:
		fyne.DoAndWait(func() {
			desc.SetText("Click February production")
		})
	case 6:
		fyne.DoAndWait(func() {
			desc.SetText("Click March consumption")
		})
	case 7:
		fyne.DoAndWait(func() {
			desc.SetText("Click March production")
		})
	case 8:
		fyne.DoAndWait(func() {
			desc.SetText("Click April consumption")
		})
	case 9:
		fyne.DoAndWait(func() {
			desc.SetText("Click April production")
		})
	case 10:
		fyne.DoAndWait(func() {
			desc.SetText("Click May consumption")
		})
	case 11:
		fyne.DoAndWait(func() {
			desc.SetText("Click May production")
		})
	case 12:
		fyne.DoAndWait(func() {
			desc.SetText("Click June consumption")
		})
	case 13:
		fyne.DoAndWait(func() {
			desc.SetText("Click June production")
		})
	case 14:
		fyne.DoAndWait(func() {
			desc.SetText("Click July consumption")
		})
	case 15:
		fyne.DoAndWait(func() {
			desc.SetText("Click July production")
		})
	case 16:
		fyne.DoAndWait(func() {
			desc.SetText("Click August consumption")
		})
	case 17:
		fyne.DoAndWait(func() {
			desc.SetText("Click August production")
		})
	case 18:
		fyne.DoAndWait(func() {
			desc.SetText("Click September consumption")
		})
	case 19:
		fyne.DoAndWait(func() {
			desc.SetText("Click September production")
		})
	case 20:
		fyne.DoAndWait(func() {
			desc.SetText("Click October consumption")
		})
	case 21:
		fyne.DoAndWait(func() {
			desc.SetText("Click October production")
		})
	case 22:
		fyne.DoAndWait(func() {
			desc.SetText("Click November consumption")
		})
	case 23:
		fyne.DoAndWait(func() {
			desc.SetText("Click November production")
		})
	case 24:
		fyne.DoAndWait(func() {
			desc.SetText("Click December consumption")
		})
	case 25:
		fyne.DoAndWait(func() {
			desc.SetText("Click December production")
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

func updateAddonLocation(location *widget.Label) {
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
		// for addons, run the calculation for the imported power and then subtract the exported in a separate case

		case 2:
			janA = calcAddonGraph(yAxisLocation)
		case 3:
			janB = calcAddonGraph(yAxisLocation)
			januaryInt := int(janA) - int(janB)
			if januaryInt <= 1 {
				januaryInt = 1
				january = fmt.Sprint(januaryInt)
			} else {
				january = fmt.Sprint(januaryInt)
			}
			months = months + ("January " + january + "\n")
			fyne.Do(func() {
				location.SetText(months)
			})
		case 4:
			febA = calcAddonGraph(yAxisLocation)
		case 5:
			febB = calcAddonGraph(yAxisLocation)
			februaryInt := int(febA) - int(febB)
			if februaryInt <= 1 {
				februaryInt = 1
				february = fmt.Sprint(februaryInt)
			} else {
				february = fmt.Sprint(februaryInt)
			}
			months = months + ("February " + february + "\n")
			fyne.Do(func() {
				location.SetText(months)
			})
		case 6:
			marA = calcAddonGraph(yAxisLocation)
		case 7:
			marB = calcAddonGraph(yAxisLocation)
			marchInt := int(marA) - int(marB)
			if marchInt <= 1 {
				marchInt = 1
				march = fmt.Sprint(marchInt)
			} else {
				march = fmt.Sprint(marchInt)
			}
			months = months + ("March " + march + "\n")
			fyne.Do(func() {
				location.SetText(months)
			})
		case 8:
			aprA = calcAddonGraph(yAxisLocation)
		case 9:
			aprB = calcAddonGraph(yAxisLocation)
			aprilInt := int(aprA) - int(aprB)
			if aprilInt <= 1 {
				aprilInt = 1
				april = fmt.Sprint(aprilInt)
			} else {
				april = fmt.Sprint(aprilInt)
			}
			months = months + ("April " + april + "\n")
			fyne.Do(func() {
				location.SetText(months)
			})
		case 10:
			mayA = calcAddonGraph(yAxisLocation)
		case 11:
			mayB = calcAddonGraph(yAxisLocation)
			mayInt := int(mayA) - int(mayB)
			if mayInt <= 1 {
				mayInt = 1
				may = fmt.Sprint(mayInt)
			} else {
				may = fmt.Sprint(mayInt)
			}
			months = months + ("May " + may + "\n")
			fyne.Do(func() {
				location.SetText(months)
			})
		case 12:
			junA = calcAddonGraph(yAxisLocation)
		case 13:
			junB = calcAddonGraph(yAxisLocation)
			juneInt := int(junA) - int(junB)
			if juneInt <= 1 {
				juneInt = 1
				june = fmt.Sprint(juneInt)
			} else {
				june = fmt.Sprint(juneInt)
			}
			months = months + ("June " + june + "\n")
			fyne.Do(func() {
				location.SetText(months)
			})
		case 14:
			julA = calcAddonGraph(yAxisLocation)
		case 15:
			julB = calcAddonGraph(yAxisLocation)
			julyInt := int(julA) - int(julB)
			if julyInt <= 1 {
				julyInt = 1
				july = fmt.Sprint(julyInt)
			} else {
				july = fmt.Sprint(julyInt)
			}
			months = months + ("July " + july + "\n")
			fyne.Do(func() {
				location.SetText(months)
			})
		case 16:
			augA = calcAddonGraph(yAxisLocation)
		case 17:
			augB = calcAddonGraph(yAxisLocation)
			augustInt := int(augA) - int(augB)
			if augustInt <= 1 {
				augustInt = 1
				august = fmt.Sprint(augustInt)
			} else {
				august = fmt.Sprint(augustInt)
			}
			months = months + ("August " + august + "\n")
			fyne.Do(func() {
				location.SetText(months)
			})
		case 18:
			sepA = calcAddonGraph(yAxisLocation)
		case 19:
			sepB = calcAddonGraph(yAxisLocation)
			septemberInt := int(sepA) - int(sepB)
			if septemberInt <= 1 {
				septemberInt = 1
				september = fmt.Sprint(septemberInt)
			} else {
				september = fmt.Sprint(septemberInt)
			}
			months = months + ("September " + september + "\n")
			fyne.Do(func() {
				location.SetText(months)
			})
		case 20:
			octA = calcAddonGraph(yAxisLocation)
		case 21:
			octB = calcAddonGraph(yAxisLocation)
			octoberInt := int(octA) - int(octB)
			if octoberInt <= 1 {
				octoberInt = 1
				october = fmt.Sprint(octoberInt)
			} else {
				october = fmt.Sprint(octoberInt)
			}
			months = months + ("October " + october + "\n")
			fyne.Do(func() {
				location.SetText(months)
			})
		case 22:
			novA = calcAddonGraph(yAxisLocation)
		case 23:
			novB = calcAddonGraph(yAxisLocation)
			novemberInt := int(novA) - int(novB)
			if novemberInt <= 1 {
				novemberInt = 1
				november = fmt.Sprint(novemberInt)
			} else {
				november = fmt.Sprint(novemberInt)
			}
			months = months + ("November " + november + "\n")
			fyne.Do(func() {
				location.SetText(months)
			})
		case 24:
			decA = calcAddonGraph(yAxisLocation)
		case 25:
			decB = calcAddonGraph(yAxisLocation)
			decemberInt := int(decA) - int(decB)
			if decemberInt <= 1 {
				decemberInt = 1
				december = fmt.Sprint(decemberInt)
			} else {
				december = fmt.Sprint(decemberInt)
			}
			months = months + ("December " + december + "\n")
			fyne.Do(func() {
				location.SetText(months)
			})
		default:
			fmt.Println("Completed")
			fyne.Do(func() {
				location.SetText(months)
			})
		}
		// time.Sleep(500 * time.Millisecond)
		clickCount++
	}
}

func calcAddonGraph(ypos int) int {
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

	monthInt := int(correctedUsage)

	return monthInt
}
