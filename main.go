package main

import (
	"context"
	"embed"
	"fmt"
	"image"
	"strconv"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"gocv.io/x/gocv"
)

//go:embed all:frontend/dist
var assets embed.FS

// App struct
type App struct {
	ctx          context.Context
	windowHeight int
	maxYRes      int
	clickCount   int
	inputYMax    int
	upperBound   int
	lowerBound   int
	regularUsage bool
	addonUsage   bool

	// Month values
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

	// Addon values
	janA, janB int
	febA, febB int
	marA, marB int
	aprA, aprB int
	mayA, mayB int
	junA, junB int
	julA, julB int
	augA, augB int
	sepA, sepB int
	octA, octB int
	novA, novB int
	decA, decB int

	// Perspective transform data
	cornerPoints    [4][2]float64 // 4 corners: top-left, top-right, bottom-right, bottom-left
	transformedImg  []byte        // Base64 encoded transformed image
	perspectiveMode bool          // Whether perspective mode is active
	imgWidth        int           // Original image width
	imgHeight       int           // Original image height
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// OnStartup is called when the app starts
func (a *App) OnStartup(ctx context.Context) {
	a.ctx = ctx
}

// OnShutdown is called when the app shuts down
func (a *App) OnShutdown(ctx context.Context) {
}

// SetWindowHeight sets the window height and calculates maxYRes from it
func (a *App) SetWindowHeight(height int) {
	a.windowHeight = height
	a.maxYRes = height
}

// GetWindowHeight returns the current window height
func (a *App) GetWindowHeight() int {
	return a.windowHeight
}

// SetYMax sets the maximum Y value from user input
func (a *App) SetYMax(value int) {
	a.inputYMax = value
}

// GetYMax returns the current max Y input value
func (a *App) GetYMax() int {
	return a.inputYMax
}

// StartRegularUsage starts the regular usage tracking mode
func (a *App) StartRegularUsage() {
	a.regularUsage = true
	a.addonUsage = false
	a.clickCount = 0
}

// StartAddonUsage starts the addon usage tracking mode
func (a *App) StartAddonUsage() {
	a.addonUsage = true
	a.regularUsage = false
	a.clickCount = 0
}

// GetDescription returns the current instruction based on click count
func (a *App) GetDescription() string {
	switch a.clickCount {
	case 0:
		return "Input y axis, hit enter, and click the top of the graph"
	case 1:
		return "Set the origin"
	case 2:
		return "Click January"
	case 3:
		return "Click February"
	case 4:
		return "Click March"
	case 5:
		return "Click April"
	case 6:
		return "Click May"
	case 7:
		return "Click June"
	case 8:
		return "Click July"
	case 9:
		return "Click August"
	case 10:
		return "Click September"
	case 11:
		return "Click October"
	case 12:
		return "Click November"
	case 13:
		return "Click December"
	default:
		return "Usage calculation completed. Click v with January field selected to paste"
	}
}

// GetAddonDescription returns addon mode instructions
func (a *App) GetAddonDescription() string {
	switch a.clickCount {
	case 0:
		return "Input y axis, hit enter, and click the top of the graph"
	case 1:
		return "Set the origin"
	case 2:
		return "Click January consumption"
	case 3:
		return "Click January production"
	case 4:
		return "Click February consumption"
	case 5:
		return "Click February production"
	case 6:
		return "Click March consumption"
	case 7:
		return "Click March production"
	case 8:
		return "Click April consumption"
	case 9:
		return "Click April production"
	case 10:
		return "Click May consumption"
	case 11:
		return "Click May production"
	case 12:
		return "Click June consumption"
	case 13:
		return "Click June production"
	case 14:
		return "Click July consumption"
	case 15:
		return "Click July production"
	case 16:
		return "Click August consumption"
	case 17:
		return "Click August production"
	case 18:
		return "Click September consumption"
	case 19:
		return "Click September production"
	case 20:
		return "Click October consumption"
	case 21:
		return "Click October production"
	case 22:
		return "Click November consumption"
	case 23:
		return "Click November production"
	case 24:
		return "Click December consumption"
	case 25:
		return "Click December production"
	default:
		return "Usage calculation completed. Click v with January field selected to paste"
	}
}

// HandleClick processes a click at the given Y coordinate
// This is called from the frontend with the Y position relative to the image
func (a *App) HandleClick(yPos int) (string, string, error) {
	// Calculate the position based on window height (maxYRes)
	correct := a.maxYRes - yPos
	pos := fmt.Sprint(correct)
	yAxisLocation, _ := strconv.Atoi(pos)

	var reading string
	var desc string

	switch a.clickCount {
	case 0:
		fmt.Println("Maximum set")
		a.upperBound = yAxisLocation
		reading = "Maximum set"
	case 1:
		fmt.Println("Origin set")
		a.lowerBound = yAxisLocation
		reading = "Origin set"
	case 2:
		a.january = a.calcGraph(yAxisLocation)
		reading = "January: " + a.january
	case 3:
		a.february = a.calcGraph(yAxisLocation)
		reading = "February: " + a.february
	case 4:
		a.march = a.calcGraph(yAxisLocation)
		reading = "March: " + a.march
	case 5:
		a.april = a.calcGraph(yAxisLocation)
		reading = "April: " + a.april
	case 6:
		a.may = a.calcGraph(yAxisLocation)
		reading = "May: " + a.may
	case 7:
		a.june = a.calcGraph(yAxisLocation)
		reading = "June: " + a.june
	case 8:
		a.july = a.calcGraph(yAxisLocation)
		reading = "July: " + a.july
	case 9:
		a.august = a.calcGraph(yAxisLocation)
		reading = "August: " + a.august
	case 10:
		a.september = a.calcGraph(yAxisLocation)
		reading = "September: " + a.september
	case 11:
		a.october = a.calcGraph(yAxisLocation)
		reading = "October: " + a.october
	case 12:
		a.november = a.calcGraph(yAxisLocation)
		reading = "November: " + a.november
	case 13:
		a.december = a.calcGraph(yAxisLocation)
		reading = "December: " + a.december
		// Auto-paste on completion
		go a.autoPaste()
	default:
		reading = "Completed"
	}

	a.clickCount++
	desc = a.GetDescription()
	return reading, desc, nil
}

// HandleAddonClick processes addon mode clicks at the given Y coordinate
func (a *App) HandleAddonClick(yPos int) (string, string, error) {
	// Calculate the position based on window height (maxYRes)
	correct := a.maxYRes - yPos
	pos := fmt.Sprint(correct)
	yAxisLocation, _ := strconv.Atoi(pos)

	var reading string
	var desc string

	switch a.clickCount {
	case 0:
		fmt.Println("Maximum set")
		a.upperBound = yAxisLocation
		reading = "Maximum set"
	case 1:
		fmt.Println("Origin set")
		a.lowerBound = yAxisLocation
		reading = "Origin set"
	case 2:
		a.janA = a.calcAddonGraph(yAxisLocation)
		reading = "January consumption recorded"
	case 3:
		a.janB = a.calcAddonGraph(yAxisLocation)
		a.january = a.calcNet(a.janA, a.janB)
		reading = "January: " + a.january
	case 4:
		a.febA = a.calcAddonGraph(yAxisLocation)
		reading = "February consumption recorded"
	case 5:
		a.febB = a.calcAddonGraph(yAxisLocation)
		a.february = a.calcNet(a.febA, a.febB)
		reading = "February: " + a.february
	case 6:
		a.marA = a.calcAddonGraph(yAxisLocation)
		reading = "March consumption recorded"
	case 7:
		a.marB = a.calcAddonGraph(yAxisLocation)
		a.march = a.calcNet(a.marA, a.marB)
		reading = "March: " + a.march
	case 8:
		a.aprA = a.calcAddonGraph(yAxisLocation)
		reading = "April consumption recorded"
	case 9:
		a.aprB = a.calcAddonGraph(yAxisLocation)
		a.april = a.calcNet(a.aprA, a.aprB)
		reading = "April: " + a.april
	case 10:
		a.mayA = a.calcAddonGraph(yAxisLocation)
		reading = "May consumption recorded"
	case 11:
		a.mayB = a.calcAddonGraph(yAxisLocation)
		a.may = a.calcNet(a.mayA, a.mayB)
		reading = "May: " + a.may
	case 12:
		a.junA = a.calcAddonGraph(yAxisLocation)
		reading = "June consumption recorded"
	case 13:
		a.junB = a.calcAddonGraph(yAxisLocation)
		a.june = a.calcNet(a.junA, a.junB)
		reading = "June: " + a.june
	case 14:
		a.julA = a.calcAddonGraph(yAxisLocation)
		reading = "July consumption recorded"
	case 15:
		a.julB = a.calcAddonGraph(yAxisLocation)
		a.july = a.calcNet(a.julA, a.julB)
		reading = "July: " + a.july
	case 16:
		a.augA = a.calcAddonGraph(yAxisLocation)
		reading = "August consumption recorded"
	case 17:
		a.augB = a.calcAddonGraph(yAxisLocation)
		a.august = a.calcNet(a.augA, a.augB)
		reading = "August: " + a.august
	case 18:
		a.sepA = a.calcAddonGraph(yAxisLocation)
		reading = "September consumption recorded"
	case 19:
		a.sepB = a.calcAddonGraph(yAxisLocation)
		a.september = a.calcNet(a.sepA, a.sepB)
		reading = "September: " + a.september
	case 20:
		a.octA = a.calcAddonGraph(yAxisLocation)
		reading = "October consumption recorded"
	case 21:
		a.octB = a.calcAddonGraph(yAxisLocation)
		a.october = a.calcNet(a.octA, a.octB)
		reading = "October: " + a.october
	case 22:
		a.novA = a.calcAddonGraph(yAxisLocation)
		reading = "November consumption recorded"
	case 23:
		a.novB = a.calcAddonGraph(yAxisLocation)
		a.november = a.calcNet(a.novA, a.novB)
		reading = "November: " + a.november
	case 24:
		a.decA = a.calcAddonGraph(yAxisLocation)
		reading = "December consumption recorded"
	case 25:
		a.decB = a.calcAddonGraph(yAxisLocation)
		a.december = a.calcNet(a.decA, a.decB)
		reading = "December: " + a.december
		go a.autoPaste()
	default:
		reading = "Completed"
	}

	a.clickCount++
	desc = a.GetAddonDescription()
	return reading, desc, nil
}

// calcGraph calculates usage value from pixel position
func (a *App) calcGraph(ypos int) string {
	var usage float32
	var correctedUsage float32

	if ypos < a.lowerBound {
		ypos = 0
	}

	usage = (float32(ypos) - float32(a.lowerBound)) / (float32(a.upperBound) - float32(a.lowerBound))
	correctedUsage = float32(a.inputYMax) * (usage * 1.01)

	if correctedUsage < 0 {
		correctedUsage = 0
	}

	return fmt.Sprintln(int(correctedUsage))
}

// calcAddonGraph calculates addon usage value
func (a *App) calcAddonGraph(ypos int) int {
	var usage float32
	var correctedUsage float32

	if ypos < a.lowerBound {
		ypos = 0
	}

	usage = (float32(ypos) - float32(a.lowerBound)) / (float32(a.upperBound) - float32(a.lowerBound))
	correctedUsage = float32(a.inputYMax) * (usage * 1.01)

	if correctedUsage < 0 {
		correctedUsage = 0
	}

	return int(correctedUsage)
}

// calcNet calculates net value for addon mode
func (a *App) calcNet(consumption, production int) string {
	net := consumption - production
	if net <= 1 {
		net = 1
	}
	return fmt.Sprint(net)
}

// autoPaste automatically pastes results using Wails runtime
// This simulates keyboard input to paste the calculated values
func (a *App) autoPaste() {
	// Build the string with all values separated by tabs
	allData := a.january + "\t" + a.february + "\t" + a.march + "\t" +
		a.april + "\t" + a.may + "\t" + a.june + "\t" +
		a.july + "\t" + a.august + "\t" + a.september + "\t" +
		a.october + "\t" + a.november + "\t" + a.december

	// Emit an event to the frontend to trigger the paste
	runtime.EventsEmit(a.ctx, "auto-paste", allData)

	// Reset after a short delay
	go func() {
		a.Reset()
	}()
}

// Reset resets the application state
func (a *App) Reset() {
	a.clickCount = 0
	a.upperBound = 0
	a.lowerBound = 0
	a.inputYMax = 0
	a.regularUsage = false
	a.addonUsage = false
	a.january = ""
	a.february = ""
	a.march = ""
	a.april = ""
	a.may = ""
	a.june = ""
	a.july = ""
	a.august = ""
	a.september = ""
	a.october = ""
	a.november = ""
	a.december = ""

	// Reset addon values
	a.janA, a.janB = 0, 0
	a.febA, a.febB = 0, 0
	a.marA, a.marB = 0, 0
	a.aprA, a.aprB = 0, 0
	a.mayA, a.mayB = 0, 0
	a.junA, a.junB = 0, 0
	a.julA, a.julB = 0, 0
	a.augA, a.augB = 0, 0
	a.sepA, a.sepB = 0, 0
	a.octA, a.octB = 0, 0
	a.novA, a.novB = 0, 0
	a.decA, a.decB = 0, 0
}

// GetAllReadings returns all month readings as a formatted string
func (a *App) GetAllReadings() string {
	return fmt.Sprintf("January %sFebruary %sMarch %sApril %sMay %sJune %sJuly %sAugust %sSeptember %sOctober %sNovember %sDecember %s",
		a.january, a.february, a.march, a.april, a.may, a.june,
		a.july, a.august, a.september, a.october, a.november, a.december)
}

// IsRegularMode returns true if in regular mode
func (a *App) IsRegularMode() bool {
	return a.regularUsage
}

// IsAddonMode returns true if in addon mode
func (a *App) IsAddonMode() bool {
	return a.addonUsage
}

// GetClickCount returns the current click count
func (a *App) GetClickCount() int {
	return a.clickCount
}

// SetCornerPoints sets the 4 corner points for perspective transformation
// Points should be in order: top-left, top-right, bottom-right, bottom-left
func (a *App) SetCornerPoints(points [4][2]float64) {
	a.cornerPoints = points
}

// GetCornerPoints returns the current corner points
func (a *App) GetCornerPoints() [4][2]float64 {
	return a.cornerPoints
}

// SetPerspectiveMode enables/disables perspective transform mode
func (a *App) SetPerspectiveMode(enabled bool) {
	a.perspectiveMode = enabled
}

// IsPerspectiveMode returns whether perspective mode is active
func (a *App) IsPerspectiveMode() bool {
	return a.perspectiveMode
}

// SetImageDimensions stores the original image dimensions
func (a *App) SetImageDimensions(width, height int) {
	a.imgWidth = width
	a.imgHeight = height
}

// GetImageDimensions returns the original image dimensions
func (a *App) GetImageDimensions() (int, int) {
	return a.imgWidth, a.imgHeight
}

// ApplyPerspectiveTransform applies perspective transformation to the image data
// Returns base64 encoded transformed image
func (a *App) ApplyPerspectiveTransform(imageData []byte, width, height int) ([]byte, error) {
	// Create source points from corner points
	srcPointVector := gocv.NewPointVector()
	defer srcPointVector.Close()
	for _, point := range a.cornerPoints {
		srcPointVector.Append(image.Point{X: int(point[0]), Y: int(point[1])})
	}

	// Calculate output dimensions
	srcPoints := make([]image.Point, 4)
	for i, point := range a.cornerPoints {
		srcPoints[i] = image.Point{X: int(point[0]), Y: int(point[1])}
	}
	maxWidth, maxHeight := calculateOutputDimensions(srcPoints)

	// Create destination points (rectangle)
	dstPointVector := gocv.NewPointVector()
	defer dstPointVector.Close()
	dstPointVector.Append(image.Point{X: 0, Y: 0})
	dstPointVector.Append(image.Point{X: maxWidth - 1, Y: 0})
	dstPointVector.Append(image.Point{X: maxWidth - 1, Y: maxHeight - 1})
	dstPointVector.Append(image.Point{X: 0, Y: maxHeight - 1})

	// Get perspective transform matrix
	transformMatrix := gocv.GetPerspectiveTransform(srcPointVector, dstPointVector)
	defer transformMatrix.Close()

	// Decode image from bytes
	img, err := gocv.IMDecode(imageData, gocv.IMReadColor)
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}
	defer img.Close()

	// Apply perspective warp
	warped := gocv.NewMat()
	defer warped.Close()

	gocv.WarpPerspective(img, &warped, transformMatrix, image.Point{X: maxWidth, Y: maxHeight})

	// Encode result as PNG
	encodedBuf, err := gocv.IMEncodeWithParams(gocv.PNGFileExt, warped, []int{gocv.IMWritePngCompression, 3})
	if err != nil {
		return nil, fmt.Errorf("failed to encode transformed image: %w", err)
	}
	defer encodedBuf.Close()

	// Convert NativeByteBuffer to []byte
	encoded := encodedBuf.GetBytes()

	// Store transformed image
	a.transformedImg = encoded

	return encoded, nil
}

