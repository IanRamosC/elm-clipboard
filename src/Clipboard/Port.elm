module Clipboard.Port exposing
    ( Ports
    , write, writeText
    , readText, read
    , Access(..), permission, capabilities
    )

{-| Use the clipboard through two ports you declare.

Use this for anything a copy button can't do: copying after an HTTP response,
reading, checking permissions. For plain copy buttons prefer
[`Clipboard.Element`](Clipboard-Element), which works even where the browser is
strict about requiring a click.


## Setup

Published packages can't declare ports, so your app declares two:

    port module Main exposing (main)

    import Clipboard.Port
    import Json.Encode

    port clipboardOut : Json.Encode.Value -> Cmd msg

    port clipboardIn : (Json.Encode.Value -> msg) -> Sub msg

    clipboard : Clipboard.Port.Ports msg
    clipboard =
        { send = clipboardOut, receive = clipboardIn }

and connects them in JavaScript:

```js
import { register } from "elm-clipboard";

const app = Elm.Main.init({ node: document.getElementById("app") });
register(app.ports.clipboardOut, app.ports.clipboardIn);
```

Every request carries an `id` you choose. Exactly one reply comes back for it.

@docs Ports


# Writing

Call these from `update` in response to a click or key press. Browsers
other than Chrome refuse clipboard writes that don't follow a user action.

@docs write, writeText


# Reading

Reading asks the user: Chrome shows a permission prompt the first time,
Firefox and Safari show a "Paste" button next to the cursor.

@docs readText, read


# Permissions and support

@docs Access, permission, capabilities

-}

import Clipboard exposing (Content)
import Clipboard.Internal.Protocol as Protocol exposing (Request(..))
import Json.Encode exposing (Value)


{-| Your two ports.
-}
type alias Ports msg =
    { send : Value -> Cmd msg
    , receive : (Value -> msg) -> Sub msg
    }


{-| Write any [`Content`](Clipboard#Content): HTML, images, custom formats.

    Clipboard.Port.write clipboard
        { id = "share-link"
        , content = Clipboard.text model.shareUrl
        }

-}
write : Ports msg -> { id : String, content : Content } -> Cmd msg
write ports { id, content } =
    ports.send (Protocol.encodeRequest id (Write content))


{-| Write plain text. Same as `write` with `Clipboard.text`, but it also works
on non-HTTPS pages through a fallback.
-}
writeText : Ports msg -> { id : String, text : String } -> Cmd msg
writeText ports { id, text } =
    ports.send (Protocol.encodeRequest id (WriteText text))


{-| Read the clipboard as plain text. An empty clipboard gives `Ok ""`.
-}
readText : Ports msg -> { id : String } -> Cmd msg
readText ports { id } =
    ports.send (Protocol.encodeRequest id ReadText)


{-| Read every format on the clipboard, including images, as a list of
[`Item`](Clipboard#Item)s. Falls back to plain text on browsers without
`clipboard.read()`.
-}
read : Ports msg -> { id : String } -> Cmd msg
read ports { id } =
    ports.send (Protocol.encodeRequest id Read)


{-| Which permission to check.
-}
type Access
    = ReadAccess
    | WriteAccess


{-| Check a permission without asking the user. Only Chromium-based browsers
answer; others reply `Unavailable`.
-}
permission : Ports msg -> { id : String, access : Access } -> Cmd msg
permission ports { id, access } =
    ports.send (Protocol.encodeRequest id (QueryPermission { read = access == ReadAccess }))


{-| Find out what this browser and page support, for example to hide an
"Copy image" button where it can't work.
-}
capabilities : Ports msg -> { id : String } -> Cmd msg
capabilities ports { id } =
    ports.send (Protocol.encodeRequest id QueryCapabilities)
