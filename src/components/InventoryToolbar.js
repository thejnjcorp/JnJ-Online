import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ItemPicker } from './ItemPicker';
import { addItemToCharacter } from '../utils/partyInventory';
import '../styles/Party.scss';

// Above a character's inventory: add an item from the item database (to the first
// free slot, or onto a stack of it) and a way to the party inventory, where things
// are shared and traded. Only for someone who may change the inventory. `members` are
// the uids of everyone in the campaign, who can read items made here.
export function InventoryToolbar({ characterId, campaignId, userId, members = [] }) {
    const [adding, setAdding] = useState(false);

    async function add(item, quantity) {
        await addItemToCharacter(characterId, { id: item.id, item_name: item.item_name }, quantity);
    }

    return <div className="InventoryToolbar">
        <div className="InventoryToolbar-row">
            <button type="button" className="Party-button Party-button-primary" aria-pressed={adding} onClick={() => setAdding(!adding)}>Add item</button>
            <Link className="Party-button" to="/item-list">Item database</Link>
            {campaignId && <Link className="Party-button" to={`/party/${campaignId}?tab=inventory`}>Party inventory</Link>}
        </div>
        {adding && <ItemPicker userId={userId} shareWith={members} onPick={add} onClose={() => setAdding(false)} title="Add an item to this inventory"/>}
    </div>;
}
