import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../utils/firebase';
import { removeFromTracker, updateCombatTracker } from '../utils/party';
import { useParty } from '../utils/useParty';
import { useCampaignMaps } from '../utils/useCampaignCombat';
import { ENEMY_TIERS, removeEnemies, rosterEntry, rosterSummary, stageEncounter, summaryText, tierOf } from '../utils/enemies';
import { benchmarkSummary, checkEnemy, rangeText } from '../utils/encounterGuide';
import { BalanceCheck } from './BalanceCheck';
import { BalanceGuide } from './BalanceGuide';
import { EncounterNewEnemy } from './EncounterNewEnemy';
import { EnemyPicker } from './EnemyPicker';
import MarkdownEditor from './MarkdownEditor';
import '../styles/ClassPage.scss';
import '../styles/EncounterPage.scss';
import '../styles/BalanceGuide.scss';

const asNumber = text => (text.trim() === '' ? NaN : Number(text));
const shown = value => (typeof value === 'number' && !Number.isNaN(value) ? value : '');

function RosterRow({ entry, zoneNames, onChange, onRemove }) {
    const enemy = entry.enemy || {};
    const setStat = (field, value) => onChange({ ...entry, enemy: { ...enemy, [field]: value } });
    const label = enemy.enemy_name || 'enemy';
    const { benchmark, issues } = checkEnemy(enemy);

    return <div className="EncounterPage-row">
        <div className="EncounterPage-row-main">
            <input className="ClassPage-field-input EncounterPage-name" aria-label={`Name of ${label}`} value={enemy.enemy_name || ''} onChange={event => setStat('enemy_name', event.target.value)}/>
            <select className="ClassPage-field-input EncounterPage-tier" aria-label={`Tier of ${label}`} value={tierOf(enemy.enemy_type) ? enemy.enemy_type : ''} onChange={event => setStat('enemy_type', event.target.value)}>
                {!tierOf(enemy.enemy_type) && <option value="">No tier</option>}
                {ENEMY_TIERS.map(tier => <option key={tier.key} value={tier.key}>{tier.key}</option>)}
            </select>
        </div>
        <div className="EncounterPage-row-numbers">
            <label>Count
                <div className="EncounterPage-count">
                    <button type="button" aria-label={`Fewer ${label}`} disabled={entry.count <= 1} onClick={() => onChange({ ...entry, count: entry.count - 1 })}>−</button>
                    <span aria-label={`Number of ${label}`}>{entry.count}</span>
                    <button type="button" aria-label={`More ${label}`} onClick={() => onChange({ ...entry, count: entry.count + 1 })}>+</button>
                </div>
            </label>
            {[['level', 'Level'], ['maximum_health', 'HP'], ['base_armor_class', 'AC'], ['action_points', 'AP']].map(([field, title]) => <label key={field}>{title}
                <input className="ClassPage-field-input ClassPage-field-input-narrow" type="number" aria-label={`${title} of ${label}`} value={shown(enemy[field])} onChange={event => setStat(field, asNumber(event.target.value))}/>
            </label>)}
            {zoneNames.length > 0 && <label>Starts in
                <select className="ClassPage-field-input" aria-label={`Starting zone of ${label}`} value={zoneNames.includes(entry.zone) ? entry.zone : ''} onChange={event => onChange({ ...entry, zone: event.target.value })}>
                    <option value="">{zoneNames[0]} (first zone)</option>
                    {zoneNames.slice(1).map(zone => <option key={zone} value={zone}>{zone}</option>)}
                </select>
            </label>}
            <button type="button" className="EncounterPage-remove" aria-label={`Remove ${label}`} onClick={onRemove}>Remove</button>
        </div>
        {benchmark && <div className="EncounterPage-benchmark" aria-label={`Guide benchmark for ${label}`}>
            <span>{benchmarkSummary(benchmark)}</span>
            {issues.map(issue => <span key={issue.field} className="EncounterPage-flag">{issue.label} {issue.value} is {issue.status} {rangeText(issue.range)}</span>)}
        </div>}
    </div>;
}

