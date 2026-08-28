import { useState } from 'react';
import Markdown from 'markdown-to-jsx';
import { ClassTagEditDialog } from './ClassTagEditDialog';

const OUTCOME_ROWS = [
    { key: 'criticalSuccess', label: 'Critical Success' },
    { key: 'success', label: 'Success' },
    { key: 'failure', label: 'Failure' },
    { key: 'criticalFailure', label: 'Critical Failure' },
];

const ACTION_TYPE_OPTIONS = [
    { key: 'standard', label: 'Standard' },
    { key: 'perDay', label: 'Per Day' },
    { key: 'perShortRest', label: 'Per Short Rest' },
    { key: 'perCombat', label: 'Per Combat' },
];

const CATEGORY_OPTIONS = [
    { key: 'feat', label: 'Feat' },
    { key: 'passive', label: 'Passive' },
    { key: 'reaction', label: 'Reaction' },
    { key: 'action', label: 'Action' },
];

function PillGroup({ options, selected, onPick, groupClassName = 'ClassPage-pill-group' }) {
    return <div className={groupClassName}>
        {options.map(o => <button
            type="button"
            key={o.key}
            className={o.key === selected ? 'ClassPage-pill ClassPage-pill-selected' : 'ClassPage-pill'}
            onClick={() => onPick(o.key)}
        >{o.label}</button>)}
    </div>;
}

function frequencyLabel(action) {
    const base = ACTION_TYPE_OPTIONS.find(o => o.key === action.actionType)?.label || action.actionType;
    return action.actionType !== 'standard' && action.actionTypeCount ? `${base} ×${action.actionTypeCount}` : base;
}

function resolveSummary(action) {
    return action.toHitBool ? `+${action.toHit || 0} to hit` : `DC (${action.difficultyClass || '—'})`;
}

