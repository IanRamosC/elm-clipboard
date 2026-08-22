module Clipboard.Internal.Protocol exposing (Request(..), encodeContent, encodeRequest, version)

{-| Wire protocol version 1, shared with the `elm-clipboard` npm package.
`js/src/protocol.ts` describes the same shapes in TypeScript. Change both
together and bump `version` on any incompatible change.

Request: `{ v, id, op, payload }`
Reply: `{ v, id, op, ok }` or `{ v, id, op, error: { code, name, message, type? } }`

-}

import Clipboard.Internal.Content as Content exposing (Content, Source(..))
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
