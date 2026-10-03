import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useParty } from '../utils/useParty';
import { updateParty } from '../utils/party';
import { useBestiary } from '../utils/useBestiary';
import { ENEMY_STAT_FIELDS } from '../utils/enemies';
import { advanceTurnStatuses } from '../utils/statusEffects';
import { isReactionAction } from '../utils/classActions';
import { enemyTiles, playerCombatant, withoutEnded } from '../utils/combatants';
import { moveInOrder, nextTurn, reconcileOrder, setActive, turnOf } from '../utils/turnOrder';
import { EntityDrawer } from './EntityDrawer';
import { AddStatusDialog } from './AddStatusDialog';

// Who is in the fight and every way a director changes them, shared by the party down the
// left, the tracker in the middle, the enemies down the right, and the drawer that slides over
// them - which are rendered in different places by the scenes framework, so they meet here.
// A player's character is a document of its own (the rules let a campaign's directors change
// exactly the fields below); an enemy is an object in the campaign's enemy_list, changed through
// `updateEnemy`, which rewrites that list.

const CombatContext = createContext(null);
export const useCombat = () => useContext(CombatContext);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// The director's private notes about one player, in campaigns/{id}/entity_notes/{characterId}.
function useEntityNotes(campaignId, key) {
    const [state, setState] = useState({ text: '', available: true });
    useEffect(() => {
        if (!key) return undefined;
        setState({ text: '', available: true });
        return onSnapshot(doc(db, 'campaigns', campaignId, 'entity_notes', key),
            snapshot => setState({ text: snapshot.exists() ? (snapshot.data().text || '') : '', available: true }),
            error => { console.log("Couldn't read the director's notes: " + error); setState({ text: '', available: false }); });
    }, [campaignId, key]);
    const save = useCallback(text => setDoc(doc(db, 'campaigns', campaignId, 'entity_notes', key), { text }).catch(error => alert("Couldn't save the notes: " + error.message)), [campaignId, key]);
    return { ...state, save };
}

