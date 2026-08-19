module Clipboard.Internal.Content exposing (Content(..), Representation, Source(..), representations)

{-| The real definition of `Clipboard.Content`. It lives in an unexposed
module so `Clipboard.Port` and `Clipboard.Element` can encode it while users
can only build it through the functions in `Clipboard`.
-}


type Content
    = Content Representation (List Representation)


{-| One MIME type of the content, for example `text/plain`.
-}
type alias Representation =
    { mime : String
    , source : Source
    }


type Source
    = Inline String
    | FromUrl String


representations : Content -> List Representation
representations (Content first rest) =
    first :: rest
