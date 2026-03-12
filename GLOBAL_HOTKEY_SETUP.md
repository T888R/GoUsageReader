# UsageReader - Global Hotkey Setup

This document describes how to set up the global hotkey functionality for UsageReader on Linux.

## Global Hotkey Feature

UsageReader now supports a global hotkey (`Alt+V`) that allows you to paste the calculated monthly values directly into any application, even when UsageReader is not the focused window.

### How It Works

1. Complete the usage reading process for all 12 months
2. When prompted, press `Alt+V` while the target application (e.g., browser) is focused
3. The values will be automatically typed with tabs separating each month
4. The application will reset automatically after pasting

## Linux Requirements (X11)

The global hotkey and keyboard simulation features require special permissions on Linux systems.

### Required Setup

#### 1. Install System Dependencies

On Debian/Ubuntu:
```bash
sudo apt-get install libx11-dev xorg-dev libxtst-dev
sudo apt-get install libxcb-xkb-dev x11-xkb-utils libx11-xcb-dev libxkbcommon-x11-dev libxkbcommon-dev
```

On Fedora/RHEL:
```bash
sudo dnf install libX11-devel libXtst-devel libxkbcommon-devel libxkbcommon-x11-devel
```

On Arch Linux:
```bash
sudo pacman -S libx11 libxtst libxkbcommon libxkbcommon-x11
```

#### 2. Add User to uinput Group (REQUIRED)

The keyboard simulation feature requires access to the `uinput` device. You must add your user to the `uinput` group:

```bash
# Create the uinput group if it doesn't exist
sudo groupadd -f uinput

# Add your user to the uinput group
sudo usermod -a -G uinput $USER

# Create udev rule for uinput permissions
echo 'KERNEL=="uinput", GROUP="uinput", MODE="0660"' | sudo tee /etc/udev/rules.d/99-uinput.rules

# Reload udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```

**IMPORTANT**: You must log out and log back in for the group changes to take effect.

#### 3. Verify Setup

After logging back in, verify that your user is in the uinput group:

```bash
groups | grep uinput
```

You should see `uinput` in the output.

### Troubleshooting

#### "Permission denied" when using global hotkey

If you get permission errors, ensure:
1. You've added your user to the `uinput` group
2. You've logged out and back in
3. The udev rules are properly loaded

You can test uinput access with:
```bash
ls -la /dev/uinput
# Should show: crw-rw---- 1 root uinput ...
```

#### Global hotkey not working

1. Ensure you're running an X11 session (not Wayland). Check with:
   ```bash
   echo $XDG_SESSION_TYPE
   # Should output: x11
   ```

2. If using Wayland, you may need to run UsageReader under XWayland compatibility mode

3. Check if another application is already using `Alt+V`

#### Build errors

Ensure you have CGO enabled:
```bash
export CGO_ENABLED=1
```

## Windows

On Windows, no special setup is required. The global hotkey should work immediately after building and running the application.

## Security Notes

- The global hotkey listens system-wide for `Alt+V`
- Keyboard simulation requires elevated permissions on Linux
- Only use this feature in trusted environments
- The hotkey only triggers when all 12 monthly values have been captured and will only paste once per session

## Development

### Building

Standard Wails build:
```bash
wails build
```

For development with hot reload:
```bash
wails dev
```

### Dependencies

- `github.com/go-vgo/robotgo` - Cross-platform keyboard simulation
- `github.com/robotn/gohook` - Global hotkey listener (via libuiohook)

Both libraries require CGO and have native dependencies as documented above.
