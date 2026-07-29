//go:build windows

package main

import (
	"syscall"
	"time"
	"unsafe"

	"github.com/wailsapp/wails/v2/pkg/options"
	"golang.org/x/sys/windows"
)

var (
	user32DLL = windows.NewLazySystemDLL("user32.dll")
	gdi32DLL  = windows.NewLazySystemDLL("gdi32.dll")

	procSetWindowsHookEx    = user32DLL.NewProc("SetWindowsHookExW")
	procUnhookWindowsHookEx = user32DLL.NewProc("UnhookWindowsHookEx")
	procCallNextHookEx      = user32DLL.NewProc("CallNextHookEx")
	procGetMessage          = user32DLL.NewProc("GetMessageW")
	procTranslateMessage    = user32DLL.NewProc("TranslateMessage")
	procDispatchMessage     = user32DLL.NewProc("DispatchMessageW")
	procPostThreadMessage   = user32DLL.NewProc("PostThreadMessageW")
	procGetCurrentThreadId  = user32DLL.NewProc("GetCurrentThreadId")
	procSendInput           = user32DLL.NewProc("SendInput")
	procGetSystemMetrics    = user32DLL.NewProc("GetSystemMetrics")
	procEnumDisplayMonitors = user32DLL.NewProc("EnumDisplayMonitors")
	procGetMonitorInfo      = user32DLL.NewProc("GetMonitorInfoW")
)

const (
	wmQuit     = 0x0012
	wmKeyup    = 0x0101
	wmSyskeyup = 0x0105
	vkV        = 0x56
	vkBack     = 0x08
	vkTab      = 0x09
	vk0        = 0x30
	vkA        = 0x41
	vkOemMinus = 0xBD

	// LLKHF_INJECTED from winuser.h. Ignoring injected events prevents the
	// hotkey from firing while the application is typing values.
	llkhfInjected = 0x10

	// KEYEVENTF_KEYUP from winuser.h.
	keyeventfKeyup = 0x0002

	// INPUT_KEYBOARD from winuser.h.
	inputKeyboard = 1

	smCyVirtualScreen = 79
)

// kbdLLHookStruct is the LPARAM for WH_KEYBOARD_LL callbacks.
type kbdLLHookStruct struct {
	vkCode      uint32
	scanCode    uint32
	flags       uint32
	time        uint32
	dwExtraInfo uintptr
}

// winPoint mirrors the Windows POINT structure.
type winPoint struct {
	x, y int32
}

// winRect mirrors the Windows RECT structure.
type winRect struct {
	left, top, right, bottom int32
}

// monitorInfo mirrors the Windows MONITORINFO structure.
type monitorInfo struct {
	cbSize    uint32
	rcMonitor winRect
	rcWork    winRect
	dwFlags   uint32
}

// winMsg mirrors the Windows MSG structure used by GetMessage.
type winMsg struct {
	hwnd     windows.HWND
	message  uint32
	wParam   uintptr
	lParam   uintptr
	time     uint32
	pt       winPoint
	lPrivate uint32
}

// keybdInput mirrors the Windows KEYBDINPUT structure.
type keybdInput struct {
	wVk         uint16
	wScan       uint16
	dwFlags     uint32
	time        uint32
	dwExtraInfo uintptr
}

// input mirrors the Windows INPUT structure for keyboard input. The trailing
// padding ensures the struct has the same size as the INPUT union on amd64.
type input struct {
	type_ uint32
	_     [4]byte
	ki    keybdInput
	_     [8]byte
}

// windowsPlatform implements platform for Windows builds without relying on
// the CGO-heavy robotgo/gohook libraries, which have been observed to cause
// undefined behavior and crashes.
type windowsPlatform struct {
	maxDisplayHeight int
}

// Compile-time check that windowsPlatform implements platform.
var _ platform = (*windowsPlatform)(nil)

// newPlatform returns the Windows-specific platform implementation, scanning
// connected displays for the largest vertical resolution.
func newPlatform() platform {
	return &windowsPlatform{
		maxDisplayHeight: getLargestDisplayHeight(),
	}
}

// referenceHeight returns the largest display height as the reference for
// graph coordinate translation on Windows.
func (p *windowsPlatform) referenceHeight(windowHeight int) int {
	if p.maxDisplayHeight > 0 {
		return p.maxDisplayHeight
	}
	return windowHeight
}

