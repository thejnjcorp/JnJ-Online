import { CharacterDiceConverter } from './CharacterStatCalculator';

const DIE_TYPES = [1, 2, 3, 4, 5, 6]; // CharacterDiceConverter codes for d4..d20

function diceFormat(count, dieTypeCode, modifier, type) {
    const die = CharacterDiceConverter(dieTypeCode);
    let mod = '';
    if (modifier) mod = modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
    return `${count || 0}${die === 'N/A' ? '' : die}${mod}${type ? ' · ' + type : ''}`;
}

// One reusable card for Melee/Ranged Damage - the two sections in ClassPage.js
// are identical apart from which fields they read/write and their accent
// color, so this takes a `kind` ('melee'|'ranged') and derives the four real
// field names from it rather than duplicating the card twice.
export function ClassDamageCard({ kind, label, formData, onChange, onSetDieType, isEditable }) {
    const diceField = `base_${kind}_damage_dice`;
    const dieTypeField = `base_${kind}_damage_dice_type`;
    const modifierField = `base_${kind}_damage_modifier`;
    const typeField = `base_${kind}_damage_type`;

    const preview = diceFormat(formData[diceField], formData[dieTypeField], formData[modifierField], formData[typeField]);

    return <div className={`ClassPage-card ClassPage-damage-card ClassPage-damage-card-${kind}`}>
        <div className="ClassPage-section-title">{label}</div>
        {isEditable ? <>
            <div className="ClassPage-damage-row">
                <div>
                    <span className="ClassPage-field-label">Dice</span>
                    <input
                        className="ClassPage-field-input ClassPage-field-input-narrow"
                        name={diceField}
                        type="number"
                        onChange={onChange}
                        defaultValue={formData[diceField]}
                    />
                </div>
                <div className="ClassPage-damage-row-glue">d</div>
                <div>
                    <span className="ClassPage-field-label">Die</span>
                    <div className="ClassPage-die-pills">
                        {DIE_TYPES.map(code => <button
                            type="button"
                            key={code}
                            className={formData[dieTypeField] === code ? 'ClassPage-die-pill ClassPage-die-pill-selected' : 'ClassPage-die-pill'}
                            onClick={() => onSetDieType(dieTypeField, CharacterDiceConverter(code))}
                        >{CharacterDiceConverter(code)}</button>)}
                    </div>
                </div>
                <div className="ClassPage-damage-row-glue">+</div>
                <div>
                    <span className="ClassPage-field-label">Mod</span>
                    <input
                        className="ClassPage-field-input ClassPage-field-input-narrow"
                        name={modifierField}
                        type="number"
                        onChange={onChange}
                        defaultValue={formData[modifierField]}
                    />
                </div>
                <div className="ClassPage-damage-row-type">
                    <span className="ClassPage-field-label">Damage Type</span>
                    <input
                        className="ClassPage-field-input"
                        name={typeField}
                        type="text"
                        onChange={onChange}
                        defaultValue={formData[typeField]}
                        placeholder="Slashing"
                    />
                </div>
            </div>
            <div className="ClassPage-damage-preview">{preview}</div>
        </> : <div className="ClassPage-damage-preview ClassPage-damage-preview-large">{preview}</div>}
    </div>;
}
