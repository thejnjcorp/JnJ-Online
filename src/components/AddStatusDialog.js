import { useEffect, useMemo, useState } from 'react';
import { arrayUnion, collection, doc, getDoc, getDocs, or, query, updateDoc, where } from 'firebase/firestore';
import TextareaAutosize from 'react-textarea-autosize';
import { db } from '../utils/firebase';
import { getEffectsArray } from '../utils/statusEffects';

const POLARITIES = [
    { key: 'buff', label: 'Buff' },
    { key: 'debuff', label: 'Debuff' },
    { key: 'neutral', label: 'Neutral' },
];

const CUSTOM_OPTION = { id: 'custom', name: 'Custom…', polarity: 'neutral', defaultStacks: 1, description: '', effects: [], grantedAction: null };

// Hybrid catalog: presets come from the shared `statuses` Firestore
// collection (managed on /status-list), scoped down to ones with no class
// restriction plus ones matching this character's class - a trailing
// "Custom..." option covers one-off statuses that aren't worth adding to the
// shared catalog (see the design handoff's "open decision" note).
export function AddStatusDialog({characterPage, userId, onClose, onUpdateStatuses}) {
    const [presets, setPresets] = useState([]);
    const [selectedId, setSelectedId] = useState('custom');
    const [customName, setCustomName] = useState('');
    const [customDescription, setCustomDescription] = useState('');
    const [polarity, setPolarity] = useState('neutral');
    const [stacks, setStacks] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const characterClass = characterPage.class_name || characterPage.class;

    useEffect(() => {
        if (!userId) return;
        async function loadPresets() {
            // A pool status (public, but not an admin isDefault one) only
            // counts as "in scope" once the character's own campaign has
            // subscribed to it - see StatusPage.js's Subscribe section.
            let subscribedStatusIds = [];
            if (characterPage.campaign) {
                try {
                    const campaignSnap = await getDoc(doc(db, 'campaigns', characterPage.campaign));
                    subscribedStatusIds = campaignSnap.data()?.subscribedStatusIds || [];
                } catch (e) {
                    console.log(e);
                }
            }
            // Same visibility scoping as StatusListPage.js - public statuses
            // plus whatever this viewer (not necessarily the character's
            // owner; could be a director browsing someone else's sheet) can
            // read/write.
            const statusesQuery = query(collection(db, 'statuses'),
                or(where('public', '==', true), where('canRead', 'array-contains', userId), where('canWrite', 'array-contains', userId)));
            const querySnapshot = await getDocs(statusesQuery);
            const all = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            const inScope = all.filter(status =>
                // The read rule above is necessarily coarse (it only knows
                // the viewer's uid, not which character/campaign is on
                // screen) - a director who belongs to several campaigns can
                // legitimately READ every one of their own campaigns' locked
                // statuses, but only the ones locked to THIS character's own
                // campaign belong in this list.
                (!status.campaignId || status.campaignId === characterPage.campaign) &&
                (!status.classes?.length || (characterClass && status.classes.includes(characterClass))) &&
                // Admin defaults and anything not in the public pool (campaign-
                // locked to this campaign, or creator-locked and readable -
                // both already narrowed above) are always usable; a plain pool
                // status needs either this viewer's own authorship or this
                // character's campaign having subscribed to it.
                (status.isDefault || !status.public || status.canWrite?.includes(userId) || subscribedStatusIds.includes(status.id))
            );
            setPresets(inScope);
            if (inScope.length > 0) {
                setSelectedId(inScope[0].id);
                setPolarity(inScope[0].polarity || 'neutral');
                setStacks(inScope[0].defaultStacks || 0);
            }
        }
        loadPresets().catch(error => console.log(error));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

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
        const newStatus = {
            id: crypto.randomUUID(),
            name,
            polarity,
            stacks,
            description,
            effects: isCustom ? [] : getEffectsArray(selected),
            decaysPerTurn: isCustom ? false : Boolean(selected.decaysPerTurn),
            grantedAction: isCustom ? null : (selected.grantedAction || null),
            ...(isCustom ? {} : { sourceStatusId: selected.id }),
        };
        try {
            if (onUpdateStatuses) {
                await onUpdateStatuses([...(characterPage.statuses || []), newStatus]);
            } else {
                await updateDoc(doc(db, "characters", characterPage.character_id), {
                    statuses: arrayUnion(newStatus)
                });
            }
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
                <TextareaAutosize
                    className="CharacterPage-status-dialog-textarea"
                    placeholder="What does it do?"
                    minRows={2}
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
