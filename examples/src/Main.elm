port module Main exposing (main)

{-| Every elm-clipboard feature on one page. Also the page the browser tests
(js/e2e) drive, so element ids and texts here are part of those tests.
-}

import Browser
import Clipboard exposing (MimeType(..))
import Clipboard.Element
import Clipboard.Events
import Clipboard.Feedback as Feedback exposing (Feedback)
import Clipboard.Port exposing (Response(..))
import File exposing (File)
import Html exposing (Html, button, code, div, h1, h2, img, li, p, pre, section, span, text, textarea, ul)
import Html.Attributes exposing (attribute, id, src, tabindex)
import Html.Events exposing (onClick)
import Json.Decode
import Json.Encode
import Task


port clipboardOut : Json.Encode.Value -> Cmd msg


port clipboardIn : (Json.Encode.Value -> msg) -> Sub msg


clipboard : Clipboard.Port.Ports msg
clipboard =
    { send = clipboardOut, receive = clipboardIn }


main : Program () Model Msg
main =
    Browser.element
        { init = init
        , update = update
        , view = view
        , subscriptions = \_ -> Clipboard.Port.subscription clipboard GotReply
        }


type alias Model =
    { snippetFeedback : Feedback
    , linkFeedback : Feedback
    , portLog : List String
    , readResult : String
    , pasted : String
    , pastedImages : List String
    , capabilities : Maybe Clipboard.Capabilities
    }


init : () -> ( Model, Cmd Msg )
init () =
    ( { snippetFeedback = Feedback.init
      , linkFeedback = Feedback.init
      , portLog = []
      , readResult = ""
      , pasted = ""
      , pastedImages = []
      , capabilities = Nothing
      }
    , Clipboard.Port.capabilities clipboard { id = "startup" }
    )


type Msg
    = SnippetCopied (Result Clipboard.Error ())
    | SnippetFeedback Feedback.Msg
    | LinkCopied (Result Clipboard.Error ())
    | LinkFeedback Feedback.Msg
    | CopyHtmlClicked
    | ReadClicked
    | ReadTextClicked
    | GotReply (Result Json.Decode.Error Clipboard.Port.Reply)
    | Pasted Clipboard.Item
    | PastedFiles (List File)
    | GotImageUrl String


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        SnippetCopied result ->
            let
                ( feedback, cmd ) =
                    Feedback.record SnippetFeedback result model.snippetFeedback
            in
            ( { model | snippetFeedback = feedback }, cmd )

        SnippetFeedback feedbackMsg ->
            ( { model | snippetFeedback = Feedback.update feedbackMsg model.snippetFeedback }, Cmd.none )

        LinkCopied result ->
            let
                ( feedback, cmd ) =
                    Feedback.record LinkFeedback result model.linkFeedback
            in
            ( { model | linkFeedback = feedback }, cmd )

        LinkFeedback feedbackMsg ->
            ( { model | linkFeedback = Feedback.update feedbackMsg model.linkFeedback }, Cmd.none )

        CopyHtmlClicked ->
            ( model
            , Clipboard.Port.write clipboard
                { id = "rich"
                , content = Clipboard.html { html = "<b>Order #42</b> shipped", plainText = "Order #42 shipped" }
                }
            )

        ReadClicked ->
            ( model, Clipboard.Port.read clipboard { id = "read" } )

        ReadTextClicked ->
            ( model, Clipboard.Port.readText clipboard { id = "read-text" } )

        GotReply (Ok reply) ->
            ( applyReply reply model, Cmd.none )

        GotReply (Err error) ->
            ( log ("protocol error: " ++ Json.Decode.errorToString error) model, Cmd.none )

        Pasted item ->
            ( { model | pasted = describeItem item }, Cmd.none )

        PastedFiles files ->
            ( model, Cmd.batch (List.map (File.toUrl >> Task.perform GotImageUrl) files) )

        GotImageUrl url ->
            ( { model | pastedImages = url :: model.pastedImages }, Cmd.none )


applyReply : Clipboard.Port.Reply -> Model -> Model
applyReply { id, response } model =
    case response of
        Wrote (Ok ()) ->
            log (id ++ ": copied") model

        Wrote (Err error) ->
            log (id ++ ": " ++ Clipboard.errorToString error) model

        GotText (Ok value) ->
            { model | readResult = "text: " ++ value }

        GotItems (Ok items) ->
            { model | readResult = String.join " | " (List.map describeItem items) }

        GotText (Err error) ->
            { model | readResult = "error: " ++ Clipboard.errorToString error }

        GotItems (Err error) ->
            { model | readResult = "error: " ++ Clipboard.errorToString error }

        GotPermission _ ->
            model

        GotCapabilities (Ok capabilities) ->
            { model | capabilities = Just capabilities }

        GotCapabilities (Err error) ->
            log ("capabilities: " ++ Clipboard.errorToString error) model


