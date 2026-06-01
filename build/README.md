# App icons (electron-builder `buildResources`)

`electron-builder.yml` points the packaged app + installer icons here. Drop the
following files into this `build/` folder (exact names matter):

| File                | Platform | Required size(s)                                  |
|---------------------|----------|---------------------------------------------------|
| `build/icon.ico`    | Windows  | Multi-resolution ICO; **must include 256x256** (ideally 16, 24, 32, 48, 64, 128, 256) |
| `build/icon.icns`   | macOS    | Up to 1024x1024 (512@2x)                          |
| `build/icon.png`    | Linux    | 512x512 or 1024x1024                              |

## Source artwork guidance
- Start from a single **1024x1024 PNG**, square, **transparent background**.
- Do **not** pre-round the corners — macOS applies its own rounded mask.
- Keep ~10% padding around the logo so it isn't clipped.

## Generating the formats from one PNG
If you only have a `source.png` (1024x1024), generate all three with:

```
# one-off, no install:
npx electron-icon-builder --input=source.png --output=build --flatten
```

That produces an `icons/` set; copy/rename to `build/icon.ico`, `build/icon.icns`,
and `build/icon.png`. (On Windows-only, `build/icon.ico` is the one that matters.)

Alternatively, use any image tool / online converter to export a 256x256+ `.ico`.

After adding the icons, run `npm run electron:build`. The log line
`default Electron icon is used` should disappear.
