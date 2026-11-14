# Changelog

The Elm package `ianramosc/elm-clipboard` and the npm package `elm-clipboard` are released together and share version numbers. Both follow [semantic versioning](https://semver.org); the Elm side is checked with `elm diff`.

## 1.0.0 - 2026-11-14

First release of the Elm package and the npm package (wire protocol version 1).

### Added

- `Clipboard`: `Content` (text, HTML with plain text, PNG images from URLs, custom and `web ` formats, and `combine` for several formats in one item), `MimeType`, typed `Error`, `Permission`, `Capabilities`, `Item`.
- `Clipboard.Element`: `<elm-clipboard-copy>` copy buttons (`copyButton`, `copyFrom`) and `<elm-clipboard-paste>` zones.
- `Clipboard.Port`: `write`, `writeText`, `readText`, `read`, `permission`, `capabilities` over two user ports.
- `Clipboard.Events`: pure-Elm `onPasteFiles`, `onPasteTypes`, `onCopy`, `onCut`.
- `Clipboard.Feedback`: "Copied!" state with a timeout.
- npm: `register`, `defineElements`, `handleRequest` and the standalone functions, as ESM and IIFE builds with TypeScript types.
