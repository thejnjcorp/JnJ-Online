import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { useItemCatalog } from '../utils/useItems';
import { itemMatches, sortItems, tagsOf } from '../utils/items';
import { imageSrc } from '../utils/imageRefs';
import '../styles/StatusListPage.scss';
import '../styles/BestiaryPage.scss';
import '../styles/ItemPage.scss';

const OWNERSHIP_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'mine', label: 'Mine' },
    { key: 'public', label: 'Public' },
];

// The item database: every item you can see - the public ones and your own - to
// search, filter by tag and open, and where you make new ones. Inventories refer to
// these, so a torch or a rope is written once for every table.
export function ItemListPage() {
    const { items, status } = useItemCatalog();
    const [userId, setUserId] = useState('');
    const [ownership, setOwnership] = useState('all');
    const [tag, setTag] = useState('');
    const [search, setSearch] = useState('');
    const navigate = useNavigate();
    document.title = 'Items';

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => { if (user) setUserId(user.uid); });
        return () => unsubscribe();
    }, []);

    const shown = sortItems(items
        .filter(item => ownership === 'all' || (ownership === 'mine' && item.canWrite?.includes(userId)) || (ownership === 'public' && item.isPublic))
        .filter(item => itemMatches(item, search, tag)));
    const tags = tagsOf(items);

    return <div className="StatusListPage">
        <div className="StatusListPage-inner">
            <div className="StatusListPage-header">
                <h1 className="StatusListPage-title">Items</h1>
                <p className="StatusListPage-subtitle">The item database. Write a thing once - a torch, a rope, a magic dagger - and put it in any inventory.</p>
            </div>

            <div className="StatusListPage-filter-groups">
                <div className="StatusListPage-filters" role="group" aria-label="Whose">
                    {OWNERSHIP_FILTERS.map(option => <button type="button" key={option.key}
                        className={ownership === option.key ? 'StatusListPage-filter-button StatusListPage-filter-button-active' : 'StatusListPage-filter-button'}
                        aria-pressed={ownership === option.key}
                        onClick={() => setOwnership(option.key)}
                    >{option.label}</button>)}
                </div>
                {tags.length > 0 && <div className="StatusListPage-filters" role="group" aria-label="Tag">
                    <button type="button"
                        className={tag === '' ? 'StatusListPage-filter-button StatusListPage-filter-button-active' : 'StatusListPage-filter-button'}
                        aria-pressed={tag === ''}
                        onClick={() => setTag('')}
                    >Any tag</button>
                    {tags.map(name => <button type="button" key={name}
                        className={tag === name ? 'StatusListPage-filter-button StatusListPage-filter-button-active' : 'StatusListPage-filter-button'}
                        aria-pressed={tag === name}
                        onClick={() => setTag(name)}
                    >{name}</button>)}
                </div>}
                <input className="BestiaryPage-search" type="search" placeholder="Search items" aria-label="Search items" value={search} onChange={event => setSearch(event.target.value)}/>
            </div>

            <div className="StatusListPage-grid">
                {shown.map(item => <button type="button" key={item.id} className="StatusListPage-card StatusListPage-card-neutral" onClick={() => navigate('/items/' + item.id)}>
                    <div className="StatusListPage-card-header">
                        {item.item_image && <img className="ItemList-thumb" src={imageSrc(item.item_image)} alt="" loading="lazy"/>}
                        <span className="StatusListPage-card-name">{item.item_name || 'Unnamed'}</span>
                    </div>
                    {item.item_description && <p className="ItemList-description">{item.item_description}</p>}
                    {(item.tags || []).length > 0 && <div className="ItemList-tags">{item.tags.map(name => <span className="ItemList-tag" key={name}>{name}</span>)}</div>}
                    <div className="StatusListPage-card-visibility">{item.isPublic ? 'Public' : 'Private'}</div>
                </button>)}
                {shown.length === 0 && <div className="StatusListPage-empty">
                    {status === 'error' ? "Couldn't load the item database." : status === 'loading' ? 'Loading…' : items.length === 0 ? 'No items yet - create your first.' : 'No items match these filters.'}
                </div>}
            </div>

            <button type="button" className="StatusListPage-create-button" onClick={() => navigate('/items')}>+ Create New Item</button>
        </div>
    </div>;
}
