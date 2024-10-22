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
		desc.SetText("Maximum set")
	case 2:
		desc.SetText("Origin set")
	case 3:
		desc.SetText("January set")
	case 4:
		desc.SetText("February set")
	case 5:
		desc.SetText("March set")
	case 6:
		desc.SetText("April set")
	case 7:
		desc.SetText("May set")
	case 8:
		desc.SetText("June set")
	case 9:
		desc.SetText("July set")
	case 10:
		desc.SetText("August set")
	case 11:
		desc.SetText("September set")
	case 12:
		desc.SetText("October set")
	case 13:
		desc.SetText("November set")
	default:
		desc.SetText("Usage calculation completed")
	}
}

func updateLocation(location *widget.Label) {
	// func updateLocation() {

	mleft := hook.AddEvent("mleft")
	if mleft == true && confirmed == true {
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
			january = calcGraph(yAxisLocation, "January")
			months = fmt.Sprint(january)
			location.SetText(months)
		case 3:
			february = calcGraph(yAxisLocation, "February")
			months = months + february
			location.SetText(months)
		case 4:
			march = calcGraph(yAxisLocation, "March")
			months = months + march
			location.SetText(months)
		case 5:
			april = calcGraph(yAxisLocation, "April")
			months = months + april
			location.SetText(months)
		case 6:
			may = calcGraph(yAxisLocation, "May")
			months = months + may
			location.SetText(months)
		case 7:
			june = calcGraph(yAxisLocation, "June")
			months = months + june
			location.SetText(months)
		case 8:
			july = calcGraph(yAxisLocation, "July")
			months = months + july
			location.SetText(months)
		case 9:
			august = calcGraph(yAxisLocation, "August")
			months = months + august
			location.SetText(months)
		case 10:
			september = calcGraph(yAxisLocation, "September")
			months = months + september
			location.SetText(months)
		case 11:
			october = calcGraph(yAxisLocation, "October")
			months = months + october
			location.SetText(months)
		case 12:
			november = calcGraph(yAxisLocation, "November")
			months = months + november
			location.SetText(months)
		case 13:
			december = calcGraph(yAxisLocation, "December")
			months = months + december
			location.SetText(months)
		default:
			fmt.Println("Completed")
			location.SetText(months)
		}
		clickCount++
	}
	// fmt.Println(yAxisLocation)
	// fmt.Println(clickCount)
}

func calcGraph(ypos int, month string) string {

	var usage float32
	var correctedUsage float32

	if ypos < lowerBound {
		ypos = 0
	}

	// min max calculation
	usage = (float32(ypos) - float32(lowerBound)) / (float32(upperBound) - float32(lowerBound))

	// take min max and times it by the inputted max value and add 1 to round
	correctedUsage = float32(inputYMax)*usage + 1

	// ensure no negative numbers
	if correctedUsage < 0 {
		correctedUsage = 0
	}

	monthStr := fmt.Sprintln(month, int(correctedUsage))
	fmt.Printf(monthStr)

	return monthStr
}
