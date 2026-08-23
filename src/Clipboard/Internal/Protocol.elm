module Clipboard.Internal.Protocol exposing
    ( Request(..)
    , capabilitiesDecoder
    , encodeContent
    , encodeRequest
    , errorDecoder
    , itemDecoder
    , outcome
    , permissionDecoder
    , version
    )

{-| Wire protocol version 1, shared with the `elm-clipboard` npm package.
`js/src/protocol.ts` describes the same shapes in TypeScript. Change both
together and bump `version` on any incompatible change.

Request: `{ v, id, op, payload }`
Reply: `{ v, id, op, ok }` or `{ v, id, op, error: { code, name, message, type? } }`
(decoded in `Clipboard.Port`, because its `Response` type must be exposed there)

-}

import Clipboard exposing (Capabilities, Error(..), Item, MimeType, Permission(..))
import Clipboard.Internal.Content as Content exposing (Content, Source(..))
import File
import Json.Decode as Decode exposing (Decoder)
import Json.Encode as Encode exposing (Value)


version : Int
version =
    1



-- REQUESTS


type Request
    = Write Content
    | WriteText String
    | ReadText
    | Read
    | QueryPermission { read : Bool }
    | QueryCapabilities


encodeRequest : String -> Request -> Value
encodeRequest id request =
    let
        ( op, payload ) =
            case request of
                Write content ->
                    ( "write", Encode.object [ ( "content", encodeContent content ) ] )

                WriteText value ->
                    ( "writeText", Encode.object [ ( "text", Encode.string value ) ] )

                ReadText ->
                    ( "readText", Encode.object [] )

                Read ->
                    ( "read", Encode.object [] )

                QueryPermission { read } ->
                    ( "permission"
                    , Encode.object
                        [ ( "name"
                          , Encode.string
                                (if read then
                                    "clipboard-read"

                                 else
                                    "clipboard-write"
                                )
                          )
                        ]
                    )

                QueryCapabilities ->
                    ( "capabilities", Encode.object [] )
    in
    Encode.object
        [ ( "v", Encode.int version )
        , ( "id", Encode.string id )
        , ( "op", Encode.string op )
        , ( "payload", payload )
        ]


{-| `{ representations: [ { type, text } | { type, url } ] }`
-}
encodeContent : Content -> Value
encodeContent content =
    Encode.object
        [ ( "representations"
          , Encode.list
                (\rep ->
                    case rep.source of
                        Inline value ->
                            Encode.object [ ( "type", Encode.string rep.mime ), ( "text", Encode.string value ) ]

                        FromUrl url ->
                            Encode.object [ ( "type", Encode.string rep.mime ), ( "url", Encode.string url ) ]
                )
                (Content.representations content)
          )
        ]



-- REPLIES


outcome : Decoder a -> Decoder (Result Error a)
outcome okDecoder =
    Decode.oneOf
        [ Decode.field "error" errorDecoder |> Decode.map Err
        , Decode.field "ok" okDecoder |> Decode.map Ok
        ]


{-| `{ code, name, message, type? }`. `code` is normalized by the JS side;
`name` is the browser's original error name.
-}
errorDecoder : Decoder Error
errorDecoder =
    Decode.map3
        (\code name message ->
            { code = code, name = name, message = message }
        )
        (Decode.field "code" Decode.string)
        (optionalString "name")
        (optionalString "message")
        |> Decode.andThen
            (\e ->
                case e.code of
                    "NotSupported" ->
                        Decode.succeed NotSupported

                    "InsecureContext" ->
                        Decode.succeed InsecureContext

                    "NotAllowed" ->
                        Decode.succeed NotAllowed

                    "DocumentNotFocused" ->
                        Decode.succeed DocumentNotFocused

                    "TypeNotSupported" ->
                        Decode.field "type" mimeDecoder |> Decode.map TypeNotSupported

                    "DataError" ->
                        Decode.succeed (DataError e.message)

                    _ ->
                        Decode.succeed
                            (Unknown
                                { name =
                                    if String.isEmpty e.name then
                                        e.code

                                    else
                                        e.name
                                , message = e.message
                                }
                            )
            )


optionalString : String -> Decoder String
optionalString name =
    Decode.oneOf [ Decode.field name Decode.string, Decode.succeed "" ]


mimeDecoder : Decoder MimeType
mimeDecoder =
    Decode.map Clipboard.mimeTypeFromString Decode.string


{-| `{ types, text?, html?, files }`. `files` holds real `File` objects, which
pass through ports and custom events unchanged.
-}
itemDecoder : Decoder Item
itemDecoder =
    Decode.map4 Item
        (Decode.field "types" (Decode.list mimeDecoder))
        (Decode.oneOf [ Decode.field "text" (Decode.nullable Decode.string), Decode.succeed Nothing ])
        (Decode.oneOf [ Decode.field "html" (Decode.nullable Decode.string), Decode.succeed Nothing ])
        (Decode.oneOf [ Decode.field "files" (Decode.list File.decoder), Decode.succeed [] ])


permissionDecoder : Decoder Permission
permissionDecoder =
    Decode.string
        |> Decode.map
            (\state ->
                case state of
                    "granted" ->
                        Granted

                    "denied" ->
                        Denied

                    "prompt" ->
                        Prompt

                    _ ->
                        Unavailable
            )


capabilitiesDecoder : Decoder Capabilities
capabilitiesDecoder =
    Decode.map5 Capabilities
        (Decode.field "secureContext" Decode.bool)
        (Decode.field "asyncClipboard" Decode.bool)
        (Decode.field "clipboardItem" Decode.bool)
        (Decode.field "permissionsQuery" Decode.bool)
        (Decode.field "supportedTypes" (Decode.list mimeDecoder))
