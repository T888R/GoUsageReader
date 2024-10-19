package main

import (
	"fmt"

	hook "github.com/robotn/gohook"

	"fyne.io/fyne/v2/widget"
	"github.com/go-vgo/robotgo"
	"strconv"
)

var clickCount int
var yAxisLocation int
var upperBound int
var lowerBound int
var boundary int

func updateLocation(location *widget.Label) {

	mleft := hook.AddEvent("mleft")
	if mleft == true && confirmed == true {
		_, y := robotgo.Location()
		correct := maxYRes - y
		pos := fmt.Sprint(correct)
		location.SetText(pos)
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
		case 2:
			// run the calculation of what resulting usage based on maxgraph and the origin
			calcGraph(yAxisLocation, "January")
		case 3:
			calcGraph(yAxisLocation, "February")
		case 4:
			calcGraph(yAxisLocation, "March")
		case 5:
			calcGraph(yAxisLocation, "April")
		case 6:
			calcGraph(yAxisLocation, "May")
		case 7:
			calcGraph(yAxisLocation, "June")
		case 8:
			calcGraph(yAxisLocation, "July")
		case 9:
			calcGraph(yAxisLocation, "August")
		case 10:
			calcGraph(yAxisLocation, "September")
		case 11:
			calcGraph(yAxisLocation, "October")
		case 12:
			calcGraph(yAxisLocation, "November")
		case 13:
			calcGraph(yAxisLocation, "December")
		default:
			fmt.Println("Completed")
		}
		clickCount++
	}
	// fmt.Println(yAxisLocation)
	// fmt.Println(clickCount)
}

func calcGraph(ypos int, month string) (int, string) {
	boundary = upperBound - lowerBound

	var usage float32
	var correctedUsage float32

	if ypos < lowerBound {
		ypos = 0
	}

	// usage = float32(inputYMax) * (float32(ypos) / float32(boundary))
	usage = (float32(ypos) - float32(lowerBound)) / (float32(upperBound) - float32(lowerBound))
	correctedUsage = float32(inputYMax) * usage
	if correctedUsage < 0 {
		correctedUsage = 0
	}
	// fmt.Println(usageMult)
	// fmt.Println(float32(ypos) / float32(maxYRes))
	// fmt.Printf("Multiplier %f\n", usage)
	// fmt.Printf("Cursor Y postion %d\n", ypos)
	fmt.Printf("Corrected usage %d for %s\n", int(correctedUsage), month)
	// fmt.Println(fcorrectedUsage)
	return int(correctedUsage), month
}
