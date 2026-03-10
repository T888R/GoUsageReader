package main

import (
	"bytes"
	"context"
	"embed"
	"encoding/base64"
	"fmt"
	"image"
	"image/color"
	_ "image/jpeg" // Register JPEG decoder
	"image/png"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
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

// OpenImageDialog opens a native file dialog for selecting an image file
// Returns the file path and base64 encoded image data
func (a *App) OpenImageDialog() (string, string, error) {
	selection, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Select Image File",
		Filters: []wailsruntime.FileFilter{
			{
				DisplayName: "Image Files (*.png;*.jpg;*.jpeg;*.gif;*.bmp;*.webp)",
				Pattern:     "*.png;*.jpg;*.jpeg;*.gif;*.bmp;*.webp",
			},
			{
				DisplayName: "All Files (*.*)",
				Pattern:     "*.*",
			},
		},
		ShowHiddenFiles:            false,
		CanCreateDirectories:       false,
		TreatPackagesAsDirectories: false,
	})
	if err != nil {
		return "", "", fmt.Errorf("failed to open file dialog: %w", err)
	}
	if selection == "" {
		return "", "", nil // User cancelled
	}

	// Read the file
	imageData, err := os.ReadFile(selection)
	if err != nil {
		return "", "", fmt.Errorf("failed to read file: %w", err)
	}

	// Encode to base64
	base64Data := base64.StdEncoding.EncodeToString(imageData)
	dataURL := fmt.Sprintf("data:image/png;base64,%s", base64Data)

	// Try to detect image type from file extension
	ext := strings.ToLower(filepath.Ext(selection))
	switch ext {
	case ".jpg", ".jpeg":
		dataURL = fmt.Sprintf("data:image/jpeg;base64,%s", base64Data)
	case ".gif":
		dataURL = fmt.Sprintf("data:image/gif;base64,%s", base64Data)
	case ".bmp":
		dataURL = fmt.Sprintf("data:image/bmp;base64,%s", base64Data)
	case ".webp":
		dataURL = fmt.Sprintf("data:image/webp;base64,%s", base64Data)
	}

	return selection, dataURL, nil
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
		// Disable regular usage mode to prevent overriding values
		a.regularUsage = false
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
		// Disable addon usage mode to prevent overriding values
		a.addonUsage = false
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
	wailsruntime.EventsEmit(a.ctx, "auto-paste", allData)

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
// Uses parallel goroutines with 32-row chunks for optimal performance
// Returns base64 encoded transformed image
func (a *App) ApplyPerspectiveTransform(imageData []byte, width, height int) ([]byte, error) {
	// Calculate output dimensions from corner points
	srcPoints := make([]image.Point, 4)
	for i, point := range a.cornerPoints {
		srcPoints[i] = image.Point{X: int(point[0]), Y: int(point[1])}
	}
	dstWidth, dstHeight := calculateOutputDimensions(srcPoints)

	// Define source corners (original image bounds in screen space)
	// These are the current corner points
	srcCorners := a.cornerPoints

	// Define destination corners (rectangle at origin)
	var dstCorners [4][2]float64
	dstCorners[0] = [2]float64{0, 0}                                          // top-left
	dstCorners[1] = [2]float64{float64(dstWidth - 1), 0}                      // top-right
	dstCorners[2] = [2]float64{float64(dstWidth - 1), float64(dstHeight - 1)} // bottom-right
	dstCorners[3] = [2]float64{0, float64(dstHeight - 1)}                     // bottom-left

	// Apply perspective transform using parallel processing
	result, err := a.ApplyPerspectiveTransformParallel(imageData, dstWidth, dstHeight, srcCorners, dstCorners)
	if err != nil {
		return nil, fmt.Errorf("failed to apply perspective transform: %w", err)
	}

	// Store transformed image
	a.transformedImg = result

	return result, nil
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

// Matrix3x3 represents a 3x3 transformation matrix for homography
type Matrix3x3 [9]float64

// ApplyPerspectiveTransformParallel applies perspective transformation using parallel goroutines
// Processes the image in chunks of 32 rows for optimal performance
func (a *App) ApplyPerspectiveTransformParallel(imageData []byte, dstWidth, dstHeight int, srcCorners, dstCorners [4][2]float64) ([]byte, error) {
	// Decode the source image
	srcImg, _, err := image.Decode(bytes.NewReader(imageData))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	srcBounds := srcImg.Bounds()

	// Create destination image
	dstImg := image.NewRGBA(image.Rect(0, 0, dstWidth, dstHeight))

	// Compute homography matrix (maps destination to source)
	H := computeHomography(dstCorners, srcCorners)
	invH := invertMatrix3x3(H)

	// Check if matrix is singular (all zeros means inversion failed)
	isZero := true
	for _, v := range invH {
		if v != 0 {
			isZero = false
			break
		}
	}
	if isZero {
		return nil, fmt.Errorf("failed to compute inverse homography matrix")
	}

	// Process rows in parallel with chunks of 32 rows
	chunkSize := 32
	numChunks := (dstHeight + chunkSize - 1) / chunkSize

	var wg sync.WaitGroup
	wg.Add(numChunks)

	for chunk := 0; chunk < numChunks; chunk++ {
		startRow := chunk * chunkSize
		endRow := startRow + chunkSize
		if endRow > dstHeight {
			endRow = dstHeight
		}

		go func(startY, endY int) {
			defer wg.Done()

			for y := startY; y < endY; y++ {
				for x := 0; x < dstWidth; x++ {
					// Apply inverse homography to get source coordinate
					srcCoord := applyHomography(invH, float64(x), float64(y))

					// Check if source coordinate is within bounds
					if srcCoord.x >= 0 && srcCoord.x < float64(srcBounds.Dx()) &&
						srcCoord.y >= 0 && srcCoord.y < float64(srcBounds.Dy()) {
						// Sample pixel with bilinear interpolation
						c := bilinearSample(srcImg, srcCoord.x, srcCoord.y, srcBounds)
						dstImg.Set(x, y, c)
					}
				}
			}
		}(startRow, endRow)
	}

	// Wait for all goroutines to complete
	wg.Wait()

	// Encode result as PNG
	var buf bytes.Buffer
	if err := png.Encode(&buf, dstImg); err != nil {
		return nil, fmt.Errorf("failed to encode transformed image: %w", err)
	}

	return buf.Bytes(), nil
}

// computeHomography computes the homography matrix from point correspondences
func computeHomography(dst, src [4][2]float64) Matrix3x3 {
	// Build matrix A (8x9)
	A := make([][]float64, 8)
	for i := range A {
		A[i] = make([]float64, 9)
	}

	for i := 0; i < 4; i++ {
		sx, sy := src[i][0], src[i][1]
		dx, dy := dst[i][0], dst[i][1]

		// Two rows per point
		A[i*2][0], A[i*2][1], A[i*2][2] = sx, sy, 1
		A[i*2][3], A[i*2][4], A[i*2][5] = 0, 0, 0
		A[i*2][6], A[i*2][7], A[i*2][8] = -sx*dx, -sy*dx, -dx

		A[i*2+1][0], A[i*2+1][1], A[i*2+1][2] = 0, 0, 0
		A[i*2+1][3], A[i*2+1][4], A[i*2+1][5] = sx, sy, 1
		A[i*2+1][6], A[i*2+1][7], A[i*2+1][8] = -sx*dy, -sy*dy, -dy
	}

	// Solve using Gaussian elimination (simplified: set h33 = 1)
	B := make([][]float64, 8)
	c := make([]float64, 8)
	for i := 0; i < 8; i++ {
		B[i] = make([]float64, 8)
		copy(B[i], A[i][:8])
		c[i] = -A[i][8]
	}

	solution := solveLinearSystem(B, c)
	if solution == nil {
		return Matrix3x3{}
	}

	// Add h33 = 1
	var H Matrix3x3
	copy(H[:8], solution)
	H[8] = 1

	return H
}

// invertMatrix3x3 inverts a 3x3 matrix
func invertMatrix3x3(m Matrix3x3) Matrix3x3 {
	det := m[0]*(m[4]*m[8]-m[5]*m[7]) -
		m[1]*(m[3]*m[8]-m[5]*m[6]) +
		m[2]*(m[3]*m[7]-m[4]*m[6])

	if math.Abs(det) < 1e-10 {
		return Matrix3x3{}
	}

	invDet := 1.0 / det

	return Matrix3x3{
		(m[4]*m[8] - m[5]*m[7]) * invDet,
		(m[2]*m[7] - m[1]*m[8]) * invDet,
		(m[1]*m[5] - m[2]*m[4]) * invDet,
		(m[5]*m[6] - m[3]*m[8]) * invDet,
		(m[0]*m[8] - m[2]*m[6]) * invDet,
		(m[2]*m[3] - m[0]*m[5]) * invDet,
		(m[3]*m[7] - m[4]*m[6]) * invDet,
		(m[1]*m[6] - m[0]*m[7]) * invDet,
		(m[0]*m[4] - m[1]*m[3]) * invDet,
	}
}

// applyHomography applies a homography matrix to a point
type point struct {
	x, y float64
}

func applyHomography(H Matrix3x3, x, y float64) point {
	w := H[6]*x + H[7]*y + H[8]
	if math.Abs(w) < 1e-10 {
		return point{0, 0}
	}
	return point{
		x: (H[0]*x + H[1]*y + H[2]) / w,
		y: (H[3]*x + H[4]*y + H[5]) / w,
	}
}

// bilinearSample performs bilinear interpolation sampling
func bilinearSample(img image.Image, x, y float64, bounds image.Rectangle) color.Color {
	x0 := int(x)
	y0 := int(y)
	x1 := x0 + 1
	y1 := y0 + 1

	if x1 >= bounds.Max.X {
		x1 = bounds.Max.X - 1
	}
	if y1 >= bounds.Max.Y {
		y1 = bounds.Max.Y - 1
	}

	fx := x - float64(x0)
	fy := y - float64(y0)

	r00, g00, b00, a00 := img.At(x0, y0).RGBA()
	r01, g01, b01, a01 := img.At(x1, y0).RGBA()
	r10, g10, b10, a10 := img.At(x0, y1).RGBA()
	r11, g11, b11, a11 := img.At(x1, y1).RGBA()

	// Bilinear interpolation for each channel
	r := uint16((float64(r00)*(1-fx)*(1-fy) + float64(r01)*fx*(1-fy) +
		float64(r10)*(1-fx)*fy + float64(r11)*fx*fy))
	g := uint16((float64(g00)*(1-fx)*(1-fy) + float64(g01)*fx*(1-fy) +
		float64(g10)*(1-fx)*fy + float64(g11)*fx*fy))
	b := uint16((float64(b00)*(1-fx)*(1-fy) + float64(b01)*fx*(1-fy) +
		float64(b10)*(1-fx)*fy + float64(b11)*fx*fy))
	a := uint16((float64(a00)*(1-fx)*(1-fy) + float64(a01)*fx*(1-fy) +
		float64(a10)*(1-fx)*fy + float64(a11)*fx*fy))

	return color.RGBA64{r, g, b, a}
}

// solveLinearSystem solves an 8x8 linear system using Gaussian elimination
func solveLinearSystem(A [][]float64, b []float64) []float64 {
	n := len(A)
	M := make([][]float64, n)
	for i := range M {
		M[i] = make([]float64, n+1)
		copy(M[i], A[i])
		M[i][n] = b[i]
	}

	// Gaussian elimination with partial pivoting
	for i := 0; i < n; i++ {
		// Find pivot
		maxRow := i
		maxVal := math.Abs(M[i][i])
		for k := i + 1; k < n; k++ {
			if val := math.Abs(M[k][i]); val > maxVal {
				maxVal = val
				maxRow = k
			}
		}

		if maxVal < 1e-10 {
			return nil
		}

		// Swap rows
		M[i], M[maxRow] = M[maxRow], M[i]

		// Eliminate
		for k := i + 1; k < n; k++ {
			factor := M[k][i] / M[i][i]
			for j := i; j <= n; j++ {
				M[k][j] -= factor * M[i][j]
			}
		}
	}

	// Back substitution
	x := make([]float64, n)
	for i := n - 1; i >= 0; i-- {
		sum := M[i][n]
		for j := i + 1; j < n; j++ {
			sum -= M[i][j] * x[j]
		}
		x[i] = sum / M[i][i]
	}

	return x
}

// ApplyCrop crops an image to the specified rectangle
// x, y are the top-left coordinates, width and height are the dimensions
// imageData is a base64 encoded string
func (a *App) ApplyCrop(imageDataBase64 string, x, y, width, height int) ([]byte, error) {
	// Log received data info
	fmt.Printf("ApplyCrop received base64 string length: %d, crop region: (%d,%d,%d,%d)\n", len(imageDataBase64), x, y, width, height)

	if len(imageDataBase64) < 10 {
		return nil, fmt.Errorf("image data too small: %d bytes", len(imageDataBase64))
	}

	// Decode base64 string to bytes
	imageData, err := base64.StdEncoding.DecodeString(imageDataBase64)
	if err != nil {
		fmt.Printf("ERROR: Failed to decode base64: %v\n", err)
		return nil, fmt.Errorf("failed to decode base64 image data: %w", err)
	}

	fmt.Printf("Decoded image data size: %d bytes\n", len(imageData))

	if len(imageData) < 10 {
		return nil, fmt.Errorf("decoded image data too small: %d bytes", len(imageData))
	}

	// Log first bytes to check format
	fmt.Printf("First 10 bytes: %v\n", imageData[:10])

	// Check for PNG signature
	isPNG := len(imageData) > 8 && imageData[0] == 137 && imageData[1] == 80 && imageData[2] == 78 && imageData[3] == 71
	isJPEG := len(imageData) > 2 && imageData[0] == 255 && imageData[1] == 216
	fmt.Printf("Detected format - PNG: %v, JPEG: %v\n", isPNG, isJPEG)

	// Decode the source image
	srcImg, format, err := image.Decode(bytes.NewReader(imageData))
	if err != nil {
		fmt.Printf("ERROR: Failed to decode image: %v\n", err)
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}
	fmt.Printf("Successfully decoded %s image\n", format)

	srcBounds := srcImg.Bounds()
	srcWidth := srcBounds.Dx()
	srcHeight := srcBounds.Dy()
	fmt.Printf("Source image bounds: %v, size: %dx%d\n", srcBounds, srcWidth, srcHeight)
	fmt.Printf("Requested crop: x=%d, y=%d, width=%d, height=%d\n", x, y, width, height)

	// Validate crop bounds
	if x < 0 {
		fmt.Printf("Adjusting x from %d to 0\n", x)
		x = 0
	}
	if y < 0 {
		fmt.Printf("Adjusting y from %d to 0\n", y)
		y = 0
	}
	if x+width > srcWidth {
		oldWidth := width
		width = srcWidth - x
		fmt.Printf("Adjusting width from %d to %d (x=%d, srcWidth=%d)\n", oldWidth, width, x, srcWidth)
	}
	if y+height > srcHeight {
		oldHeight := height
		height = srcHeight - y
		fmt.Printf("Adjusting height from %d to %d (y=%d, srcHeight=%d)\n", oldHeight, height, y, srcHeight)
	}

	// Ensure valid dimensions
	if width <= 0 || height <= 0 {
		fmt.Printf("ERROR: Invalid crop dimensions after adjustment: width=%d, height=%d\n", width, height)
		return nil, fmt.Errorf("invalid crop dimensions: width=%d, height=%d", width, height)
	}

	fmt.Printf("Final crop dimensions: %dx%d at (%d,%d)\n", width, height, x, y)

	// Create destination image
	dstImg := image.NewRGBA(image.Rect(0, 0, width, height))

	// Copy pixels from source to destination
	for dstY := 0; dstY < height; dstY++ {
		for dstX := 0; dstX < width; dstX++ {
			srcX := x + dstX
			srcY := y + dstY
			c := srcImg.At(srcBounds.Min.X+srcX, srcBounds.Min.Y+srcY)
			dstImg.Set(dstX, dstY, c)
		}
	}

	// Encode result as PNG
	var buf bytes.Buffer
	if err := png.Encode(&buf, dstImg); err != nil {
		fmt.Printf("ERROR: Failed to encode PNG: %v\n", err)
		return nil, fmt.Errorf("failed to encode cropped image: %w", err)
	}

	result := buf.Bytes()
	fmt.Printf("Successfully encoded PNG, result size: %d bytes\n", len(result))
	return result, nil
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
