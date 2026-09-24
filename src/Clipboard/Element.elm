module Clipboard.Element exposing
    ( copyButton, copyFrom
    , pasteZone
    )

{-| Copy buttons and paste zones built on two custom elements from the
`elm-clipboard` npm package:

```js
import { defineElements } from "elm-clipboard";
defineElements(); // also done by register()
```

The copy happens in the element's own click handler, so it always counts as
a user action, which Safari and Firefox require. No ports are needed.

The copy button behaves like a button: it gets `role="button"` and
`tabindex="0"` unless you set them, and Enter or Space copies. Add
`Html.Attributes.attribute "aria-disabled" "true"` to disable it.


# Copy

@docs copyButton, copyFrom


# Paste

@docs pasteZone

-}

import Clipboard exposing (Content, Error, Item)
import Clipboard.Internal.Protocol as Protocol
import Html exposing (Attribute, Html)
import Html.Attributes
import Html.Events
import Json.Decode as Decode exposing (Decoder)
import Json.Encode


{-| A button that copies `content` when clicked.

    Clipboard.Element.copyButton [ class "copy" ]
        { content = Clipboard.text model.inviteLink
        , onResult = Copied
        }
        [ text "Copy link" ]

Pair it with [`Clipboard.Feedback`](Clipboard-Feedback) to show "Copied!" for
a moment.

-}
copyButton :
    List (Attribute msg)
    -> { content : Content, onResult : Result Error () -> msg }
    -> List (Html msg)
    -> Html msg
copyButton attributes config children =
    Html.node "elm-clipboard-copy"
        (attributes
            ++ Html.Attributes.property "content" (Protocol.encodeContent config.content)
            :: resultEvents config.onResult
        )
        children


{-| A button that copies the text of the element with this `id`, read at the
moment of the click: an input's or text area's value, a link's `href`, or
any other element's text.

    div []
        [ pre [ id "snippet" ] [ text code ]
        , Clipboard.Element.copyFrom []
            { target = "snippet", onResult = Copied }
            [ text "Copy" ]
        ]

-}
copyFrom :
    List (Attribute msg)
    -> { target : String, onResult : Result Error () -> msg }
    -> List (Html msg)
    -> Html msg
copyFrom attributes config children =
    Html.node "elm-clipboard-copy"
        (attributes
            ++ Html.Attributes.attribute "for" config.target
            :: resultEvents config.onResult
        )
        children


resultEvents : (Result Error () -> msg) -> List (Attribute msg)
resultEvents onResult =
    [ Html.Events.on "elm-clipboard:copy" (Decode.succeed (onResult (Ok ())))
    , Html.Events.on "elm-clipboard:error" (Decode.map (Err >> onResult) detailErrorDecoder)
    ]


detailErrorDecoder : Decoder Error
detailErrorDecoder =
    Decode.field "detail" Protocol.errorDecoder


{-| A wrapper that reports everything pasted inside it: text, HTML and files
(such as screenshots). Wrap a text area, or give the zone `tabindex "0"` so
it can be focused and pasted into directly.

    Clipboard.Element.pasteZone [ tabindex 0, class "drop" ]
        { onPaste = Pasted, preventDefault = False }
        [ textarea [] [] ]

With `preventDefault = True` the browser's own paste doesn't happen, so a
pasted screenshot can be uploaded without its text also landing in the text
area. For files only, [`Clipboard.Events.onPasteFiles`](Clipboard-Events#onPasteFiles)
works without JavaScript.

-}
pasteZone :
    List (Attribute msg)
    -> { onPaste : Item -> msg, preventDefault : Bool }
    -> List (Html msg)
    -> Html msg
pasteZone attributes config children =
    Html.node "elm-clipboard-paste"
        (attributes
            ++ [ Html.Attributes.property "preventPaste" (Json.Encode.bool config.preventDefault)
               , Html.Events.on "elm-clipboard:paste"
                    (Decode.field "detail" Protocol.itemDecoder |> Decode.map config.onPaste)
               ]
        )
        children