// GetTransformedImage returns the last transformed image
func (a *App) GetTransformedImage() []byte {
	return a.transformedImg
}

// ResetPerspective resets perspective transform data
func (a *App) ResetPerspective() {
	a.cornerPoints = [4][2]float64{}
	a.transformedImg = nil
	a.perspectiveMode = false
}

// calculateOutputDimensions calculates the output dimensions for perspective transform
func calculateOutputDimensions(pts []image.Point) (int, int) {
	// Calculate width - max of top and bottom edge lengths
	widthTop := distance(pts[0], pts[1])
	widthBottom := distance(pts[3], pts[2])
	maxWidth := int(max(widthTop, widthBottom))

	// Calculate height - max of left and right edge lengths
	heightLeft := distance(pts[0], pts[3])
	heightRight := distance(pts[1], pts[2])
	maxHeight := int(max(heightLeft, heightRight))

	return maxWidth, maxHeight
}

// distance calculates Euclidean distance between two points
func distance(p1, p2 image.Point) float64 {
	dx := float64(p2.X - p1.X)
	dy := float64(p2.Y - p1.Y)
	return sqrt(dx*dx + dy*dy)
}

// max returns the maximum of two float64 values
func max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

// sqrt calculates square root
func sqrt(x float64) float64 {
	if x == 0 {
		return 0
	}
	z := x
	for i := 0; i < 10; i++ {
		z = (z + x/z) / 2
	}
	return z
}

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:     "Usage Reader",
		Width:     800,
		Height:    700,
		MinWidth:  600,
		MinHeight: 500,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 255, G: 255, B: 255, A: 1},
		OnStartup:        app.OnStartup,
		OnShutdown:       app.OnShutdown,
		Linux: &linux.Options{
			WebviewGpuPolicy: linux.WebviewGpuPolicyAlways,
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
