import { SORTS, filterOptions, isFilterActive } from '../utils/tags';
import '../styles/ActionViewControls.scss';

const toggle = (list, key) => (list.includes(key) ? list.filter(item => item !== key) : [...list, key]);

// Filter and sort for the Combat tab's action lists: choose the kinds of action
// (feat, passive, reaction, action) and the tags to show, and how to order them.
// Only what the character's actions actually have is offered.
export function ActionViewControls({ actions, filter, onFilter, sort, onSort }) {
    if (actions.length < 2) return null;
    const { categories, tags } = filterOptions(actions);
    const showCategories = categories.length > 1;

    return <div className="ActionViewControls" role="group" aria-label="Filter and sort actions">
        {showCategories && <div className="ActionViewControls-group" role="group" aria-label="Type">
            <span className="ActionViewControls-label">Type</span>
            {categories.map(category => <button
                type="button"
                key={category.key}
                className={filter.categories.includes(category.key) ? 'ActionViewControls-chip ActionViewControls-chip-on' : 'ActionViewControls-chip'}
                aria-pressed={filter.categories.includes(category.key)}
                onClick={() => onFilter({ ...filter, categories: toggle(filter.categories, category.key) })}
            >{category.label}</button>)}
        </div>}

        {tags.length > 0 && <div className="ActionViewControls-group" role="group" aria-label="Tags">
            <span className="ActionViewControls-label">Tags</span>
            {tags.map(tag => {
                const on = filter.tags.includes(tag.key);
                return <button
                    type="button"
                    key={tag.key}
                    className={on ? 'ActionViewControls-chip ActionViewControls-chip-on' : 'ActionViewControls-chip'}
                    style={on && tag.tagColor ? { backgroundColor: tag.tagColor, color: tag.textColor, borderColor: tag.tagColor } : undefined}
                    aria-pressed={on}
                    onClick={() => onFilter({ ...filter, tags: toggle(filter.tags, tag.key) })}
                >{tag.label}</button>;
            })}
        </div>}

        <div className="ActionViewControls-group">
            <label className="ActionViewControls-label" htmlFor="action-sort">Sort</label>
            <select id="action-sort" className="ActionViewControls-sort" value={sort} onChange={event => onSort(event.target.value)}>
                {SORTS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
            {isFilterActive(filter) && <button type="button" className="ActionViewControls-clear" onClick={() => onFilter({ categories: [], tags: [] })}>Clear filters</button>}
        </div>
    </div>;
}