log : String -> Model -> Model
log line model =
    { model | portLog = line :: model.portLog }


describeItem : Clipboard.Item -> String
describeItem item =
    String.join ", "
        (List.filterMap identity
            [ Maybe.map (\t -> "text=" ++ t) item.text
            , Maybe.map (\h -> "html=" ++ h) item.html
            , if List.isEmpty item.files then
                Nothing

              else
                Just (String.fromInt (List.length item.files) ++ " file(s)")
            ]
        )


view : Model -> Html Msg
view model =
    div []
        [ h1 [] [ text "elm-clipboard" ]
        , section []
            [ h2 [] [ text "1. Copy button (custom element, no ports)" ]
            , pre [ id "snippet" ] [ text "elm install ianramosc/elm-clipboard" ]
            , Clipboard.Element.copyFrom [ id "copy-snippet" ]
                { target = "snippet", onResult = SnippetCopied }
                [ text (feedbackLabel model.snippetFeedback) ]
            , span [ class_ "status", id "snippet-status" ] [ text (statusText model.snippetFeedback) ]
            ]
        , section []
            [ h2 [] [ text "2. Copy a value" ]
            , Clipboard.Element.copyButton [ id "copy-link" ]
                { content = Clipboard.text "https://example.com/invite/42", onResult = LinkCopied }
                [ text (feedbackLabel model.linkFeedback) ]
            , Clipboard.Element.copyButton [ id "copy-disabled", attribute "aria-disabled" "true" ]
                { content = Clipboard.text "never", onResult = LinkCopied }
                [ text "Disabled" ]
            ]
        , section []
            [ h2 [] [ text "3. Rich text through ports" ]
            , button [ id "copy-html", onClick CopyHtmlClicked ] [ text "Copy formatted order" ]
            , ul [ id "port-log" ] (List.map (\line -> li [] [ text line ]) model.portLog)
            ]
        , section []
            [ h2 [] [ text "4. Read the clipboard" ]
            , button [ id "read-text", onClick ReadTextClicked ] [ text "Read text" ]
            , text " "
            , button [ id "read", onClick ReadClicked ] [ text "Read everything" ]
            , p [ id "read-result" ] [ text model.readResult ]
            ]
        , section []
            [ h2 [] [ text "5. Paste zone" ]
            , Clipboard.Element.pasteZone [ id "paste-zone" ]
                { onPaste = Pasted, preventDefault = False }
                [ textarea [ id "paste-target", Clipboard.Events.onPasteFiles PastedFiles ] [] ]
            , p [ id "pasted" ] [ text model.pasted ]
            , div [] (List.map (\url -> img [ src url ] []) model.pastedImages)
            ]
        , section []
            [ h2 [] [ text "6. This browser" ]
            , viewCapabilities model.capabilities
            ]
        ]


viewCapabilities : Maybe Clipboard.Capabilities -> Html msg
viewCapabilities maybeCapabilities =
    case maybeCapabilities of
        Nothing ->
            text "…"

        Just c ->
            ul [ id "capabilities", tabindex -1 ]
                [ li [] [ text ("Secure context: " ++ yesNo c.secureContext) ]
                , li [] [ text ("Async Clipboard API: " ++ yesNo c.asyncClipboard) ]
                , li [] [ text ("ClipboardItem: " ++ yesNo c.clipboardItem) ]
                , li [] [ text ("Permission queries: " ++ yesNo c.permissionsQuery) ]
                , li [] [ text "Writable types: ", code [] [ text (String.join ", " (List.map Clipboard.mimeTypeToString c.supportedTypes)) ] ]
                ]


yesNo : Bool -> String
yesNo value =
    if value then
        "yes"

    else
        "no"


feedbackLabel : Feedback -> String
feedbackLabel feedback =
    if Feedback.isCopied feedback then
        "Copied!"

    else
        "Copy"


statusText : Feedback -> String
statusText feedback =
    case Feedback.status feedback of
        Feedback.Failed error ->
            Clipboard.errorToString error

        _ ->
            ""


class_ : String -> Html.Attribute msg
class_ =
    Html.Attributes.class
