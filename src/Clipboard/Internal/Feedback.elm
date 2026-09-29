module Clipboard.Internal.Feedback exposing (Feedback(..), Msg(..), State(..), expire, record)

{-| The implementation of `Clipboard.Feedback`, kept here so tests can build
`Msg` values while users can't.
-}

import Clipboard exposing (Error)


type Feedback
    = Feedback { generation : Int, state : State }


type State
    = Idle
    | Copied
    | Failed Error


type Msg
    = Expired Int


record : Result Error () -> Feedback -> ( Feedback, Int )
record result (Feedback feedback) =
    let
        generation =
            feedback.generation + 1
    in
    ( Feedback
        { generation = generation
        , state =
            case result of
                Ok () ->
                    Copied

                Err error ->
                    Failed error
        }
    , generation
    )


{-| Timers from earlier copies are ignored, so a second copy gets its full
duration.
-}
expire : Msg -> Feedback -> Feedback
expire (Expired generation) (Feedback feedback) =
    if generation == feedback.generation then
        Feedback { feedback | state = Idle }

    else
        Feedback feedback
