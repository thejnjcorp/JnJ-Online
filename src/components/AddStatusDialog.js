import { useEffect, useMemo, useState } from 'react';
import { arrayUnion, collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';

const POLARITIES = [
    { key: 'buff', label: 'Buff' },
    { key: 'debuff', label: 'Debuff' },
    { key: 'neutral', label: 'Neutral' },
];

const CUSTOM_OPTION = { id: 'custom', name: 'Custom…', polarity: 'neutral', defaultStacks: 0, description: '', effect: null };

// Hybrid catalog: presets come from the shared `statuses` Firestore
// collection (managed on /status-list), scoped down to ones with no class
// restriction plus ones matching this character's class - a trailing
// "Custom..." option covers one-off statuses that aren't worth adding to the
// shared catalog (see the design handoff's "open decision" note).
export function AddStatusDialog({characterPage, onClose}) {
    const [presets, setPresets] = useState([]);
    const [selectedId, setSelectedId] = useState('custom');
    const [customName, setCustomName] = useState('');
    const [customDescription, setCustomDescription] = useState('');
    const [polarity, setPolarity] = useState('neutral');
    const [stacks, setStacks] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const characterClass = characterPage.class_name || characterPage.class;

    useEffect(() => {
        getDocs(collection(db, 'statuses')).then(querySnapshot => {
            const all = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            const inScope = all.filter(status => !status.classes?.length || (characterClass && status.classes.includes(characterClass)));
            setPresets(inScope);
            if (inScope.length > 0) {
                setSelectedId(inScope[0].id);
                setPolarity(inScope[0].polarity || 'neutral');
                setStacks(inScope[0].defaultStacks || 0);
            }
        }).catch(error => console.log(error));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const options = useMemo(() => [...presets, CUSTOM_OPTION], [presets]);
    const selected = options.find(o => o.id === selectedId) || CUSTOM_OPTION;
    const isCustom = selected.id === 'custom';
    const description = isCustom ? customDescription : selected.description;
    const name = isCustom ? customName : selected.name;

    function selectPreset(option) {
        setSelectedId(option.id);
        if (option.id !== 'custom') {
            setPolarity(option.polarity || 'neutral');
            setStacks(option.defaultStacks || 0);
        }
    }

    async function handleConfirm() {
        if (!name.trim()) return alert('Give this status a name.');
        setSubmitting(true);
        try {
            await updateDoc(doc(db, "characters", characterPage.character_id), {
                statuses: arrayUnion({
                    id: crypto.randomUUID(),
                    name,
                    polarity,
                    stacks,
                    description,
                    effect: isCustom ? null : (selected.effect || null),
                    ...(isCustom ? {} : { sourceStatusId: selected.id }),
                })
            });
            onClose();
        } catch (e) {
            alert(e);
        }
        setSubmitting(false);
    }

    return <>
        <div className="CharacterPage-status-scrim" onClick={onClose}/>
        <div className="CharacterPage-status-dialog">
            <h3>Add Status</h3>

            <div className="CharacterPage-status-dialog-section">
                <div className="CharacterPage-vitals-label">Choose a status</div>
                <div className="CharacterPage-status-dialog-chip-row">
                    {options.map(option =>
                        <button
                            key={option.id}
                            className={option.id === selectedId ? `CharacterPage-status-preset-chip CharacterPage-status-chip-${option.polarity} CharacterPage-status-preset-chip-selected` : 'CharacterPage-status-preset-chip'}
                            onClick={() => selectPreset(option)}
                        >
                            {option.name}
                        </button>
                    )}
                </div>
            </div>

            {isCustom && <div className="CharacterPage-status-dialog-section">
                <div className="CharacterPage-vitals-label">Name &amp; description</div>
                <input
                    className="CharacterPage-status-dialog-input"
                    placeholder="Status name"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    autoFocus
                />
                <textarea
                    className="CharacterPage-status-dialog-textarea"
                    placeholder="What does it do?"
                    value={customDescription}
                    onChange={e => setCustomDescription(e.target.value)}
                />
            </div>}

            <div className="CharacterPage-status-dialog-section">
                <div className="CharacterPage-vitals-label">Stacks / duration</div>
                <div className="CharacterPage-status-dialog-stepper">
                    <button onClick={() => setStacks(s => Math.max(0, s - 1))}>&minus;</button>
                    <span>{stacks}</span>
                    <button onClick={() => setStacks(s => Math.min(9, s + 1))}>+</button>
                </div>
            </div>

            <div className="CharacterPage-status-dialog-section">
                <div className="CharacterPage-vitals-label">Polarity</div>
                <div className="CharacterPage-status-dialog-chip-row">
                    {POLARITIES.map(pol =>
                        <button
                            key={pol.key}
                            className={polarity === pol.key ? `CharacterPage-status-preset-chip CharacterPage-status-chip-${pol.key} CharacterPage-status-preset-chip-selected` : 'CharacterPage-status-preset-chip'}
                            onClick={() => setPolarity(pol.key)}
                        >
                            {pol.label}
                        </button>
                    )}
                </div>
            </div>

            {!isCustom && description && <div className="CharacterPage-status-dialog-preview">{description}</div>}

            <div className="CharacterPage-status-dialog-actions">
                <button className="CharacterPage-status-dialog-button CharacterPage-status-dialog-button-primary" onClick={handleConfirm} disabled={submitting}>
                    {submitting ? "Adding…" : "Add Status"}
                </button>
                <button className="CharacterPage-status-dialog-button" onClick={onClose}>Cancel</button>
            </div>
        </div>
    </>
}
