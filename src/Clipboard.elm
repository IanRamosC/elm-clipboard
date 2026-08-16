module Clipboard exposing
    ( MimeType(..), mimeTypeToString, mimeTypeFromString
    , Item
    , Error(..), errorToString
    , Permission(..), Capabilities
    )

{-| Types shared by every way of using the clipboard.


# MIME types

@docs MimeType, mimeTypeToString, mimeTypeFromString


# Reading

@docs Item


# Errors

@docs Error, errorToString


# Permissions and support

@docs Permission, Capabilities

-}

import File exposing (File)



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



-- READING


{-| One item read from the clipboard. Usually there is a single item.

  - `types` lists every format the item has.
  - `text` and `html` hold the `text/plain` and `text/html` data.
  - `files` holds everything else (images, custom formats) as `File`s, ready
    for [`File.toBytes`](https://package.elm-lang.org/packages/elm/file/latest/File#toBytes),
    `File.toUrl` or an upload with `Http.fileBody`.

-}
type alias Item =
    { types : List MimeType
    , text : Maybe String
    , html : Maybe String
    , files : List File
    }



-- ERRORS


{-| Why a clipboard operation failed.

  - `NotSupported`: the browser has no clipboard API for this, and the
    fallback couldn't help.
  - `InsecureContext`: the page isn't served over HTTPS (or `localhost`).
    Plain-text copies still work there through a fallback; everything else fails.
  - `NotAllowed`: the user or the browser refused, usually because there was no
    click or key press just before, or a read permission was denied.
  - `DocumentNotFocused`: Chrome refuses while focus is elsewhere, for example in
    the developer tools.
  - `TypeNotSupported`: the browser can't write this MIME type.
  - `DataError`: the content couldn't be prepared, for example an image URL that
    failed to load.
  - `Unknown`: anything else, with the browser's error name and message.

-}
type Error
    = NotSupported
    | InsecureContext
    | NotAllowed
    | DocumentNotFocused
    | TypeNotSupported MimeType
    | DataError String
    | Unknown { name : String, message : String }


{-| A message suitable for logs. Write your own text for users.
-}
errorToString : Error -> String
errorToString error =
    case error of
        NotSupported ->
            "This browser doesn't support this clipboard operation."

        InsecureContext ->
            "The clipboard is only available on secure (HTTPS) pages."

        NotAllowed ->
            "Clipboard access was not allowed. It usually needs a click or key press first."

        DocumentNotFocused ->
            "The page must be focused to use the clipboard."

        TypeNotSupported mime ->
            "This browser can't put " ++ mimeTypeToString mime ++ " on the clipboard."

        DataError message ->
            "The clipboard content couldn't be prepared: " ++ message

        Unknown { name, message } ->
            name ++ ": " ++ message



-- PERMISSIONS


{-| The state of a clipboard permission.

`Unavailable` means the browser can't tell. Only Chromium-based browsers
answer this question; Firefox and Safari ask the user at the moment of
reading instead (a "Paste" menu).

-}
type Permission
    = Granted
    | Denied
    | Prompt
    | Unavailable


{-| What the current browser and page can do.

`supportedTypes` lists the MIME types that can be written. On browsers with
`ClipboardItem.supports()` (Chrome 121+, Firefox 127+, Safari 18.4+) this is
exact; elsewhere it is the usual set for that API level.

-}
type alias Capabilities =
    { secureContext : Bool
    , asyncClipboard : Bool
    , clipboardItem : Bool
    , permissionsQuery : Bool
    , supportedTypes : List MimeType
    }
