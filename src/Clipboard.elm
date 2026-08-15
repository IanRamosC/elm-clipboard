module Clipboard exposing (MimeType(..), mimeTypeToString, mimeTypeFromString)

{-| Types shared by every way of using the clipboard.


# MIME types

@docs MimeType, mimeTypeToString, mimeTypeFromString

-}

-- MIME TYPES


{-| The clipboard formats browsers know about.

  - `TextPlain`, `TextHtml` and `ImagePng` work in all current browsers.
  - `ImageSvg` works in Chrome 124+ only.
  - `Web` is a custom format (Chrome 104+): `Web "application/vnd.myapp+json"`
    is written as `"web application/vnd.myapp+json"`.
  - `Other` is anything else seen when reading.

-}
type MimeType
    = TextPlain
    | TextHtml
    | ImagePng
    | ImageSvg
    | Web String
    | Other String


{-|

    mimeTypeToString (Web "text/csv") --> "web text/csv"

-}
mimeTypeToString : MimeType -> String
mimeTypeToString mime =
    case mime of
        TextPlain ->
            "text/plain"

        TextHtml ->
            "text/html"

        ImagePng ->
            "image/png"

        ImageSvg ->
            "image/svg+xml"

        Web inner ->
            "web " ++ inner

        Other raw ->
            raw


{-| Parameters such as `;charset=utf-8` are ignored, and case doesn't matter.

    mimeTypeFromString "Text/HTML; charset=utf-8" --> TextHtml

-}
mimeTypeFromString : String -> MimeType
mimeTypeFromString raw =
    let
        essence =
            raw
                |> String.split ";"
                |> List.head
                |> Maybe.withDefault raw
                |> String.trim
                |> String.toLower
    in
    case essence of
        "text/plain" ->
            TextPlain

        "text/html" ->
            TextHtml

        "image/png" ->
            ImagePng

        "image/svg+xml" ->
            ImageSvg

        _ ->
            if String.startsWith "web " essence then
                Web (String.trim (String.dropLeft 4 essence))

            else
                Other essence
