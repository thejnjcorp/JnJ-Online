import { getEffectiveCharacterStats } from '../utils/statusEffects';
import { Statuses } from './Statuses';
import '../styles/PartyCombatRoster.scss';

// A read-only roster of the whole party's vitals - HP, temp HP, hardness,
// statuses - on a character's own Combat tab. There is no Directors Page
// equivalent a player can reach (that page is for the director's planning
// only - see DirectorsPage.js), so this is the only place a player can check
// on a teammate mid-fight without asking out loud. Always read-only, even for
// your own card here - use the vitals panel above the tabs to actually change
// your own HP/statuses.
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
                return <div className="PartyCombatRoster-card" key={member.character_id}>
                    <div className="PartyCombatRoster-header">
                        <span className="PartyCombatRoster-name">{member.character_name || 'Unnamed'}</span>
                        <span className="PartyCombatRoster-hp-label">{hpNow}/{hpMax} HP</span>
                    </div>
                    <div className="PartyCombatRoster-vitals">
                        <div className="PartyCombatRoster-hp-track">
                            <div className="PartyCombatRoster-hp-fill" style={{ width: hpPercent + '%' }}/>
                        </div>
                        {tempHp > 0 && <span className="PartyCombatRoster-temp">+{tempHp} temp</span>}
                        <span className="PartyCombatRoster-hardness">Hardness {effective.hardness || 0}</span>
                    </div>
                    <Statuses characterPage={member} hasWritePermissions={false}/>
                </div>;
            })}
        </div>
    </div>;
}
