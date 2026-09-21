import { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useItemCatalog } from '../utils/useItems';
import { MAX_ITEM_NAME, itemMatches, normalizeTags, sortItems, tagsOf } from '../utils/items';
import { MAX_QUANTITY } from '../utils/inventory';
import { imageSrc } from '../utils/imageRefs';
import '../styles/Party.scss';

// Choose items from the item database to put somewhere - in an inventory, the party
// inventory - with how many. Search by name or description, filter by tag, or make a
// quick new item right here (private to you, and readable by `shareWith`: the
// uids of the campaign's members, so the party can see what you make).
//
// `onPick(item, quantity)` is called for each choice, and may return a promise (the
// row waits for it, and shows the error if it rejects); the picker stays open for the
// next. `onClose` closes it.
export function ItemPicker({ userId, shareWith = [], onPick, onClose, title = 'Add an item' }) {
    const { items, status, reload } = useItemCatalog();
    const [search, setSearch] = useState('');
    const [tag, setTag] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [busy, setBusy] = useState('');
    const [message, setMessage] = useState('');
    const [creating, setCreating] = useState(false);
    const [draft, setDraft] = useState({ name: '', description: '' });

    const shown = sortItems(items.filter(item => itemMatches(item, search, tag))).slice(0, 60);
    const tags = tagsOf(items);
    const amount = Math.min(MAX_QUANTITY, Math.max(1, Math.floor(Number(quantity)) || 1));

    async function choose(item) {
        setBusy(item.id);
        setMessage('');
        try {
            await onPick(item, amount);
        } catch (error) {
            setMessage(error.message);
        }
        setBusy('');
    }

    async function createAndChoose() {
        const name = draft.name.trim();
        if (name === '') { setMessage('Give the item a name.'); return; }
        setBusy('new');
        setMessage('');
        try {
            const fields = { item_name: name.slice(0, MAX_ITEM_NAME), item_description: draft.description, item_image: '', tags: normalizeTags([]), isPublic: false };
            const readers = [...new Set([userId, ...shareWith])];
            const ref = await addDoc(collection(db, 'items'), { ...fields, canRead: readers, canWrite: [userId], admins: [userId] });
            await onPick({ id: ref.id, ...fields, canRead: readers, canWrite: [userId], admins: [userId] }, amount);
            setDraft({ name: '', description: '' });
            setCreating(false);
            reload();
        } catch (error) {
            setMessage(error.message);
        }
        setBusy('');
    }

    return <section className="ItemPicker" aria-label={title}>
        <div className="ItemPicker-header">
            <h3 className="ItemPicker-title">{title}</h3>
            <button type="button" className="Party-button" onClick={onClose}>Done</button>
        </div>
        <div className="ItemPicker-controls">
            <input className="Party-input" type="search" aria-label="Search the item database" placeholder="Search the item database" value={search} onChange={event => setSearch(event.target.value)}/>
            {tags.length > 0 && <select className="Party-input" aria-label="Tag" value={tag} onChange={event => setTag(event.target.value)}>
                <option value="">Any tag</option>
                {tags.map(name => <option key={name} value={name}>{name}</option>)}
            </select>}
            <label className="ItemPicker-quantity">
                <span>How many</span>
                <input className="Party-input Party-input-narrow" type="number" min={1} max={MAX_QUANTITY} aria-label="How many" value={quantity} onChange={event => setQuantity(event.target.value)}/>
            </label>
        </div>
        {message && <div className="Party-error" role="alert">{message}</div>}
        {status === 'loading' && <div className="Party-hint">Loading the item database…</div>}
        {status === 'error' && <div className="Party-error" role="alert">Couldn't load the item database.</div>}
        <ul className="ItemPicker-list">
            {shown.map(item => <li key={item.id} className="ItemPicker-row">
                {item.item_image ? <img className="Party-thumb" src={imageSrc(item.item_image)} alt="" loading="lazy"/> : <span className="Party-thumb Party-thumb-empty" aria-hidden="true"/>}
                <span className="ItemPicker-text">
                    <span className="ItemPicker-name">{item.item_name}</span>
                    {item.item_description && <span className="ItemPicker-description">{item.item_description}</span>}
                </span>
                <button type="button" className="Party-button Party-button-primary" disabled={busy !== ''} aria-label={`Add ${item.item_name}`} onClick={() => choose(item)}>Add</button>
            </li>)}
        </ul>
        {status === 'ready' && shown.length === 0 && <div className="Party-hint">{items.length === 0 ? 'The item database is empty - make an item below.' : 'No items match.'}</div>}

        <div className="ItemPicker-create">
            {!creating
                ? <button type="button" className="Party-button" onClick={() => setCreating(true)}>+ Make a new item</button>
                : <>
                    <input className="Party-input" aria-label="New item name" placeholder="New item name" maxLength={MAX_ITEM_NAME + 20} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })}/>
                    <input className="Party-input" aria-label="New item description" placeholder="What it is (optional)" value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })}/>
                    <button type="button" className="Party-button Party-button-primary" disabled={busy !== ''} onClick={createAndChoose}>Make it and add</button>
                    <button type="button" className="Party-button" onClick={() => setCreating(false)}>Cancel</button>
                </>}
        </div>
    </section>;
}
