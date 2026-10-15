# elm-clipboard

[![CI](https://github.com/IanRamosC/elm-clipboard/actions/workflows/ci.yml/badge.svg)](https://github.com/IanRamosC/elm-clipboard/actions/workflows/ci.yml)
[![Elm package](https://img.shields.io/elm-package/v/ianramosc/elm-clipboard)](https://package.elm-lang.org/packages/ianramosc/elm-clipboard/latest/)
[![npm](https://img.shields.io/npm/v/elm-clipboard)](https://www.npmjs.com/package/elm-clipboard)

Typed clipboard access for Elm 0.19.x: copy buttons, reading, rich text, images and paste events.

Elm packages can't call browser APIs, so this comes in two parts that are released together:

- the Elm package `ianramosc/elm-clipboard`
- the npm package [`elm-clipboard`](https://www.npmjs.com/package/elm-clipboard) (about 4 KB gzipped, no dependencies)

```sh
elm install ianramosc/elm-clipboard
npm install elm-clipboard
```

## Which part do I need?

| You want to… | Use | JavaScript needed |
|---|---|---|
| Show a "Copy" button | `Clipboard.Element.copyButton` / `copyFrom` | `defineElements()` |
| Copy after something else happens (an HTTP response, a menu) | `Clipboard.Port.write` / `writeText` | `register(...)` with two ports |
| Read the clipboard, check permissions or support | `Clipboard.Port.read` / `readText` / `permission` / `capabilities` | `register(...)` |
| Get pasted text and HTML | `Clipboard.Element.pasteZone` | `defineElements()` |
| Get pasted files (screenshots) | `Clipboard.Events.onPasteFiles` | none |
| Show "Copied!" for a moment | `Clipboard.Feedback` | none |

**Prefer the copy button.** Safari and Firefox only allow a clipboard write while a click or key press is being handled. The custom element copies inside its own click handler, so it always qualifies. Port commands from `update` usually qualify too, because Elm runs them in the same event, but Elm doesn't promise this.

## Copy button

```elm
import Clipboard
import Clipboard.Element
import Clipboard.Feedback as Feedback

view model =
    Clipboard.Element.copyButton [ class "copy" ]
        { content = Clipboard.text model.inviteLink
        , onResult = Copied
        }
        [ text
            (if Feedback.isCopied model.feedback then
                "Copied!"

             else
                "Copy link"
            )
        ]
```

```js
import { defineElements } from "elm-clipboard";

defineElements();
Elm.Main.init({ node: document.getElementById("app") });
```

The element behaves like a button: `role="button"` and `tabindex="0"` (unless you set them), Enter and Space copy, and `aria-disabled="true"` disables it.

## Ports

```elm
port module Main exposing (main)

import Clipboard
import Clipboard.Port
import Json.Encode

port clipboardOut : Json.Encode.Value -> Cmd msg

port clipboardIn : (Json.Encode.Value -> msg) -> Sub msg

clipboard : Clipboard.Port.Ports msg
clipboard =
    { send = clipboardOut, receive = clipboardIn }

-- in update
Clipboard.Port.write clipboard
    { id = "order"
    , content = Clipboard.html { html = "<b>Order #42</b> shipped", plainText = "Order #42 shipped" }
    }

-- in subscriptions
Clipboard.Port.subscription clipboard GotClipboard
```

```js
import { register } from "elm-clipboard";

const app = Elm.Main.init({ node: document.getElementById("app") });
register(app.ports.clipboardOut, app.ports.clipboardIn);
```

Every request gets exactly one reply with the same `id`, either `Ok` or a typed `Clipboard.Error` (`NotAllowed`, `DocumentNotFocused`, `InsecureContext`, `TypeNotSupported`, …).

## Copying images and files

`Clipboard.imageUrl` copies an image as PNG; other formats are converted. Elm can't send a `File` through a port, so to copy a picked or pasted file, turn it into a `data:` URL with `File.toUrl` first.

## Browser support

| Feature | Chrome | Firefox | Safari |
|---|---|---|---|
| Copy text | 66 | 63 | 13.1 |
| Read text | 66 | 125 | 13.1 |
| HTML, PNG, read everything | 76 | 127 | 13.1 |
| `ClipboardItem.supports()` (exact `capabilities`) | 121 | 127 | 18.4 |
| `web ` custom formats | 104 | – | – |

The clipboard API needs HTTPS (or `localhost`). On plain `http://` pages, text and HTML copies fall back to `document.execCommand("copy")`; everything else fails with `InsecureContext`.

## Development

```sh
elm-test                      # Elm tests
elm-review                    # lint and docs checks
node scripts/gen-fixtures.mjs # after editing fixtures/protocol.json
cd js
npm test                      # TypeScript unit tests (happy-dom)
npm run e2e:prepare && npm run e2e   # Playwright: Chromium, Firefox, WebKit
```

`fixtures/protocol.json` is the wire protocol's single source of truth: the Elm tests check that the Elm encoders produce it, and the TypeScript tests check that the JS handler produces the replies in it.

## Credits

Practices adopted from `@github/clipboard-copy-element` (accessibility defaults, `for=`), clipboard-polyfill (Promise-based `ClipboardItem` for Safari, text+HTML together), copy-to-clipboard (selection restore), VueUse `useClipboard` (copied-state timeout) and usehooks-ts (never throw; always reply).

## License

BSD-3-Clause
