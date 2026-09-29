module Clipboard.Feedback exposing
    ( Feedback, init
    , Status(..), status, isCopied
    , record, recordFor, Msg, update
    )

{-| The "Copied!" state of a copy button, which goes back to normal after a
moment (1.5 seconds by default).

    type alias Model =
        { feedback : Clipboard.Feedback.Feedback }

    type Msg
        = Copied (Result Clipboard.Error ())
        | FeedbackMsg Clipboard.Feedback.Msg

    update msg model =
        case msg of
            Copied result ->
                let
                    ( feedback, cmd ) =
                        Clipboard.Feedback.record FeedbackMsg result model.feedback
                in
                ( { model | feedback = feedback }, cmd )

            FeedbackMsg feedbackMsg ->
                ( { model | feedback = Clipboard.Feedback.update feedbackMsg model.feedback }
                , Cmd.none
                )

    label =
        if Clipboard.Feedback.isCopied model.feedback then
            "Copied!"

        else
            "Copy"

Copying again while "Copied!" is showing restarts the timer.

@docs Feedback, init
@docs Status, status, isCopied
@docs record, recordFor, Msg, update

-}

import Clipboard exposing (Error)
import Clipboard.Internal.Feedback as Internal
import Process
import Task


{-| Keep one in your model per copy button (or one shared one).
-}
type alias Feedback =
    Internal.Feedback


{-| What to show.
-}
type Status
    = Idle
    | Copied
    | Failed Error


{-| Nothing copied yet.
-}
init : Feedback
init =
    Internal.Feedback { generation = 0, state = Internal.Idle }


{-| What to show now: the button's normal label, "Copied!", or an error.
-}
status : Feedback -> Status
status (Internal.Feedback feedback) =
    case feedback.state of
        Internal.Idle ->
            Idle

        Internal.Copied ->
            Copied

        Internal.Failed error ->
            Failed error


{-| `True` while "Copied!" should show.
-}
isCopied : Feedback -> Bool
isCopied feedback =
    status feedback == Copied


{-| Record the result of a copy and start the 1.5-second timer.
-}
record : (Msg -> msg) -> Result Error () -> Feedback -> ( Feedback, Cmd msg )
record =
    recordFor 1500


{-| Like [`record`](#record) with a duration in milliseconds.
-}
recordFor : Float -> (Msg -> msg) -> Result Error () -> Feedback -> ( Feedback, Cmd msg )
recordFor milliseconds toMsg result feedback =
    let
        ( next, generation ) =
            Internal.record result feedback
    in
    ( next
    , Process.sleep milliseconds
        |> Task.perform (\() -> toMsg (Internal.Expired generation))
    )


{-| The timer's message. Pass it to [`update`](#update).
-}
type alias Msg =
    Internal.Msg


{-| Ends the "Copied!" state when its timer fires. Timers from earlier copies
are ignored, so copying twice quickly still shows the full duration.
-}
update : Msg -> Feedback -> Feedback
update =
    Internal.expire
