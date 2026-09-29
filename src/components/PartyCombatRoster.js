import { getEffectiveCharacterStats } from '../utils/statusEffects';
import { Statuses } from './Statuses';
import '../styles/PartyCombatRoster.scss';

const AP_PIPS = [1, 2, 3, 4];

// A read-only roster of the whole party's vitals - HP, temp HP, hardness,
// action points, reaction, statuses - on a character's own Combat tab. There
// is no Directors Page equivalent a player can reach (that page is for the
// director's planning only - see DirectorsPage.js), so this is the only place
// a player can check on a teammate mid-fight - who still has actions or a
// reaction left this round - without asking out loud. Always read-only, even
// for your own card here - use the vitals panel/action points row above for
// that.
export function PartyCombatRoster({ characterList = [] }) {
    if (characterList.length === 0) return null;

    return <div className="PartyCombatRoster" aria-label="Party">
        <span className="CharacterMainTab-caps-label CharacterMainTab-section-label">Party</span>
        <div className="PartyCombatRoster-list">
            {characterList.map(member => {
                const effective = getEffectiveCharacterStats(member);
                const hpMax = member.maximum_health || 0;
                const hpNow = member.current_health || 0;
                const hpPercent = hpMax > 0 ? Math.max(0, Math.min(100, (hpNow / hpMax) * 100)) : 0;
                const tempHp = member.temporary_health || 0;
                const actionPoints = member.action_points || 0;
                const reactionUsed = Boolean(member.reaction_used);
                return <div className="PartyCombatRoster-card" key={member.character_id}>
                    <div className="PartyCombatRoster-header">
                        <span className="PartyCombatRoster-name">{member.character_name || 'Unnamed'}</span>
                        <span className="PartyCombatRoster-hp-label">{hpNow}/{hpMax} HP</span>
                    </div>
                    <div className="PartyCombatRoster-hp-track">
                        <div className="PartyCombatRoster-hp-fill" style={{ width: hpPercent + '%' }}/>
                    </div>
                    <div className="PartyCombatRoster-vitals">
                        {tempHp > 0 && <span className="PartyCombatRoster-temp">+{tempHp} temp</span>}
                        <span className="PartyCombatRoster-hardness">Hardness {effective.hardness || 0}</span>
                    </div>
                    <div className="PartyCombatRoster-round" aria-label={`${actionPoints} of 4 action points, reaction ${reactionUsed ? 'used' : 'available'}`}>
                        <span className="PartyCombatRoster-ap">
                            AP {actionPoints}/4
                            <span className="PartyCombatRoster-pips">
                                {AP_PIPS.map(n => <span key={n} className={n <= actionPoints ? "PartyCombatRoster-pip PartyCombatRoster-pip-filled" : "PartyCombatRoster-pip"}/>)}
                            </span>
                        </span>
                        <span className={reactionUsed ? "PartyCombatRoster-reaction PartyCombatRoster-reaction-used" : "PartyCombatRoster-reaction"}>
                            <span className="PartyCombatRoster-pip PartyCombatRoster-pip-reaction"/>
                            {reactionUsed ? 'Reaction used' : 'Reaction ready'}
                        </span>
                    </div>
                    <Statuses characterPage={member} hasWritePermissions={false}/>
                </div>;
            })}
        </div>
    </div>;
}
