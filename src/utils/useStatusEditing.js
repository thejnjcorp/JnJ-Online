import { useCallback, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { clampStacks } from './statusEffects';

// The statuses on a character (or, via onUpdateStatuses, a Director-managed
// NPC - see Statuses.js) plus which one's popup is open and every way of
// changing them, shared by the vitals panel and the combat tab's sticky bar.
// hasWritePermissions, when given, overrides the owner/co-writer check.
export function useStatusEditing({ characterPage, userId, onUpdateStatuses, hasWritePermissions: override }) {
    const [openId, setOpenId] = useState(null);
    let canWrite = false;
    if (override !== undefined) canWrite = override;
    else if (userId) canWrite = characterPage.userId === userId || characterPage.canWrite?.includes(userId);
    const statuses = characterPage.statuses || [];
    const openStatus = statuses.find(s => s.id === openId);

    const close = useCallback(() => setOpenId(null), []);
    const toggleOpen = statusId => setOpenId(prev => prev === statusId ? null : statusId);

    async function writeStatuses(nextStatuses) {
        if (onUpdateStatuses) await onUpdateStatuses(nextStatuses);
        else await updateDoc(doc(db, "characters", characterPage.character_id), { statuses: nextStatuses });
    }

    async function removeStatus(status) {
        try {
            await writeStatuses(statuses.filter(s => s.id !== status.id));
            setOpenId(null);
        } catch (e) {
            alert(e);
        }
    }

    async function clearAll() {
        if (!window.confirm(`Remove all ${statuses.length} status${statuses.length === 1 ? '' : 'es'}?`)) return;
        try {
            await writeStatuses([]);
            setOpenId(null);
        } catch (e) {
            alert(e);
        }
    }

    // A single whole-array write (rather than an arrayRemove+arrayUnion pair,
    // which Firestore can't apply as one atomic transform on the same field)
    // computed from the live statuses - the same "increase the
    // Exhaustion/Wounded count" use case the Add Status dialog's stepper
    // covers at add-time, now usable after the fact too.
    async function changeStacks(status, delta) {
        const newStacks = clampStacks(status.stacks + delta);
        if (newStacks === status.stacks) return;
        try {
            await writeStatuses(statuses.map(s => s.id === status.id ? { ...s, stacks: newStacks } : s));
        } catch (e) {
            alert(e);
        }
    }

    return { statuses, canWrite, openStatus, toggleOpen, close, removeStatus, clearAll, changeStacks };
}
