import { Tooltip } from 'react-tooltip';
import { CharacterStatCalculator } from './CharacterStatCalculator';
import { useRef, useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import shieldIcon from '../icons/shield.svg';
// These are stroke="currentColor" SVGs imported as React components (not via
// <img src>, the pattern the rest of this app uses) - unlike the legacy
// baked-fill icons elsewhere on this page, currentColor lets them theme
// correctly without a mask/filter trick, but that only works rendered
// inline; <img> can't inherit the CSS color property into an external SVG.
import { ReactComponent as HeartIcon } from '../icons/heart.svg';
import { ReactComponent as StrengthIcon } from '../icons/strength_line.svg';
import { ReactComponent as DexterityIcon } from '../icons/dexterity_line.svg';
import { ReactComponent as IntelligenceIcon } from '../icons/intelligence_line.svg';
import { ReactComponent as CharismaIcon } from '../icons/charisma_line.svg';
import { CharacterPortrait } from './CharacterPortrait';
import { Statuses } from './Statuses';

const ABILITY_SCORES = [
    { name: 'strength_stat', label: 'Str', Icon: StrengthIcon, tooltip: 'Strength' },
    { name: 'dexterity_stat', label: 'Dex', Icon: DexterityIcon, tooltip: 'Dexterity' },
    { name: 'intelligence_stat', label: 'Int', Icon: IntelligenceIcon, tooltip: 'Intelligence' },
    { name: 'charisma_stat', label: 'Cha', Icon: CharismaIcon, tooltip: 'Charisma' },
];

export function CharacterPageVitalsPanel({characterPageLayoutLive, userId}) {
    const characterStats = CharacterStatCalculator(
        characterPageLayoutLive.experience_points,
        characterPageLayoutLive.base_armor_class,
        characterPageLayoutLive.base_hit_modifier,
        characterPageLayoutLive.base_damage_modifier,
        characterPageLayoutLive.base_damage_dice,
        characterPageLayoutLive.base_damage_dice_type,
        characterPageLayoutLive.base_healing_dice_type);

    const hasWritePermissions = userId ? (characterPageLayoutLive.userId === userId || characterPageLayoutLive.canWrite?.includes(userId)) : false;
    const debounceRef = useRef({});

    const fieldsToTrack = [
        'current_health', 'maximum_health', 'temporary_health',
        'experience_points', 'hardness',
        'strength_stat', 'dexterity_stat', 'intelligence_stat', 'charisma_stat',
    ];
    const [localScores, setLocalScores] = useState(() => {
        const initial = {};
        fieldsToTrack.forEach(field => { initial[field] = characterPageLayoutLive[field]; });
        return initial;
    });

    useEffect(() => {
        const next = {};
        fieldsToTrack.forEach(field => { next[field] = characterPageLayoutLive[field]; });
        setLocalScores(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, fieldsToTrack.map(field => characterPageLayoutLive[field]));

    const handleChange = event => {
        const { name, type, value } = event.target;
        const parsedValue = type === 'number' && value !== '' ? Number(value) : value;

        setLocalScores(prev => ({
            ...prev,
            [name]: value
        }));

        if (debounceRef.current[name]) {
            clearTimeout(debounceRef.current[name]);
        }
        debounceRef.current[name] = setTimeout(() => {
            if (value !== '') {
                updateDoc(doc(db, "characters", characterPageLayoutLive.character_id), {
                    [name]: parsedValue
                }).catch(e => {
                    alert(e);
                });
            }
        }, 500);
    };

    const currentHealth = Number(localScores.current_health) || 0;
    const maximumHealth = Number(localScores.maximum_health) || 0;
    const healthPercent = maximumHealth > 0 ? Math.max(0, Math.min(100, (currentHealth / maximumHealth) * 100)) : 0;
    const hasTempHp = Number(localScores.temporary_health) > 0;

    // The 2x2 stat grid (Health / AC+XP+Hardness / Statuses / Scores) plus a
    // portrait panel share one card, per the v2 desktop design - see
    // design/character-page-v2/CHARACTER_PAGE_V2_HANDOFF.md's "Portrait
    // panel" and "Statuses" sections. The portrait column is hidden on
    // mobile via CSS (CharacterPage.scss); the grid itself becomes a single
    // stacked column there too.
    return <div className="CharacterPage-vitals-card">
    <div className={hasTempHp ? "CharacterPage-vitals CharacterPage-vitals-temp-hp" : "CharacterPage-vitals"}>

        <div className="CharacterPage-vitals-health">
            <div className="CharacterPage-vitals-health-header">
                <HeartIcon className="CharacterPage-vitals-health-icon"/>
                <span className="CharacterPage-vitals-label">Health</span>
                <span className="CharacterPage-vitals-health-numbers">
                    <input
                        value={localScores.current_health}
                        className="CharacterPage-vitals-health-input"
                        disabled={!hasWritePermissions}
                        name="current_health"
                        type="number"
                        onChange={handleChange}
                        data-tooltip-id="current-hp"
                    />
                    <span className="CharacterPage-vitals-health-slash muted"> / </span>
                    <input
                        value={localScores.maximum_health}
                        className="CharacterPage-vitals-health-input CharacterPage-vitals-health-input-max"
                        disabled={!hasWritePermissions}
                        name="maximum_health"
                        type="number"
                        onChange={handleChange}
                        data-tooltip-id="max-hp"
                    />
                </span>
            </div>
            <div className="CharacterPage-vitals-health-bar">
                <div className="CharacterPage-vitals-health-bar-fill" style={{width: healthPercent + "%"}}/>
            </div>
            <div className="CharacterPage-vitals-temp-row">
                Temp HP:
                <input
                    value={localScores.temporary_health}
                    className="CharacterPage-vitals-temp-input"
                    disabled={!hasWritePermissions}
                    name="temporary_health"
                    type="number"
                    onChange={handleChange}
                    data-tooltip-id="temp-hp"
                />
            </div>
        </div>

        {/* AC and XP/Hardness are wrapped together so mobile's
            flex-direction:column stacks them as one row (see
            design/character-page-v2 - Health / AC+XP+Hardness / Statuses /
            Scores, each its own cell in the 2x2 grid on desktop or a
            full-width stacked block on mobile). The divider between AC and
            XP/Hardness is kept inside this wrapper since it's the same on
            both layouts. */}
        <div className="CharacterPage-vitals-ac-xp-row">
            <div className="CharacterPage-vitals-ac" data-tooltip-id="ac">
                <div className="CharacterPage-vitals-label">AC</div>
                <div className="CharacterPage-vitals-ac-shield">
                    <img src={shieldIcon} className="CharacterPage-vitals-ac-shield-icon" alt=""/>
                    <span className="CharacterPage-vitals-ac-value">{characterStats.ArmorClass}</span>
                </div>
            </div>

            <div className="CharacterPage-vitals-divider"/>

            <div className="CharacterPage-vitals-xp-hardness">
                <div className="CharacterPage-vitals-xp-hardness-row">
                    <span className="CharacterPage-vitals-label CharacterPage-vitals-xp-hardness-label">XP</span>
                    <input
                        value={localScores.experience_points}
                        className="CharacterPage-vitals-pill-input"
                        disabled={!hasWritePermissions}
                        name="experience_points"
                        type="number"
                        onChange={handleChange}
                        data-tooltip-id="xp"
                    />
                </div>
                <div className="CharacterPage-vitals-xp-hardness-row">
                    <span className="CharacterPage-vitals-label CharacterPage-vitals-xp-hardness-label">Hardness</span>
                    <input
                        value={localScores.hardness}
                        className="CharacterPage-vitals-pill-input"
                        disabled={!hasWritePermissions}
                        name="hardness"
                        type="number"
                        onChange={handleChange}
                    />
                </div>
            </div>
        </div>

        <Statuses characterPage={characterPageLayoutLive} userId={userId}/>

        <div className="CharacterPage-vitals-scores">
            {ABILITY_SCORES.map(({name, label, Icon, tooltip}) =>
                <div className="CharacterPage-vitals-score" key={name}>
                    <Icon className="CharacterPage-vitals-score-icon"/>
                    <div className="CharacterPage-vitals-label" data-tooltip-id={name}>{label}</div>
                    <div className="CharacterPage-vitals-score-divider"/>
                    <input
                        value={localScores[name]}
                        className="CharacterPage-vitals-score-input"
                        disabled={!hasWritePermissions}
                        name={name}
                        type="number"
                        onChange={handleChange}
                    />
                    {characterPageLayoutLive.tooltips && <Tooltip id={name} place="top" content={tooltip} variant="info"/>}
                </div>
            )}
        </div>

        {characterPageLayoutLive.tooltips && <>
            <Tooltip id="current-hp" place="top" content="current health points" variant="info"/>
            <Tooltip id="max-hp" place="top" content="maximum health points" variant="info"/>
            <Tooltip id="temp-hp" place="top" content="temporary health points" variant="info"/>
            <Tooltip id="ac" place="top" content="armor class" variant="info"/>
            <Tooltip id="xp" place="top" content="experience points" variant="info"/>
        </>}
    </div>

    <CharacterPortrait characterPage={characterPageLayoutLive} userId={userId}/>
    </div>
}
