module ProtocolTest exposing (suite)

import Clipboard exposing (Error(..), MimeType(..), Permission(..))
import Clipboard.Internal.Protocol as Protocol exposing (Request(..))
import Clipboard.Port exposing (Response(..))
import Expect
import Json.Decode as Decode
import Json.Encode as Encode
import ProtocolFixtures exposing (fixture, replies, requests)
import Test exposing (Test, describe, test)


{-| Elm's encoder must produce exactly the fixture JSON, key order included,
because the TypeScript tests run the same fixtures through the JS handler.
-}
encodesTo : String -> String -> Request -> Test
encodesTo name id request =
    test ("encodes " ++ name) <|
        \() ->
            Encode.encode 0 (Protocol.encodeRequest id request)
                |> Expect.equal (fixture name requests)


decodes : String -> Response -> Test
decodes name expected =
    test ("decodes " ++ name) <|
        \() ->
            fixture name replies
                |> Decode.decodeString Decode.value
                |> Result.mapError Decode.errorToString
                |> Result.andThen (Clipboard.Port.decodeReply >> Result.mapError Decode.errorToString)
                |> Result.map .response
                |> Expect.equal (Ok expected)


suite : Test
suite =
    describe "protocol v1"
        [ describe "requests"
            [ encodesTo "writeText" "copy-1" (WriteText "hello")
            , encodesTo "writeHtml" "copy-2" (Write (Clipboard.html { html = "<b>Order #42</b> shipped", plainText = "Order #42 shipped" }))
            , encodesTo "writeImage" "copy-3" (Write (Clipboard.imageUrl "https://example.com/chart.png"))
            , encodesTo "writeCustom"
                "copy-4"
                (Write (Clipboard.custom (Web "application/vnd.myapp+json") "{\"id\":42}"))
            , encodesTo "readText" "read-1" ReadText
            , encodesTo "read" "read-2" Read
            , encodesTo "permissionRead" "perm-1" (QueryPermission { read = True })
            , encodesTo "permissionWrite" "perm-2" (QueryPermission { read = False })
            , encodesTo "capabilities" "caps-1" QueryCapabilities
            ]
        , describe "replies"
            [ decodes "wrote" (Wrote (Ok ()))
            , decodes "notAllowed" (Wrote (Err NotAllowed))
            , decodes "notFocused" (Wrote (Err DocumentNotFocused))
            , decodes "typeNotSupported" (Wrote (Err (TypeNotSupported (Web "application/vnd.myapp+json"))))
            , decodes "dataError" (Wrote (Err (DataError "loading https://example.com/chart.png failed with HTTP 404")))
            , decodes "unknownError" (Wrote (Err (Unknown { name = "AbortError", message = "The operation was aborted." })))
            , decodes "gotText" (GotText (Ok "hello"))
            , decodes "gotItems"
                (GotItems
                    (Ok [ { types = [ TextPlain, TextHtml ], text = Just "Hi", html = Just "<b>Hi</b>", files = [] } ])
                )
            , decodes "gotPermission" (GotPermission (Ok Granted))
            , decodes "gotCapabilities"
                (GotCapabilities
                    (Ok
                        { secureContext = True
                        , asyncClipboard = True
                        , clipboardItem = True
                        , permissionsQuery = True
                        , supportedTypes = [ TextPlain, TextHtml, ImagePng ]
                        }
                    )
                )
            , test "keeps the request id" <|
                \() ->
                    fixture "gotText" replies
                        |> Decode.decodeString (Decode.map Clipboard.Port.decodeReply Decode.value)
                        |> Result.map (Result.map .id)
                        |> Expect.equal (Ok (Ok "read-1"))
            ]
        ]
