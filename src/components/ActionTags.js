import { useMemo, useState } from 'react';
import { namedTags, snapshotTag, tagKey, tagsForClass } from '../utils/tags';
import '../styles/ActionTags.scss';

const pillStyle = tag => (tag.tagColor ? { backgroundColor: tag.tagColor, color: tag.textColor } : undefined);

function Picker({ catalog, forClass, taken, onPick, onCustom, onClose }) {
    const [search, setSearch] = useState('');
    const offered = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return tagsForClass(catalog.tags, forClass)
            .filter(tag => !taken.has(tag.id))
            .filter(tag => !needle || (tag.tagInfo || '').toLowerCase().includes(needle));
    }, [catalog.tags, forClass, taken, search]);
    const general = offered.filter(tag => !tag.classes?.length);
    const scoped = offered.filter(tag => tag.classes?.length);

    const group = (title, tags) => tags.length > 0 && <div className="ActionTags-group" role="group" aria-label={title}>
        <div className="ActionTags-group-title">{title}</div>
        <div className="ActionTags-options">
            {tags.map(tag => <button
                type="button"
                key={tag.id}
                className="ActionTags-option"
                title={tag.tagDescription || undefined}
                onClick={() => onPick(tag)}
            >
                <span className="ActionTags-pill" style={pillStyle(tag)}>{tag.tagInfo}</span>
            </button>)}
        </div>
    </div>;

    return <div className="ActionTags-picker">
        <input
            className="ClassPage-field-input"
            type="search"
            placeholder="Search tags"
            aria-label="Search tags"
            value={search}
            onChange={event => setSearch(event.target.value)}
        />
        {catalog.status === 'loading' && <div className="ClassPage-hint">Loading tags…</div>}
        {catalog.status === 'error' && <div className="ClassPage-hint" role="alert">Couldn't load the tag catalog. You can still add a custom tag.</div>}
        {catalog.status === 'ready' && offered.length === 0 && <div className="ClassPage-hint">
            {catalog.tags.length === 0 ? 'No tags in the catalog yet - make some on the Tags page, or add a custom one.' : 'No more tags match.'}
        </div>}
        {group('General', general)}
        {group(forClass ? `For ${forClass}` : 'For particular classes', scoped)}
        <div className="ActionTags-picker-footer">
            <button type="button" className="ClassPage-add-tag-button" onClick={onCustom}>Custom tag…</button>
            <button type="button" className="ClassPage-add-tag-button" onClick={onClose}>Done</button>
        </div>
    </div>;
}

// The tags on one action. Viewing shows them as pills; editing adds a picker
// for the tag catalog (general tags and ones for this class) and a way to
// write a one-off tag of your own. `catalog` is { tags, status } from
// useTagCatalog.
export function ActionTags({ tags = [], isEditable, catalog = { tags: [], status: 'ready' }, forClass, onAdd, onRemove, onCustom, onEditCustom }) {
    const [picking, setPicking] = useState(false);
    const shown = tags.map((tag, index) => ({ tag, index })).filter(({ tag }) => namedTags({ tags: [tag] }).length > 0 || isEditable);
    const taken = useMemo(() => new Set(tags.map(tag => tag.tagId).filter(Boolean)), [tags]);
    const takenKeys = new Set(tags.map(tagKey));

    return <div className="ActionTags">
        <div className="ClassPage-tags-row">
            <span className="ClassPage-field-label">Tags</span>
            {isEditable && <button type="button" className="ClassPage-add-tag-button" aria-expanded={picking} onClick={() => setPicking(open => !open)}>+ Tag</button>}
        </div>

        <div className="ActionTags-pills">
            {shown.length === 0 && !isEditable && <span className="ClassPage-hint">No tags.</span>}
            {shown.map(({ tag, index }) => {
                const label = tag.tagInfo?.trim() || 'Unnamed tag';
                if (!isEditable) return <span key={tag.id || index} className="ActionTags-pill" style={pillStyle(tag)} title={tag.tagDescription}>{tag.tagInfo}</span>;
                return <span key={tag.id || index} className="ActionTags-editable">
                    {tag.tagId
                        ? <span className="ActionTags-pill" style={pillStyle(tag)} title={tag.tagDescription}>{label}</span>
                        : <button type="button" className="ActionTags-pill ActionTags-pill-button" style={pillStyle(tag)} title="Edit this custom tag" onClick={() => onEditCustom(index)}>{label}</button>}
                    <button type="button" className="ActionTags-remove" aria-label={`Remove tag ${label}`} onClick={() => onRemove(index)}>×</button>
                </span>;
            })}
        </div>

        {isEditable && picking && <Picker
            catalog={catalog}
            forClass={forClass}
            taken={taken}
            onPick={tag => { if (!takenKeys.has(tag.id)) onAdd(snapshotTag(tag)); }}
            onCustom={() => { setPicking(false); onCustom(); }}
            onClose={() => setPicking(false)}
        />}
    </div>;
}
