import { useEffect, useMemo, useState } from 'react';
import { arrayUnion, collection, doc, getDoc, getDocs, or, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { clampStacks, getEffectsArray, stacksLabel } from '../utils/statusEffects';
import { STATUS_TYPES, isHexColor, isToken, statusColorClass, statusColorStyle } from '../utils/statusStyle';
import Markdown from 'markdown-to-jsx';
import MarkdownEditor from './MarkdownEditor';

const byName = (a, b) => (a.name || '').localeCompare(b.name || '');

const isClassSpecific = status => Boolean(status.classes?.length);

const CUSTOM_OPTION = { id: 'custom', name: 'Custom…', polarity: 'neutral', color: '', defaultStacks: 1, description: '', effects: [], grantedAction: null };

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
    const [color, setColor] = useState('');
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
            // The first one shown is the one selected - class-specific first.
            const first = [...inScope.filter(isClassSpecific).sort(byName), ...inScope.filter(status => !isClassSpecific(status)).sort(byName)][0];
            if (first) {
                setSelectedId(first.id);
                setPolarity(first.polarity || 'neutral');
                setColor(first.color || '');
                setStacks(first.defaultStacks || 0);
            }
        }
        loadPresets().catch(error => console.log(error));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // Statuses made for this character's class get their own section, so a
    // player isn't reading through every status in the game to find them.
    const classPresets = useMemo(() => presets.filter(isClassSpecific).sort(byName), [presets]);
    const generalPresets = useMemo(() => presets.filter(status => !isClassSpecific(status)).sort(byName), [presets]);
    const options = useMemo(() => [...classPresets, ...generalPresets, CUSTOM_OPTION], [classPresets, generalPresets]);
    const selected = options.find(o => o.id === selectedId) || CUSTOM_OPTION;
    const isCustom = selected.id === 'custom';
    const description = isCustom ? customDescription : selected.description;
    const name = isCustom ? customName : selected.name;
    const token = isToken({ polarity });

    function selectPreset(option) {
        setSelectedId(option.id);
        if (option.id !== 'custom') {
            setPolarity(option.polarity || 'neutral');
            setColor(option.color || '');
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
            ...(isHexColor(color) ? { color } : {}),
            // A Token has no mechanics, even if the preset it came from did.
            effects: isCustom || token ? [] : getEffectsArray(selected),
            decaysPerTurn: isCustom || token ? false : Boolean(selected.decaysPerTurn),
            grantedAction: isCustom || token ? null : (selected.grantedAction || null),
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

    // The chosen chip shows what is about to be added, so it follows the type
    // and colour picked below rather than the preset's own.
    function presetChip(option) {
        const isSelected = option.id === selectedId;
        const className = isSelected
            ? ['CharacterPage-status-preset-chip', `CharacterPage-status-chip-${polarity}`, statusColorClass({ color }, 'CharacterPage-status-chip'), 'CharacterPage-status-preset-chip-selected'].filter(Boolean).join(' ')
            : 'CharacterPage-status-preset-chip';
        return <button type="button"
            key={option.id}
            className={className}
            style={isSelected ? statusColorStyle({ color }) : undefined}
            onClick={() => selectPreset(option)}
        >
            {option.name}
        </button>;
    }

    return <>
        <button
            type="button"
            className="CharacterPage-status-scrim"
            aria-label="Close"
            onClick={onClose}
        />
        <div className="CharacterPage-status-dialog">
            <h3>Add Status</h3>

            {classPresets.length > 0 && <div className="CharacterPage-status-dialog-section">
                <div className="CharacterPage-vitals-label">{characterClass} statuses</div>
                <div className="CharacterPage-status-dialog-chip-row">{classPresets.map(presetChip)}</div>
            </div>}

            <div className="CharacterPage-status-dialog-section">
                <div className="CharacterPage-vitals-label">{classPresets.length > 0 ? 'General statuses' : 'Choose a status'}</div>
                <div className="CharacterPage-status-dialog-chip-row">{[...generalPresets, CUSTOM_OPTION].map(presetChip)}</div>
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
                <MarkdownEditor
                    variant="compact"
                    label="Status description"
                    placeholder="What does it do?"
                    value={customDescription}
                    onChange={setCustomDescription}
                />
            </div>}

            <div className="CharacterPage-status-dialog-section">
                <div className="CharacterPage-vitals-label">Stacks / duration</div>
                <div className="CharacterPage-status-dialog-stepper">
                    <button type="button" onClick={() => setStacks(s => clampStacks(s - 1))}>&minus;</button>
                    <span>{stacksLabel(stacks)}</span>
                    <button type="button" onClick={() => setStacks(s => clampStacks(s + 1))}>+</button>
                </div>
            </div>

            <div className="CharacterPage-status-dialog-section">
                <div className="CharacterPage-vitals-label">Type</div>
                <div className="CharacterPage-status-dialog-chip-row">
                    {STATUS_TYPES.map(type =>
                        <button type="button"
                            key={type.key}
                            className={polarity === type.key ? `CharacterPage-status-preset-chip CharacterPage-status-chip-${type.key} CharacterPage-status-preset-chip-selected` : 'CharacterPage-status-preset-chip'}
                            onClick={() => setPolarity(type.key)}
                        >
                            {type.label}
                        </button>
                    )}
                </div>
            </div>

            <div className="CharacterPage-status-dialog-section">
                <div className="CharacterPage-vitals-label">Color</div>
                <div className="CharacterPage-status-dialog-color-row">
                    <input
                        type="color"
                        aria-label="Status color"
                        value={isHexColor(color) ? color : '#7c4dff'}
                        onChange={event => setColor(event.target.value)}
                    />
                    {isHexColor(color)
                        ? <button type="button" className="CharacterPage-status-preset-chip" onClick={() => setColor('')}>Use the type's color</button>
                        : <span className="CharacterPage-status-dialog-hint">Using the color of its type</span>}
                </div>
            </div>

            {!isCustom && description && <div className="CharacterPage-status-dialog-preview"><Markdown options={{ disableParsingRawHTML: true }}>{description}</Markdown></div>}

            <div className="CharacterPage-status-dialog-actions">
                <button type="button" className="CharacterPage-status-dialog-button CharacterPage-status-dialog-button-primary" onClick={handleConfirm} disabled={submitting}>
                    {submitting ? "Adding…" : "Add Status"}
                </button>
                <button type="button" className="CharacterPage-status-dialog-button" onClick={onClose}>Cancel</button>
            </div>
        </div>
    </>
}
