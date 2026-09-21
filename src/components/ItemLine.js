import { useState } from 'react';
import { Link } from 'react-router-dom';
import Markdown from 'markdown-to-jsx';
import { useItem } from '../utils/useItems';
import { imageSrc } from '../utils/imageRefs';
import '../styles/Party.scss';

// How an inventory entry (see inventory.js) is shown: by the item it refers to, read
// live from the item database, or - when the item can't be read, is gone, or hasn't
// loaded - by the name the entry kept. `item` is what useItem returns.
export function itemName(state, title) {
    return state?.item?.item_name || title || 'Unknown item';
}

export function ItemThumb({ item, className = 'Party-thumb' }) {
    return item?.item_image
        ? <img className={className} src={imageSrc(item.item_image)} alt="" loading="lazy"/>
        : <span className={`${className} Party-thumb-empty`} aria-hidden="true"/>;
}

// What an item is: its description, its tags, and a link to it in the database. `content`
// is the text of an entry from before items existed, which has no item to read.
export function ItemDetails({ state, content = '', showLink = true, legacy = false }) {
    const { item, status } = state;
    return <div className="ItemDetails">
        {status === 'error' && <p className="Party-hint">You can't see this item's details.</p>}
        {status === 'missing' && !legacy && <p className="Party-hint">This item is no longer in the item database.</p>}
        {item?.item_description && <div className="ItemDetails-description"><Markdown>{item.item_description}</Markdown></div>}
        {!item && content && <div className="ItemDetails-description"><Markdown>{content}</Markdown></div>}
        {item && !item.item_description && <p className="Party-hint">No description.</p>}
        {legacy && !content && <p className="Party-hint">No description.</p>}
        {(item?.tags || []).length > 0 && <div className="ItemList-tags">{item.tags.map(tag => <span className="ItemList-tag" key={tag}>{tag}</span>)}</div>}
        {showLink && item && <Link className="ItemDetails-link" to={'/items/' + item.id}>Open in the item database</Link>}
    </div>;
}

// One line of an inventory: the item's picture, its name, how many, and a way to open
// its details. `children` are the actions for the line (Take, Remove...), shown at its
// end. `itemId` is empty for an entry from before items existed, which is shown by its
// `title` and `content`.
export function ItemLine({ itemId, title, content = '', quantity = 1, children }) {
    const state = useItem(itemId);
    const [open, setOpen] = useState(false);
    const name = itemName(state, title);
    return <div className="ItemLine">
        <div className="ItemLine-row">
            <ItemThumb item={state.item}/>
            <button type="button" className="ItemLine-name" aria-expanded={open} onClick={() => setOpen(!open)}>
                <span>{name}</span>
                {quantity > 1 && <span className="ItemLine-quantity" aria-label={`quantity ${quantity}`}>×{quantity}</span>}
            </button>
            {children && <div className="ItemLine-actions">{children}</div>}
        </div>
        {open && <ItemDetails state={state} content={content} legacy={!itemId}/>}
    </div>;
}
