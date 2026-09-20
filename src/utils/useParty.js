import { useEffect, useState } from 'react';
import { subscribeParty } from './party';

// The campaign's party doc, kept up to date as anyone changes it (see utils/party.js).
// `party` is {} until there is one - it is only created once something is saved to
// it - and `loaded` says whether the first answer has come back. `error` is set if
// the party couldn't be listened to.
export function useParty(campaignId) {
    const [state, setState] = useState({ party: {}, loaded: false, error: null });

    useEffect(() => {
        if (!campaignId) return undefined;
        return subscribeParty(campaignId, setState);
    }, [campaignId]);

    return state;
}
