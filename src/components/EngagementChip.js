import { readableOn } from '../utils/statusStyle';
import '../styles/CharacterPage.scss';

// A little engagement ring: a silver band with a stone in the colour of the engagement.
function RingIcon({ stone }) {
    return <svg className="CharacterPage-engagement-ring" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="15" r="6.5" fill="none" stroke="#d9dde5" strokeWidth="2.6"/>
        <polygon points="12,1.5 16.2,5 14.4,9 9.6,9 7.8,5" fill={stone} stroke="#ffffff" strokeWidth="0.9" strokeLinejoin="round"/>
    </svg>;
}

// The status that says a character is engaged, in the strip of statuses: an engagement ring
// whose stone is the engagement's colour - the same for everyone engaged with each other - and
// who they are engaged with. `engagement` is what engagementOf (utils/engagements.js) gives.
export function EngagementChip({ engagement }) {
    const names = engagement.others.map(other => other.title).join(', ');
    return <span
        className="CharacterPage-status-chip CharacterPage-status-chip-custom CharacterPage-engagement-chip"
        style={{ '--status-color': engagement.stone, '--status-on-color': readableOn(engagement.stone) }}
        title={`Engaged with ${names}`}
    >
        <RingIcon stone={engagement.stone}/>
        <span className="CharacterPage-status-chip-name">{`Engaged with ${names}`}</span>
    </span>;
}
