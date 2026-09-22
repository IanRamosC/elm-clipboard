module Clipboard.Element exposing (copyButton, copyFrom)

{-| Copy buttons built on a custom element from the
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

-}

import Clipboard exposing (Content, Error)
import Clipboard.Internal.Protocol as Protocol
import Html exposing (Attribute, Html)
import Html.Attributes
import Html.Events
import Json.Decode as Decode exposing (Decoder)


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
