import { useState } from 'react';
import { ItemLine } from './ItemLine';
import { ItemPicker } from './ItemPicker';
import { MAX_QUANTITY, holdingsOf, isItemEntry, quantityOf } from '../utils/inventory';
import { addToParty, putInParty, removePartyEntry, setPartyQuantity, takeFromParty } from '../utils/partyInventory';
import { shareItem } from '../utils/itemAccess';
import '../styles/Party.scss';

const wholeNumber = (value, max) => Math.min(max, Math.max(1, Math.floor(Number(value)) || 1));

// A number box for "how many", and the button that uses it.
function AmountAction({ label, max, onDo, disabled }) {
    const [amount, setAmount] = useState(1);
    return <span className="Party-amount">
        <input className="Party-input Party-input-narrow" type="number" min={1} max={max} aria-label={`How many to ${label.toLowerCase()}`} value={amount} onChange={event => setAmount(event.target.value)}/>
        <button type="button" className="Party-button" disabled={disabled} onClick={() => onDo(wholeNumber(amount, max))}>{label}</button>
    </span>;
}

// The party's shared inventory - what the party has between them - and the character
// the viewer is playing, side by side: anyone can put something in from the item
// database, take something out into their character's inventory, or change how many
// there are; and a character can put what they are carrying in. A director who wants
// to give the players something puts it in here.
export function PartyInventoryTab({ campaignId, party, loaded, acting, userId, members }) {
    const [adding, setAdding] = useState(false);
    const [message, setMessage] = useState('');
    const entries = Array.isArray(party.inventory) ? party.inventory : [];
    const carrying = acting ? holdingsOf(acting) : [];

    async function run(action) {
        setMessage('');
        try {
            await action();
        } catch (error) {
            setMessage(error.message);
        }
    }

    async function addFromDatabase(item, quantity) {
        await addToParty(campaignId, { id: item.id, item_name: item.item_name }, quantity, userId);
        await shareItem(item, members, userId);
    }

    return <div className="PartyInventory">
        {message && <div className="Party-error" role="alert">{message}</div>}

        <section className="Party-section" aria-label="Party inventory">
            <div className="Party-section-header">
                <h2 className="Party-section-title">Party inventory</h2>
                <button type="button" className="Party-button Party-button-primary" aria-pressed={adding} onClick={() => setAdding(!adding)}>Add an item</button>
            </div>
            {adding && <ItemPicker userId={userId} shareWith={members} onPick={addFromDatabase} onClose={() => setAdding(false)} title="Add an item to the party inventory"/>}
            {!loaded && <div className="Party-hint">Loading…</div>}
            {loaded && entries.length === 0 && <div className="Party-hint">Nothing here yet. Add what the party finds or buys, or give the players something as their director.</div>}
            <ul className="Party-list">
                {entries.map(entry => <li key={entry.id} className="Party-list-item">
                    <ItemLine itemId={isItemEntry(entry) ? entry.item_id : ''} title={entry.title} content={entry.content} quantity={quantityOf(entry)}>
                        {acting && isItemEntry(entry) && <AmountAction label="Take" max={quantityOf(entry)} onDo={quantity => run(() => takeFromParty({ campaignId, characterId: acting.character_id, itemId: entry.item_id, title: entry.title, quantity }))}/>}
                        {isItemEntry(entry) && <span className="Party-quantity" role="group" aria-label={`Quantity of ${entry.title}`}>
                            <button type="button" className="Party-button" aria-label={`One fewer ${entry.title}`} onClick={() => run(() => setPartyQuantity(campaignId, entry.id, quantityOf(entry) - 1))}>−</button>
                            <button type="button" className="Party-button" aria-label={`One more ${entry.title}`} disabled={quantityOf(entry) >= MAX_QUANTITY} onClick={() => run(() => setPartyQuantity(campaignId, entry.id, quantityOf(entry) + 1))}>+</button>
                        </span>}
                        <button type="button" className="Party-button Party-button-danger" aria-label={`Remove ${entry.title}`} onClick={() => run(() => removePartyEntry(campaignId, entry.id))}>Remove</button>
                    </ItemLine>
                </li>)}
            </ul>
        </section>

        {acting && <section className="Party-section" aria-label={`${acting.character_name}'s inventory`}>
            <div className="Party-section-header">
                <h2 className="Party-section-title">{acting.character_name} is carrying</h2>
            </div>
            {carrying.length === 0 && <div className="Party-hint">Nothing that can be put in the party inventory - add items from the character's Inventory tab.</div>}
            <ul className="Party-list">
                {carrying.map(held => <li key={held.item_id} className="Party-list-item">
                    <ItemLine itemId={held.item_id} title={held.title} quantity={held.quantity}>
                        <AmountAction label="Put in party" max={held.quantity} onDo={quantity => run(() => putInParty({ campaignId, characterId: acting.character_id, itemId: held.item_id, title: held.title, quantity, userId }))}/>
                    </ItemLine>
                </li>)}
            </ul>
        </section>}
        {!acting && <div className="Party-hint">You don't have a character in this campaign, so there is nothing to take items into. Directors can still add and remove items above.</div>}
    </div>;
}
