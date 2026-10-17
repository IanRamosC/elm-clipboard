# elm-clipboard (npm)

The JavaScript side of the Elm package [`ianramosc/elm-clipboard`](https://package.elm-lang.org/packages/ianramosc/elm-clipboard/latest/). Install both, with the same major version.

```js
import { register, defineElements } from "elm-clipboard";

const app = Elm.Main.init({ node: document.getElementById("app") });

// Ports (Clipboard.Port). Also defines the custom elements.
register(app.ports.clipboardOut, app.ports.clipboardIn);

// Or only the custom elements (Clipboard.Element):
defineElements();
```

Without a bundler, load `elm-clipboard/dist/elm-clipboard.iife.js`; it exposes `window.ElmClipboard`.

## Options

`register(out, in, options)` and `defineElements(options)` accept:

| Option | Default | |
|---|---|---|
| `legacyFallback` | `true` | Copy with `document.execCommand("copy")` where `navigator.clipboard` is missing (plain `http://`, old browsers). |
| `normalizeWhitespace` | `false` | Copy non-breaking and other special spaces as normal spaces, and drop zero-width characters. |
| `defineElements` | `true` | (`register` only) Also define `<elm-clipboard-copy>` and `<elm-clipboard-paste>`. |

## Without Elm

The functions work on their own and never throw; they resolve to `{ ok: true, value }` or `{ ok: false, error }`:
`writeText`, `writeContent`, `readText`, `read`, `permission`, `capabilities`, and `handleRequest` for custom port wiring (elm-ts-interop, elm-concurrent-task). Types for the wire protocol are exported from the package.

## Events

| Element | Event | `detail` |
|---|---|---|
| `<elm-clipboard-copy>` | `elm-clipboard:copy` | `{}` |
| `<elm-clipboard-copy>` | `elm-clipboard:error` | `{ code, name, message, type? }` |
| `<elm-clipboard-paste>` | `elm-clipboard:paste` | `{ types, text, html, files }` |

Names are prefixed so they never mix with GitHub's `clipboard-copy` event on the same page.
