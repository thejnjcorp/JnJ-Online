import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { useTagCatalog } from '../utils/useTagCatalog';
import { visibilityLabel } from '../utils/tags';
import '../styles/StatusListPage.scss';
import '../styles/TagPage.scss';

const OWNERSHIP_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'mine', label: 'Mine' },
    { key: 'public', label: 'Public' },
];

// The tag catalog: every tag the viewer can see, filterable by who made it and
// by which class it is for. Choosing one opens it (editable if it's theirs).
export function TagListPage() {
    const { tags, status } = useTagCatalog();
    const [userId, setUserId] = useState('');
    const [ownership, setOwnership] = useState('all');
    const [scope, setScope] = useState('all');
    const navigate = useNavigate();
    document.title = 'Tags';

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => { if (user) setUserId(user.uid); });
        return () => unsubscribe();
    }, []);

    const classNames = useMemo(() => [...new Set(tags.flatMap(tag => tag.classes || []))].sort((a, b) => a.localeCompare(b)), [tags]);
    const shown = tags
        .filter(tag => ownership === 'all' || (ownership === 'mine' && tag.canWrite?.includes(userId)) || (ownership === 'public' && tag.public))
        .filter(tag => scope === 'all' || (scope === 'general' ? !tag.classes?.length : tag.classes?.includes(scope)))
        .sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)) || (a.tagInfo || '').localeCompare(b.tagInfo || ''));

    const scopes = [{ key: 'all', label: 'All' }, { key: 'general', label: 'General' }, ...classNames.map(name => ({ key: name, label: name }))];

    return <div className="StatusListPage">
        <div className="StatusListPage-inner">
            <div className="StatusListPage-header">
                <h1 className="StatusListPage-title">Tags</h1>
                <p className="StatusListPage-subtitle">Labels for actions - Fire, Melee, Reaction. General tags are open to every class; the rest are for particular classes. Players can filter and sort their actions by them.</p>
            </div>

            <div className="StatusListPage-filter-groups">
                <div className="StatusListPage-filters" role="group" aria-label="Whose">
                    {OWNERSHIP_FILTERS.map(option =>
                        <button type="button" key={option.key}
                            className={ownership === option.key ? 'StatusListPage-filter-button StatusListPage-filter-button-active' : 'StatusListPage-filter-button'}
                            aria-pressed={ownership === option.key}
                            onClick={() => setOwnership(option.key)}
                        >{option.label}</button>
                    )}
                </div>
                <div className="StatusListPage-filters" role="group" aria-label="For">
                    {scopes.map(option =>
                        <button type="button" key={option.key}
                            className={scope === option.key ? 'StatusListPage-filter-button StatusListPage-filter-button-active' : 'StatusListPage-filter-button'}
                            aria-pressed={scope === option.key}
                            onClick={() => setScope(option.key)}
                        >{option.label}</button>
                    )}
                </div>
            </div>

            <div className="StatusListPage-grid">
                {shown.map(tag =>
                    <button type="button" key={tag.id} className="StatusListPage-card StatusListPage-card-neutral" onClick={() => navigate('/tags/' + tag.id)}>
                        <div className="StatusListPage-card-header">
                            <span className="TagPage-pill" style={{ backgroundColor: tag.tagColor, color: tag.textColor }}>{tag.tagInfo || 'Unnamed'}</span>
                        </div>
                        <div className="StatusListPage-card-visibility">{visibilityLabel(tag)}</div>
                        <div className="StatusListPage-card-classes">{tag.classes?.length > 0 ? tag.classes.join(', ') : 'Any class'}</div>
                        {tag.tagDescription && <div className="StatusListPage-card-description">{tag.tagDescription}</div>}
                    </button>
                )}
                {shown.length === 0 && <div className="StatusListPage-empty">
                    {status === 'error' ? "Couldn't load the tags." : status === 'loading' ? 'Loading…' : 'No tags match these filters.'}
                </div>}
            </div>

            <button type="button" className="StatusListPage-create-button" onClick={() => navigate('/tags')}>+ Create New Tag</button>
        </div>
    </div>;
}
