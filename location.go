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
			fmt.Println("January")
			// run the calculation of what resulting usage based on maxgraph and the origin
			calcGraph(yAxisLocation, "January")
		case 3:
			fmt.Println("February")
			calcGraph(yAxisLocation, "January")
		case 4:
			fmt.Println("March")
			calcGraph(yAxisLocation, "January")
		case 5:
			fmt.Println("April")
			calcGraph(yAxisLocation, "January")
		case 6:
			fmt.Println("May")
			calcGraph(yAxisLocation, "January")
		case 7:
			fmt.Println("June")
			calcGraph(yAxisLocation, "January")
		case 8:
			fmt.Println("July")
			calcGraph(yAxisLocation, "January")
		case 9:
			fmt.Println("August")
			calcGraph(yAxisLocation, "January")
		case 10:
			fmt.Println("September")
			calcGraph(yAxisLocation, "January")
		case 11:
			fmt.Println("October")
			calcGraph(yAxisLocation, "January")
		case 12:
			fmt.Println("November")
			calcGraph(yAxisLocation, "January")
		case 13:
			fmt.Println("December")
			calcGraph(yAxisLocation, "January")
		default:
			fmt.Println("Completed")
			calcGraph(yAxisLocation, "January")
		}
		clickCount++
	}
	// fmt.Println(yAxisLocation)
	// fmt.Println(clickCount)
}

func calcGraph(ypos int, month string) {
	boundary = upperBound - lowerBound

	var usage float32
	var correctedUsage float32

	if ypos < lowerBound {
		ypos = 0
	}

	// usage = float32(inputYMax) * (float32(ypos) / float32(boundary))
	usage = (float32(ypos) - float32(lowerBound)) / (float32(upperBound) - float32(lowerBound))
	correctedUsage = float32(inputYMax) * usage
	// fmt.Println(usageMult)
	// fmt.Println(float32(ypos) / float32(maxYRes))
	fmt.Printf("Multiplier %f\n", usage)
	fmt.Printf("Cursor Y postion %d\n", ypos)
	fmt.Printf("Corrected usage %f\n", correctedUsage)
	// fmt.Println(fcorrectedUsage)
	// return ypos, month
}
