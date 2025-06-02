package main

import (
	"fmt"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
	"github.com/go-vgo/robotgo"
	hook "github.com/robotn/gohook"
)

var maxYRes int
var months string

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

	header := widget.NewLabel(`Welcome to the new usage reader. 
Please type the highest number on the y axis and click Enter`)
	header.Wrapping = fyne.TextWrapWord

	entry := newNumericalEntry()
	entry.SetPlaceHolder("Max number on Y axis")

	info := widget.NewLabel("Input y axis, hit enter, and click the top of the graph")

	readings := widget.NewLabel(months)

	content := container.NewVBox(header, entry, info, readings)
	window.Resize(fyne.NewSize(100, 450))
	window.SetFixedSize(true)

	window.SetContent(content)

	go func() {
		ticker := time.NewTicker(time.Millisecond)
		evChan := hook.Start()
		defer hook.End()

		for range ticker.C {
			for ev := range evChan {
				if ev.Kind == hook.MouseDown {
					fmt.Println("Mouse down still working")
				}

				if ev.Kind == hook.MouseDown && confirmed {
					correct := int32(maxYRes) - int32(ev.Y)
					yAxisLocation = int(correct)

					switch clickCount {
					case 0:
						fmt.Println("Maximum set")
						// set the pixel location of the top of the graph
						upperBound = yAxisLocation
						fyne.DoAndWait(func() {
							info.Text = "Set the origin"
							info.Refresh()
							clickCount++
						})
					case 1:
						fmt.Println("Origin set")
						// set the pixel location of the origin of the graph
						lowerBound = yAxisLocation
						fyne.DoAndWait(func() {
							info.Text = "Click January"
							info.Refresh()
							clickCount++
						})

					// run the calculation and format a string based on resulting usage
					// based on maxgraph and the origin
					case 2:
						january = calcGraph(yAxisLocation)
						fyne.DoAndWait(func() {
							readings.Text = "January: " + january
							readings.Refresh()
							info.Text = "Click February"
							info.Refresh()
							clickCount++
						})
					case 3:
						february = calcGraph(yAxisLocation)
						fyne.DoAndWait(func() {
							readings.Text = readings.Text + "February: " + february
							readings.Refresh()
							info.Text = "Click March"
							info.Refresh()
							clickCount++
						})
					case 4:
						march = calcGraph(yAxisLocation)
						fyne.DoAndWait(func() {
							readings.Text = readings.Text + "March: " + march
							readings.Refresh()
							info.Text = "Click April"
							info.Refresh()
							clickCount++
						})
					case 5:
						april = calcGraph(yAxisLocation)
						fyne.DoAndWait(func() {
							readings.Text = readings.Text + "April: " + april
							readings.Refresh()
							info.Text = "Click May"
							info.Refresh()
							clickCount++
						})
					case 6:
						may = calcGraph(yAxisLocation)
						fyne.DoAndWait(func() {
							readings.Text = readings.Text + "May: " + may
							readings.Refresh()
							info.Text = "Click June"
							info.Refresh()
							clickCount++
						})
					case 7:
						june = calcGraph(yAxisLocation)
						fyne.DoAndWait(func() {
							readings.Text = readings.Text + "June: " + june
							readings.Refresh()
							info.Text = "Click July"
							info.Refresh()
							clickCount++
						})
					case 8:
						july = calcGraph(yAxisLocation)
						fyne.DoAndWait(func() {
							readings.Text = readings.Text + "July: " + july
							readings.Refresh()
							info.Text = "Click August"
							info.Refresh()
							clickCount++
						})
					case 9:
						august = calcGraph(yAxisLocation)
						fyne.DoAndWait(func() {
							readings.Text = readings.Text + "August: " + august
							readings.Refresh()
							info.Text = "Click September"
							info.Refresh()
							clickCount++
						})
					case 10:
						september = calcGraph(yAxisLocation)
						fyne.DoAndWait(func() {
							readings.Text = readings.Text + "September: " + september
							readings.Refresh()
							info.Text = "Click October"
							info.Refresh()
							clickCount++
						})
					case 11:
						october = calcGraph(yAxisLocation)
						fyne.DoAndWait(func() {
							readings.Text = readings.Text + "October: " + september
							readings.Refresh()
							info.Text = "Click November"
							info.Refresh()
							clickCount++
						})
					case 12:
						november = calcGraph(yAxisLocation)
						fyne.DoAndWait(func() {
							readings.Text = readings.Text + "November: " + november
							readings.Refresh()
							info.Text = "Click December"
							info.Refresh()
							clickCount++
						})
					default:
						fmt.Println("Completed")
						december = calcGraph(yAxisLocation)
						fyne.DoAndWait(func() {
							readings.Text = readings.Text + "December: " + december
							readings.Refresh()
							info.Text = "Select January field and click v to paste."
							info.Refresh()
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
							fyne.DoAndWait(func() {
								content.Refresh()
							})
						}
					}
					fmt.Println(yAxisLocation, clickCount)
				}
			}
			time.Sleep(100 * time.Millisecond)
		}
	}()

	window.ShowAndRun()
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
// func resetFunc() {
// 	upperBound = 0
// 	lowerBound = 0
// 	clickCount = 0
// 	confirmed = false
// 	fmt.Println("Reset pressed")
// }