export function CombatProvider({ campaignId, campaignInfo, characters, userId, updateEnemy, removeEnemy, onApi, children }) {
    const { party } = useParty(campaignId);
    const { enemies: bestiary } = useBestiary();
    const [drawer, setDrawer] = useState(null); // { id, group }
    const [addingFor, setAddingFor] = useState(null);

    const players = useMemo(() => characters.map(playerCombatant), [characters]);
    const tiles = useMemo(() => enemyTiles(campaignInfo.enemy_list ?? []), [campaignInfo.enemy_list]);
    const all = useMemo(() => [...players, ...tiles.flatMap(tile => (tile.kind === 'group' ? tile.members : [tile.member]))], [players, tiles]);
    const tileKeyOf = useMemo(() => {
        const map = new Map(players.map(player => [player.id, player.id]));
        tiles.forEach(tile => (tile.kind === 'group' ? tile.members : [tile.member]).forEach(member => map.set(member.id, tile.key)));
        return map;
    }, [players, tiles]);
    const keys = useMemo(() => [...players.map(player => player.id), ...tiles.map(tile => tile.key)], [players, tiles]);

    const turn = useMemo(() => turnOf(party), [party]);
    const writeTurn = useCallback(change => updateParty(campaignId, current => ({ combat_turn: change(turnOf(current)) })).catch(error => alert("Couldn't change the turn: " + error)), [campaignId]);
    // the order follows who is in the fight: a newcomer joins the end, someone gone drops out
    useEffect(() => {
        if (!party || keys.length === 0 || !userId) return;
        if (reconcileOrder(turn, keys) === turn) return;
        writeTurn(current => reconcileOrder(current, keys));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keys.join('|'), turn, userId]);

    const write = useCallback((combatant, patch) => {
        if (combatant.kind === 'player') return updateDoc(doc(db, 'characters', combatant.key), patch).catch(error => alert(error));
        return Promise.resolve(updateEnemy(combatant.key, patch)).catch(error => alert(error));
    }, [updateEnemy]);

    const api = useMemo(() => ({
        openDrawer: (id, group) => setDrawer({ id, group }),
        setHp: (combatant, hp) => write(combatant, { current_health: hp.now, temporary_health: hp.temp }),
        setStatuses: (combatant, statuses) => write(combatant, { statuses }),
        setAp: (combatant, value) => write(combatant, { action_points: clamp(value, 0, combatant.ap.max) }),
        setReaction: (combatant, ready) => write(combatant, { reaction_used: !ready }),
        setHero: (combatant, value) => write(combatant, { hero_points: Math.max(0, value) }),
        setBaseStat: (combatant, stat, value) => write(combatant, { [stat]: value }),
        setField: (combatant, patch) => write(combatant, patch),
        setDefeated: (combatant, defeated) => write(combatant, { defeated }),
        // a reaction spends the reaction, anything else spends action points
        useAction: (combatant, action) => write(combatant, isReactionAction(action)
            ? { reaction_used: true }
            : { action_points: Math.max(0, combatant.ap.now - (Number(action.actionCost) || 0)) }),
        addStatus: combatant => setAddingFor(combatant),
        resetToTemplate: (combatant, template) => {
            const patch = {};
            ENEMY_STAT_FIELDS.filter(field => field !== 'enemy_name' && template[field] !== undefined).forEach(field => { patch[field] = structuredClone(template[field]); });
            patch.current_health = Math.min(combatant.hp.now, template.maximum_health ?? combatant.hp.now);
            return write(combatant, patch);
        },
        removeEnemy: combatant => removeEnemy(combatant.raw),
        setActiveTurn: combatant => writeTurn(current => setActive(current, tileKeyOf.get(combatant.id))),
        setActiveKey: key => writeTurn(current => setActive(current, key)),
        moveInOrder: (key, delta) => writeTurn(current => moveInOrder(current, key, delta)),
        // the next turn: the one who was acting loses what lasted until the end of their turn, a new
        // round ends what lasted a round, and the one who is up gets their action points back
        endTurn: async () => {
            const next = nextTurn(turn);
            if (next === turn) return;
            const ending = turn.active ? all.filter(item => tileKeyOf.get(item.id) === turn.active) : [];
            const starting = all.filter(item => tileKeyOf.get(item.id) === next.active);
            const newRound = next.round !== turn.round;
            await Promise.all(all.map(item => {
                let statuses = item.statuses;
                if (ending.includes(item)) statuses = withoutEnded(statuses, ['turn']);
                if (newRound) statuses = withoutEnded(statuses, ['round']);
                const patch = {};
                if (statuses.length !== item.statuses.length) patch.statuses = statuses;
                if (starting.includes(item)) {
                    const advanced = advanceTurnStatuses({ ...item.raw, action_points: item.ap.max, statuses });
                    return write(item, { ...advanced });
                }
                return Object.keys(patch).length > 0 ? write(item, patch) : null;
            }));
            await writeTurn(() => next);
        },
        // the scene is over: what was only for the scene ends with it
        endScene: () => Promise.all(all.map(item => {
            const statuses = withoutEnded(item.statuses, ['scene', 'turn', 'round']);
            return statuses.length === item.statuses.length ? null : write(item, { statuses });
        })),
    }), [write, removeEnemy, writeTurn, tileKeyOf, turn, all]);

    useEffect(() => { onApi?.(api); }, [api, onApi]);

    const zones = useMemo(() => new Map((party?.combat_tracker || []).map(post => [post.id, post.status])), [party]);
    const shown = drawer ? all.find(item => item.id === drawer.id) : null;
    const group = drawer?.group ? tiles.find(tile => tile.key === drawer.group) : null;
    const notes = useEntityNotes(campaignId, shown?.kind === 'player' ? shown.key : null);
    const template = shown?.kind === 'enemy' ? bestiary.find(entry => entry.id === shown.raw.templateId) : undefined;

    const value = useMemo(() => ({ players, tiles, turn, api, zones, tileKeyOf }), [players, tiles, turn, api, zones, tileKeyOf]);

    return <CombatContext.Provider value={value}>
        {children}
        {shown && <>
            <button type="button" className="Drawer-scrim" aria-label="Close" onClick={() => setDrawer(null)}/>
            <EntityDrawer key={drawer.group || shown.id} combatant={group ? group.base : shown} members={group?.members} zone={zones.get(shown.id)} api={api}
                active={turn.active === tileKeyOf.get(shown.id)} template={template} notes={notes} userId={userId} onClose={() => setDrawer(null)}/>
        </>}
        {addingFor && <AddStatusDialog characterPage={{ ...addingFor.raw, campaign: addingFor.raw.campaign || campaignId }} userId={userId} onClose={() => setAddingFor(null)}
            onUpdateStatuses={statuses => write(addingFor, { statuses })}/>}
    </CombatContext.Provider>;
}
