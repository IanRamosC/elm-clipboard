module ClipboardTest exposing (suite)

import Clipboard exposing (MimeType(..))
import Clipboard.Internal.Content as Content exposing (Source(..))
import Expect
import Fuzz
import Test exposing (Test, describe, fuzz, test)


mimes : Clipboard.Content -> List ( String, Source )
mimes content =
    Content.representations content |> List.map (\rep -> ( rep.mime, rep.source ))


suite : Test
suite =
    describe "Clipboard"
        [ describe "content"
            [ test "html always carries a plain-text version first" <|
                \() ->
                    mimes (Clipboard.html { html = "<b>a</b>", plainText = "a" })
                        |> Expect.equal [ ( "text/plain", Inline "a" ), ( "text/html", Inline "<b>a</b>" ) ]
            , test "imageUrl is PNG from a URL" <|
                \() ->
                    mimes (Clipboard.imageUrl "data:image/png;base64,AA")
                        |> Expect.equal [ ( "image/png", FromUrl "data:image/png;base64,AA" ) ]
            ]
        , describe "MIME types"
            [ test "known types round-trip" <|
                \() ->
                    [ TextPlain, TextHtml, ImagePng, ImageSvg, Web "text/csv", Other "image/jpeg" ]
                        |> List.map (Clipboard.mimeTypeToString >> Clipboard.mimeTypeFromString)
                        |> Expect.equal [ TextPlain, TextHtml, ImagePng, ImageSvg, Web "text/csv", Other "image/jpeg" ]
            , test "parameters and case are ignored" <|
                \() ->
                    Clipboard.mimeTypeFromString " Text/HTML; charset=utf-8"
                        |> Expect.equal TextHtml
            , fuzz Fuzz.string "parsing never crashes and is stable" <|
                \raw ->
                    let
                        once =
                            Clipboard.mimeTypeFromString raw
                    in
                    Clipboard.mimeTypeFromString (Clipboard.mimeTypeToString once)
                        |> Expect.equal once
            ]
        ]