// startHotkeyListener registers a low-level keyboard hook for the V key and
// triggers the paste handler when it is released. This avoids the
// CGO-dependent gohook library.
func (p *windowsPlatform) startHotkeyListener(app *App, stopChan <-chan struct{}) {
	callback := syscall.NewCallback(func(nCode int32, wParam uintptr, lParam unsafe.Pointer) uintptr {
		if nCode >= 0 && (wParam == wmKeyup || wParam == wmSyskeyup) {
			kbd := (*kbdLLHookStruct)(lParam)
			// Trigger on the V key release. Ignore injected keystrokes so
			// that typing values does not re-trigger the paste action.
			if kbd.vkCode == vkV && kbd.flags&llkhfInjected == 0 {
				go app.typeMonthlyValues()
			}
		}
		r, _, _ := procCallNextHookEx.Call(0, uintptr(nCode), wParam, uintptr(lParam))
		return r
	})

	// WH_KEYBOARD_LL = 13
	hHook, err := p.setWindowsHookEx(13, callback, 0, 0)
	if err != nil {
		return
	}

	go func() {
		<-stopChan
		procUnhookWindowsHookEx.Call(hHook)
		// Break the message loop below so the goroutine can exit.
		threadID, _, _ := procGetCurrentThreadId.Call()
		procPostThreadMessage.Call(threadID, wmQuit, 0, 0)
	}()

	var msg winMsg
	for {
		ret, _, _ := procGetMessage.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
		// 0 means WM_QUIT was received; -1 means an error.
		if ret == 0 || ret == uintptr(^uint32(0)) {
			break
		}
		procTranslateMessage.Call(uintptr(unsafe.Pointer(&msg)))
		procDispatchMessage.Call(uintptr(unsafe.Pointer(&msg)))
	}
}

func (p *windowsPlatform) setWindowsHookEx(idHook int32, lpfn uintptr, hMod windows.Handle, dwThreadID uint32) (uintptr, error) {
	r, _, err := procSetWindowsHookEx.Call(uintptr(idHook), lpfn, uintptr(hMod), uintptr(dwThreadID))
	if r == 0 {
		return 0, err
	}
	return r, nil
}

// typeValues types the provided values into the focused application, sending
// backspace+tab for zero values and tab between values.
func (p *windowsPlatform) typeValues(values []string) error {
	// Clear the current field.
	sendKey(vkBack)

	for i, value := range values {
		if value == "0" {
			sendKey(vkBack)
			sendKey(vkTab)
		} else {
			for _, r := range value {
				switch {
				case r >= '0' && r <= '9':
					sendKey(vk0 + uint16(r-'0'))
				case r >= 'A' && r <= 'Z':
					sendKey(vkA + uint16(r-'A'))
				case r >= 'a' && r <= 'z':
					sendKey(vkA + uint16(r-'a'))
				case r == '-':
					sendKey(vkOemMinus)
				}
			}
			if i < len(values)-1 {
				sendKey(vkTab)
			}
		}
		time.Sleep(10 * time.Millisecond)
	}

	return nil
}

func sendKey(vk uint16) {
	sendKeyEvent(vk, 0)
	time.Sleep(1 * time.Millisecond)
	sendKeyEvent(vk, keyeventfKeyup)
	time.Sleep(1 * time.Millisecond)
}

func sendKeyEvent(vk uint16, flags uint32) {
	in := input{
		type_: inputKeyboard,
		ki: keybdInput{
			wVk:     vk,
			dwFlags: flags,
		},
	}
	procSendInput.Call(1, uintptr(unsafe.Pointer(&in)), unsafe.Sizeof(in))
}

// getLargestDisplayHeight returns the largest vertical resolution among all
// connected monitors. Falls back to the virtual screen height if enumeration
// fails.
func getLargestDisplayHeight() int {
	maxHeight := 0

	monitorCallback := syscall.NewCallback(
		func(hMonitor uintptr, hdcMonitor uintptr, lprcMonitor *winRect, dwData uintptr) uintptr {
			mi := monitorInfo{cbSize: uint32(unsafe.Sizeof(monitorInfo{}))}
			r, _, _ := procGetMonitorInfo.Call(hMonitor, uintptr(unsafe.Pointer(&mi)))
			if r != 0 {
				h := int(mi.rcMonitor.bottom - mi.rcMonitor.top)
				if h > maxHeight {
					maxHeight = h
				}
			}
			return 1 // continue enumeration
		},
	)

	procEnumDisplayMonitors.Call(0, 0, monitorCallback, 0)

	if maxHeight > 0 {
		return maxHeight
	}

	// Fallback to the virtual screen height.
	r, _, _ := procGetSystemMetrics.Call(smCyVirtualScreen)
	return int(r)
}

// configurePlatformOptions applies Windows-specific Wails options. Currently
// no additional options are required beyond the cross-platform defaults.
func configurePlatformOptions(opts *options.App) {
	// Intentionally left empty for future Windows-specific options.
}