// One encounter: a roster of enemies (each a copy of a bestiary stat block,
// with a count and a starting zone), your notes, and a summary of how big the
// fight is. Save it, then stage it: the enemies appear on the Director's page
// and on the combat tracker, ready to fight.
export function EncounterPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const [, , campaignId, , encounterId] = location.pathname.split('/');
    const encounterDoc = useMemo(() => doc(db, 'campaigns', campaignId, 'encounters', encounterId), [campaignId, encounterId]);
    const campaignDoc = useMemo(() => doc(db, 'campaigns', campaignId), [campaignId]);

    const [draft, setDraft] = useState(null);
    const [saved, setSaved] = useState(null);
    const [stagedIds, setStagedIds] = useState([]);
    const [campaign, setCampaign] = useState(null);
    const [loadError, setLoadError] = useState(false);
    const [picking, setPicking] = useState(false);
    const [creating, setCreating] = useState(false);
    const [busy, setBusy] = useState(false);
    const draftLoaded = useRef(false);
    const { party } = useParty(campaignId);
    const { activeMap } = useCampaignMaps(campaign || {});
    const zoneNames = useMemo(() => (activeMap?.zones || []).map(zone => zone.name), [activeMap]);

    useEffect(() => {
        document.title = 'Encounter';
        const unsubscribe = onSnapshot(encounterDoc, snap => {
            if (!snap.exists()) { setLoadError(true); return; }
            const data = snap.data();
            setStagedIds(data.stagedIds || []);
            // The draft is what you're editing; only the first load fills it.
            if (!draftLoaded.current) {
                draftLoaded.current = true;
                const initial = { name: data.name || '', notes: data.notes || '', roster: data.roster || [], target: data.target || '', objective: data.objective || '' };
                setDraft(initial);
                setSaved(initial);
                document.title = initial.name || 'Encounter';
            }
        }, error => { console.log('Failed to load the encounter: ' + error); setLoadError(true); });
        return () => unsubscribe();
    }, [encounterDoc]);

    useEffect(() => {
        const unsubscribe = onSnapshot(campaignDoc, snap => setCampaign({ id: snap.id, ...snap.data() }));
        return () => unsubscribe();
    }, [campaignDoc]);

    const dirty = draft !== null && saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);
    const summary = useMemo(() => rosterSummary(draft?.roster), [draft]);

    if (loadError) return <div className="ClassPage"><div className="ClassPage-inner"><div className="ClassPage-hint" role="alert">Couldn't load this encounter. Only the campaign's directors can see encounters.</div></div></div>;
    if (!draft) return <div className="ClassPage"><div className="ClassPage-inner"><div className="ClassPage-hint">Loading…</div></div></div>;

    const set = changes => setDraft(prev => ({ ...prev, ...changes }));
    const updateEntry = next => set({ roster: draft.roster.map(entry => (entry.id === next.id ? next : entry)) });

    async function save() {
        try {
            await updateDoc(encounterDoc, { name: draft.name.trim() || 'Untitled encounter', notes: draft.notes, roster: draft.roster, target: draft.target, objective: draft.objective, updatedAt: serverTimestamp() });
            setSaved(draft);
            return true;
        } catch (error) {
            alert("Couldn't save the encounter: " + error.message);
            return false;
        }
    }

    async function stage() {
        if (stagedIds.length > 0 && !window.confirm('This encounter is already staged. Stage another set of these enemies?')) return;
        setBusy(true);
        try {
            if (dirty && !(await save())) return;
            const staged = stageEncounter(draft, campaign, zoneNames, party.combat_tracker || []);
            await updateDoc(campaignDoc, { enemy_list: staged.enemy_list });
            if (staged.trackerPosts.length > 0) await updateCombatTracker(campaignId, posts => [...posts, ...staged.trackerPosts]);
            await updateDoc(encounterDoc, { stagedIds: [...stagedIds, ...staged.stagedIds], stagedAt: serverTimestamp() });
        } catch (error) {
            alert("Couldn't stage the encounter: " + error.message);
        } finally {
            setBusy(false);
        }
    }

    async function clearStaged() {
        if (!window.confirm('Remove the enemies staged from this encounter from the fight?')) return;
        setBusy(true);
        try {
            await updateDoc(campaignDoc, removeEnemies(campaign, stagedIds));
            await updateCombatTracker(campaignId, removeFromTracker(stagedIds));
            await updateDoc(encounterDoc, { stagedIds: [] });
        } catch (error) {
            alert("Couldn't clear the staged enemies: " + error.message);
        } finally {
            setBusy(false);
        }
    }

    const stillOnCampaign = (campaign?.enemy_list || []).filter(enemy => stagedIds.includes(enemy.id)).length;

    return <div className="ClassPage">
        <div className="ClassPage-inner">
            <button type="button" className="ClassPage-breadcrumb" onClick={() => navigate(`/campaigns/${campaignId}/encounters`)}>&larr; Encounters</button>

            <div className="ClassPage-header">
                <div className="ClassPage-header-main">
                    <input className="ClassPage-title-input" aria-label="Encounter name" placeholder="Encounter name" value={draft.name} onChange={event => set({ name: event.target.value })}/>
                </div>
                <div className="ClassPage-header-side EncounterPage-header-buttons">
                    <button type="button" className="ClassPage-edit-button" onClick={save} disabled={!dirty || busy}>{dirty ? 'Save' : 'Saved'}</button>
                </div>
            </div>

            <div className="ClassPage-card EncounterPage-summary" aria-label="Summary">
                <div className="ClassPage-section-title">The fight</div>
                <div className="EncounterPage-summary-line">{summaryText(summary)}</div>
                {summary.total > 0 && <div className="EncounterPage-summary-totals">
                    <span>{summary.total} {summary.total === 1 ? 'enemy' : 'enemies'}</span>
                    <span>{summary.totalHealth} HP in total</span>
                    <span>Highest level {summary.highestLevel}</span>
                </div>}
                <div className="EncounterPage-stage-buttons">
                    <button type="button" className="ClassPage-edit-button" onClick={stage} disabled={busy || summary.total === 0 || !campaign}>Stage encounter</button>
                    {stagedIds.length > 0 && <button type="button" className="ClassPage-remove-action-button" onClick={clearStaged} disabled={busy}>Clear staged enemies</button>}
                </div>
                {stagedIds.length > 0 && <div className="ClassPage-hint">Staged - {stillOnCampaign} of {stagedIds.length} of its enemies are still on the Director's page.</div>}
                {summary.total > 0 && zoneNames.length === 0 && <div className="ClassPage-hint">There's no active map, so the enemies will join the fight without a starting zone; the tracker places them once a map is set.</div>}
            </div>

            <BalanceCheck roster={draft.roster} target={draft.target} objective={draft.objective} zoneCount={zoneNames.length} onTarget={target => set({ target })} onObjective={objective => set({ objective })}/>

            <div className="ClassPage-card">
                <div className="ClassPage-actions-header">
                    <div className="ClassPage-section-title">Enemies</div>
                    <div className="ClassPage-add-action-buttons">
                        <button type="button" className="ClassPage-add-action-button" aria-expanded={picking} onClick={() => { setPicking(open => !open); setCreating(false); }}>+ Add enemy</button>
                        <button type="button" className="ClassPage-add-action-button" aria-expanded={creating} onClick={() => { setCreating(open => !open); setPicking(false); }}>+ Create enemy</button>
                    </div>
                </div>
                {creating && <EncounterNewEnemy onClose={() => setCreating(false)} onAdd={entry => { set({ roster: [...draft.roster, entry] }); setCreating(false); }}/>}
                {picking && <EnemyPicker onClose={() => setPicking(false)} onPick={enemy => set({ roster: [...draft.roster, rosterEntry(enemy, '')] })}/>}
                {draft.roster.map(entry => <RosterRow
                    key={entry.id}
                    entry={entry}
                    zoneNames={zoneNames}
                    onChange={updateEntry}
                    onRemove={() => set({ roster: draft.roster.filter(other => other.id !== entry.id) })}
                />)}
                {draft.roster.length === 0 && <div className="ClassPage-hint">No enemies yet. Add some from your bestiary - each one is copied here, so changing it later won't change this fight.</div>}
            </div>

            <BalanceGuide/>

            <div className="ClassPage-card">
                <div className="ClassPage-section-title">Notes</div>
                <MarkdownEditor label="Encounter notes" placeholder="The setup, read-aloud text, tactics, what happens if the party wins or loses." value={draft.notes} onChange={value => set({ notes: value })}/>
            </div>

            {dirty && <div className="EncounterPage-unsaved" role="status">You have unsaved changes. <button type="button" onClick={save} disabled={busy}>Save</button></div>}
        </div>
    </div>;
}
