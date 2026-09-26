module Clipboard.Events exposing
    ( onPasteFiles, onPasteTypes
    , onCopy, onCut
    , pastedFilesDecoder
    )

{-| Clipboard events that Elm can decode **without any JavaScript**.

Pasted files (such as screenshots) and the list of pasted formats can be read
in pure Elm. Pasted _text_ can't, because it needs a method call
(`clipboardData.getData`); use [`Clipboard.Element.pasteZone`](Clipboard-Element#pasteZone)
for that.


# Paste

@docs onPasteFiles, onPasteTypes


# Copy and cut

@docs onCopy, onCut


# Decoders

@docs pastedFilesDecoder

-}

import Clipboard exposing (MimeType)
import File exposing (File)
import Html exposing (Attribute)
import Html.Events
import Json.Decode as Decode exposing (Decoder)


{-| Fires when one or more files are pasted. Pastes without files (plain
text) are ignored and behave normally.

    textarea [ Clipboard.Events.onPasteFiles GotScreenshots ] []

-}
onPasteFiles : (List File -> msg) -> Attribute msg
onPasteFiles toMsg =
    Html.Events.on "paste" (Decode.map toMsg pastedFilesDecoder)


{-| Fires on every paste with the formats being pasted, for example to show
"Paste as rich text?" only when HTML is available.
-}
onPasteTypes : (List MimeType -> msg) -> Attribute msg
onPasteTypes toMsg =
    Html.Events.on "paste"
        (Decode.at [ "clipboardData", "types" ] (Decode.list (Decode.map Clipboard.mimeTypeFromString Decode.string))
            |> Decode.map toMsg
        )


{-| Fires when the user copies (Ctrl+C / ⌘C or the menu) inside this element.
The copied data itself can't be changed from Elm.
-}
onCopy : msg -> Attribute msg
onCopy msg =
    Html.Events.on "copy" (Decode.succeed msg)


{-| Like [`onCopy`](#onCopy), for cut.
-}
onCut : msg -> Attribute msg
onCut msg =
    Html.Events.on "cut" (Decode.succeed msg)


{-| The files of a `paste` event. It fails when there are none, so the event
is ignored. Use it with `Html.Events.custom` to also stop the browser's own
paste.
-}
pastedFilesDecoder : Decoder (List File)
pastedFilesDecoder =
    Decode.at [ "clipboardData", "files" ] (Decode.list File.decoder)
        |> Decode.andThen
            (\files ->
                if List.isEmpty files then
                    Decode.fail "no pasted files"

                else
                    Decode.succeed files
            )