// One action/passive/reaction/feat's collapsible card - handles both the
// read-only View rendering and the Edit form for the same action, since
// they share the open/close and tag-dialog state. `isEditable` is only ever
// true for someone with write access who has explicitly opted into edit
// mode on the page (see ClassPage.js) - there is no third "disabled input"
// state anymore, View mode replaces it.
export function ClassActionEditor({ action, index, onChange, onRemove, onAddTag, onRemoveTag, isEditable }) {
    const [open, setOpen] = useState(false);
    const [showOutcomeTable, setShowOutcomeTable] = useState(Boolean(action.outcomeTable));
    const [openTagIndex, setOpenTagIndex] = useState(null);
    const category = action.category || 'action';
    const hasOutcomeTable = action.outcomeTable && Object.values(action.outcomeTable).some(Boolean);

    const set = (name, value) => onChange({ name: `actions[${index}].${name}`, value });
    const handleChange = event => {
        const { name, type, checked, value } = event.target;
        const newValue = type === 'checkbox' ? checked : value;
        set(name, type === 'number' ? Number(newValue) : newValue);
    };

    return <div className="ClassPage-action-card">
        <button type="button" className="ClassPage-action-card-header" onClick={() => setOpen(!open)}>
            <span className={open ? 'ClassPage-action-chevron ClassPage-action-chevron-open' : 'ClassPage-action-chevron'}>›</span>
            <span className={`ClassPage-cost-pip ClassPage-cost-pip-${Math.min(action.actionCost || 0, 3)}`}>{action.actionCost || 0}</span>
            <span className="ClassPage-action-name">{action.actionName || 'Unnamed'}</span>
            <span className="ClassPage-level-badge">Lvl {action.actionLevel || 1}</span>
            <span className="ClassPage-frequency-badge">{frequencyLabel(action)}</span>
        </button>

        {open && <div className="ClassPage-action-card-body">
            {isEditable ? <>
                <div className="ClassPage-field-row">
                    <div className="ClassPage-field-grow">
                        <span className="ClassPage-field-label">Action Name</span>
                        <input className="ClassPage-field-input" name="actionName" onChange={handleChange} defaultValue={action.actionName}/>
                    </div>
                    <div>
                        <span className="ClassPage-field-label">Cost</span>
                        <input className="ClassPage-field-input ClassPage-field-input-narrow" name="actionCost" type="number" min={0} max={3} onChange={handleChange} defaultValue={action.actionCost}/>
                    </div>
                    <div>
                        <span className="ClassPage-field-label">Level</span>
                        <input className="ClassPage-field-input ClassPage-field-input-narrow" name="actionLevel" type="number" min={1} max={15} onChange={handleChange} defaultValue={action.actionLevel}/>
                    </div>
                    <div>
                        <span className="ClassPage-field-label">Range</span>
                        <input className="ClassPage-field-input" name="range" onChange={handleChange} defaultValue={action.range} placeholder="1 Zone"/>
                    </div>
                </div>

                <div className="ClassPage-field-row">
                    <div>
                        <span className="ClassPage-field-label">Frequency</span>
                        <PillGroup options={ACTION_TYPE_OPTIONS} selected={action.actionType} onPick={v => set('actionType', v)}/>
                    </div>
                    {action.actionType !== 'standard' && <div>
                        <span className="ClassPage-field-label">Times</span>
                        <input className="ClassPage-field-input ClassPage-field-input-narrow" name="actionTypeCount" type="number" min={0} onChange={handleChange} defaultValue={action.actionTypeCount}/>
                    </div>}
                    <div>
                        <span className="ClassPage-field-label">Resolves via</span>
                        <PillGroup
                            options={[{ key: 'toHit', label: 'To-Hit' }, { key: 'dc', label: 'Difficulty Class' }]}
                            selected={action.toHitBool ? 'toHit' : 'dc'}
                            onPick={v => set('toHitBool', v === 'toHit')}
                        />
                    </div>
                    {action.toHitBool ? <div>
                        <span className="ClassPage-field-label">To-Hit Mod</span>
                        <input className="ClassPage-field-input ClassPage-field-input-narrow" name="toHit" type="number" onChange={handleChange} defaultValue={action.toHit}/>
                    </div> : <div>
                        <span className="ClassPage-field-label">DC (stat, mod)</span>
                        <input className="ClassPage-field-input" name="difficultyClass" onChange={handleChange} defaultValue={action.difficultyClass} placeholder="Dex,0"/>
                    </div>}
                </div>

                <div className="ClassPage-field-row">
                    <div>
                        <span className="ClassPage-field-label">Category</span>
                        <PillGroup options={CATEGORY_OPTIONS} selected={category} onPick={v => set('category', v)}/>
                    </div>
                    {category === 'reaction' && <div className="ClassPage-field-grow">
                        <span className="ClassPage-field-label">Trigger</span>
                        <input className="ClassPage-field-input" name="trigger" onChange={handleChange} defaultValue={action.trigger} placeholder="A Physical ranged attack targeting you"/>
                    </div>}
                    {(category === 'reaction' || category === 'action') && <div className="ClassPage-field-grow">
                        <span className="ClassPage-field-label">Requirement</span>
                        <input className="ClassPage-field-input" name="requirement" onChange={handleChange} defaultValue={action.requirement} placeholder="You are not Engaged"/>
                    </div>}
                </div>

                <div>
                    <span className="ClassPage-field-label">Description</span>
                    <textarea className="ClassPage-field-input ClassPage-field-textarea" name="description" onChange={handleChange} defaultValue={action.description}/>
                    <div className="ClassPage-hint">Supports Markdown - **bold**, *italic*, and bullet lists (- item).</div>
                </div>

                <label className="ClassPage-outcome-table-toggle">
                    <input type="checkbox" checked={showOutcomeTable} onChange={e => setShowOutcomeTable(e.target.checked)}/>
                    {"\xa0Has outcome table? (Critical Success / Success / Failure / Critical Failure)"}
                </label>
                {showOutcomeTable && <div className="ClassPage-outcome-rows">
                    {OUTCOME_ROWS.map(row => <div className="ClassPage-outcome-row" key={row.key}>
                        <span className="ClassPage-field-label">{row.label}</span>
                        <input
                            className="ClassPage-field-input"
                            onChange={e => set(`outcomeTable.${row.key}`, e.target.value)}
                            defaultValue={action.outcomeTable?.[row.key]}
                        />
                    </div>)}
                </div>}
            </> : <>
                <div className="ClassPage-action-meta">
                    {[action.range, resolveSummary(action), action.actionType !== 'standard' ? frequencyLabel(action) : null].filter(Boolean).join(' · ')}
                </div>
                {(action.trigger || action.requirement) && <div className="ClassPage-action-trigger-requirement">
                    {action.trigger && <div><strong>Trigger:</strong> {action.trigger}</div>}
                    {action.requirement && <div><strong>Requirement:</strong> {action.requirement}</div>}
                </div>}
                <div className="ClassPage-action-description"><Markdown options={{ disableParsingRawHTML: true }}>{action.description || ''}</Markdown></div>
                {hasOutcomeTable && <table className="ClassPage-outcome-table">
                    <tbody>
                        {OUTCOME_ROWS.map(row => action.outcomeTable[row.key] &&
                            <tr key={row.key}><th>{row.label}</th><td>{action.outcomeTable[row.key]}</td></tr>
                        )}
                    </tbody>
                </table>}
            </>}

            <div className="ClassPage-tags-row">
                <span className="ClassPage-field-label">Tags</span>
                {isEditable && <button type="button" className="ClassPage-add-tag-button" onClick={() => onAddTag(index)}>+ Tag</button>}
            </div>
            <div className="ClassPage-tag-pills">
                {(action.tags || []).map((tag, tagIndex) => isEditable
                    ? <button type="button" key={tag.id || tagIndex} className="ClassPage-tag-pill" style={{ backgroundColor: tag.tagColor, color: tag.textColor }} onClick={() => setOpenTagIndex(tagIndex)}>{tag.tagInfo}</button>
                    : <span key={tag.id || tagIndex} className="ClassPage-tag-pill" style={{ backgroundColor: tag.tagColor, color: tag.textColor }} title={tag.tagDescription}>{tag.tagInfo}</span>
                )}
            </div>

            {isEditable && <button type="button" className="ClassPage-remove-action-button" onClick={() => onRemove(index)}>Remove Action</button>}
        </div>}

        {openTagIndex !== null && action.tags?.[openTagIndex] && <ClassTagEditDialog
            actionIndex={index}
            tagIndex={openTagIndex}
            tag={action.tags[openTagIndex]}
            onChange={onChange}
            onClose={() => setOpenTagIndex(null)}
            onDelete={() => { onRemoveTag(index, openTagIndex); setOpenTagIndex(null); }}
        />}
    </div>;
}
