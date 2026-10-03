import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { PartySpace, PARTY_TABS } from './PartySpace';
import '../styles/Party.scss';

// The party's shared space, for everyone in a campaign - players and directors alike:
// the party inventory, trades between characters, a notebook, and a calendar of what
// has happened (see PartySpace). Lives at /party/:campaignId. It all sits on the campaign's
// party doc (see party.js) and the collections under the campaign, which every member can read
// and write (see firestore.rules).
export function PartyPage() {
    const location = useLocation();
    const campaignId = location.pathname.split('/').at(2);
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = PARTY_TABS.some(option => option.key === searchParams.get('tab')) ? searchParams.get('tab') : 'inventory';

    return <div className="Party">
        <div className="Party-inner">
            <PartySpace campaignId={campaignId} tab={tab} onTab={key => setSearchParams({ tab: key })}
                onLoaded={campaign => { document.title = `Party - ${campaign.campaign_name}`; }}
                renderHeading={campaign => <>
                    <Link className="Party-back" to={`/campaigns/${campaignId}`}>&larr; {campaign.campaign_name}</Link>
                    <h1 className="Party-title">The Party</h1>
                </>}/>
        </div>
    </div>;
}
