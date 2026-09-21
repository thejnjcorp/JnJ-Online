import { runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { partyDoc } from './party';
import { characterDoc } from './partyInventory';
import { confirmSide, isAgreed, newTrade, problemText, setOffer, settleTrade, sideOf, tidyItems } from './trades';

// Trades between characters (see trades.js), kept on the party doc as `trades`, with
// a short `trade_log` of the ones that went through - for the party's bookkeeping.
//
// Each change is a transaction on the party doc. Confirming the last half of an
// agreed trade also settles it, in the same transaction: both characters' inventories
// and the party doc change together, or - if someone can't carry what they're getting,
// or no longer has what they offered - none does, and the confirmation is refused
// with the reason. (A player can change another's inventory, and nothing else of
// theirs, in that transaction: see the characters rules.)

export const MAX_OPEN_TRADES = 20;
export const MAX_TRADE_LOG = 30;

const tradesOf = party => (Array.isArray(party?.trades) ? party.trades : []);
const logOf = party => (Array.isArray(party?.trade_log) ? party.trade_log : []);

// The party doc, changed by `change(party)` -> the fields to set (and the trade lookups
// it needs); runs inside one transaction.
function inTransaction(campaignId, run) {
    const partyRef = partyDoc(campaignId);
    return runTransaction(db, async transaction => {
        const snapshot = await transaction.get(partyRef);
        const party = snapshot.exists() ? snapshot.data() : {};
        const patch = await run({ party, transaction });
        if (patch) transaction.set(partyRef, patch, { merge: true });
    });
}

function findTrade(party, tradeId) {
    const trade = tradesOf(party).find(candidate => candidate.id === tradeId);
    if (!trade) throw new Error("That trade isn't open any more.");
    return trade;
}

const replaceTrade = (party, trade) => tradesOf(party).map(candidate => (candidate.id === trade.id ? trade : candidate));

// A character asks another (in the same campaign) to trade. A character can only be in
// one open trade at a time.
export function startTrade(campaignId, from, to) {
    return inTransaction(campaignId, ({ party }) => {
        if (from.character_id === to.character_id) throw new Error("A character can't trade with themselves.");
        const open = tradesOf(party);
        const busy = [from, to].find(character => open.some(trade => sideOf(trade, character.character_id)));
        if (busy) throw new Error(`${busy.character_name || 'That character'} is already in a trade.`);
        if (open.length >= MAX_OPEN_TRADES) throw new Error('There are too many open trades - finish or cancel some first.');
        return { trades: [...open, newTrade(from, to)] };
    });
}

// A character changes what they are putting in.
export function offerItems(campaignId, tradeId, characterId, items) {
    return inTransaction(campaignId, ({ party }) => {
        const trade = findTrade(party, tradeId);
        if (!sideOf(trade, characterId)) throw new Error("That character isn't in this trade.");
        return { trades: replaceTrade(party, setOffer(trade, characterId, tidyItems(items))) };
    });
}

export function cancelTrade(campaignId, tradeId) {
    return inTransaction(campaignId, ({ party }) => {
        findTrade(party, tradeId);
        return { trades: tradesOf(party).filter(trade => trade.id !== tradeId) };
    });
}

const describe = items => (items.length === 0 ? 'nothing' : items.map(line => (line.quantity > 1 ? `${line.quantity} ${line.title}` : line.title)).join(', '));

// A character agrees to the trade as it stands (or takes their agreement back). When
// both have agreed, it is carried out.
export function setConfirmed(campaignId, tradeId, characterId, confirmed = true) {
    return inTransaction(campaignId, async ({ party, transaction }) => {
        const trade = findTrade(party, tradeId);
        if (!sideOf(trade, characterId)) throw new Error("That character isn't in this trade.");
        const updated = confirmSide(trade, characterId, confirmed);
        if (!isAgreed(updated)) return { trades: replaceTrade(party, updated) };

        const refs = { a: characterDoc(updated.a.character_id), b: characterDoc(updated.b.character_id) };
        const [snapA, snapB] = await Promise.all([transaction.get(refs.a), transaction.get(refs.b)]);
        if (!snapA.exists() || !snapB.exists()) throw new Error("One of the characters in this trade can't be found.");

        const result = settleTrade(updated, { a: snapA.data(), b: snapB.data() });
        if (!result.ok) throw new Error(result.problems.map(problem => problemText(problem, updated)).join(' '));

        transaction.update(refs.a, result.a);
        transaction.update(refs.b, result.b);
        return {
            trades: tradesOf(party).filter(candidate => candidate.id !== tradeId),
            trade_log: [
                ...logOf(party),
                {
                    id: updated.id,
                    at: Date.now(),
                    a: { character_id: updated.a.character_id, character_name: updated.a.character_name, gave: describe(updated.a.items) },
                    b: { character_id: updated.b.character_id, character_name: updated.b.character_name, gave: describe(updated.b.items) },
                },
            ].slice(-MAX_TRADE_LOG),
        };
    });
}
