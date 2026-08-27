import { useState } from 'react';

const OUTCOME_ROWS = [
    { key: 'criticalSuccess', label: 'Critical Success' },
    { key: 'success', label: 'Success' },
    { key: 'failure', label: 'Failure' },
    { key: 'criticalFailure', label: 'Critical Failure' },
];

// One action/passive/reaction/feat's editor row, extracted out of
// ClassPage.js (which was a single 795-line file, ~180 of them for one
// generic action block) so the new per-category fields (trigger,
// requirement, outcome table) don't push it further into unmaintainable
// territory. Keeps using the exact same `onChange({name, value})` shape
// ClassPage.js's dotted-path formReducer already parses (e.g.
// `actions[3].outcomeTable.success`), so no changes were needed to that
// reducer to support the new nested fields.
export function ClassActionEditor({ action, index, onChange, onRemove, onAddTag, onRemoveTag, areTagsVisible, canWrite }) {
    const [showOutcomeTable, setShowOutcomeTable] = useState(Boolean(action.outcomeTable));
    const category = action.category || 'action';

    const handleChange = event => {
        const { name, type, checked, value } = event.target;
        const newValue = type === 'checkbox' ? checked : value;
        const newValue2 = type === 'number' ? Number(newValue) : value;
        onChange({ name, value: newValue2 });
    };

    return <div className='ClassPage-input'>
        Action Cost:
        <input
            className='ClassPage-input-box'
            style={{ width: 30 }}
            name={`actions[${index}].actionCost`}
            onChange={handleChange}
            required
            type='number' min={0} max={3}
            placeholder={0}
            defaultValue={action.actionCost}
            disabled={canWrite}
        />
        {"\xa0Range:"}
        <input
            className='ClassPage-input-box'
            name={`actions[${index}].range`}
            onChange={handleChange}
            required
            type='text'
            placeholder='1 Zone'
            defaultValue={action.range}
            disabled={canWrite}
        />
        {"\xa0To-Hit Action:"}
        <input
            className='ClassPage-input-box'
            name={`actions[${index}].toHitBool`}
            onChange={handleChange}
            required
            type='checkbox'
            defaultChecked={action.toHitBool}
            disabled={canWrite}
        />
        {action.toHitBool && <>
            {"\xa0To Hit Modifier:"}
            <input
                className='ClassPage-input-box'
                style={{ width: 40 }}
                name={`actions[${index}].toHit`}
                onChange={handleChange}
                required
                type="number"
                placeholder={1}
                defaultValue={action.toHit}
                disabled={canWrite}
            />
        </>}
        {!action.toHitBool && <>
            {"\xa0DC Modifier:"}
            <input
                className='ClassPage-input-box'
                style={{ width: 60 }}
                name={`actions[${index}].difficultyClass`}
                onChange={handleChange}
                required
                type="text"
                placeholder="Dex,0"
                defaultValue={action.difficultyClass}
                disabled={canWrite}
            />
        </>}
        {"\xa0Action Name:"}
        <input
            className='ClassPage-input-box'
            name={`actions[${index}].actionName`}
            onChange={handleChange}
            required
            type="text"
            defaultValue={action.actionName}
            disabled={canWrite}
        />
        <button className='ClassPage-add-tag-button' onClick={() => onAddTag(index)} disabled={canWrite}>
            Add Tag
        </button>
        <button className='ClassPage-remove-action-button' onClick={() => onRemove(index)} disabled={canWrite}>
            Remove Action
        </button>
        <br/>
        Action Level:
        <input
            className='ClassPage-input-box'
            style={{ width: 40 }}
            name={`actions[${index}].actionLevel`}
            onChange={handleChange}
            required
            type='number' min={1} max={15}
            placeholder={1}
            defaultValue={action.actionLevel}
            disabled={canWrite}
        />
        {"\xa0Action Type:"}
        <select
            className='ClassPage-input-box'
            name={`actions[${index}].actionType`}
            onChange={handleChange}
            required
            type='dropdown'
            defaultValue={action.actionType}
            disabled={canWrite}
        >
            <option value="standard">Standard</option>
            <option value="perDay">Per Day</option>
            <option value="perShortRest">Per Short Rest</option>
            <option value="perCombat">Per Combat</option>
        </select>
        {action.actionType !== "standard" && <input
            className='ClassPage-input-box'
            style={{ width: 30 }}
            name={`actions[${index}].actionTypeCount`}
            onChange={handleChange}
            required
            type='number' min={0}
            placeholder={0}
            defaultValue={action.actionTypeCount}
            disabled={canWrite}
        />}
        {"\xa0Category:"}
        <select
            className='ClassPage-input-box'
            name={`actions[${index}].category`}
            onChange={handleChange}
            type='dropdown'
            defaultValue={category}
            disabled={canWrite}
        >
            <option value="feat">Feat</option>
            <option value="passive">Passive</option>
            <option value="reaction">Reaction</option>
            <option value="action">Action</option>
        </select>
        <br/>
        {category === 'reaction' && <div className='ClassPage-input'>
            Trigger:
            <input
                className='ClassPage-input-box'
                style={{ width: 400 }}
                name={`actions[${index}].trigger`}
                onChange={handleChange}
                type="text"
                placeholder="A Physical ranged attack targeting you"
                defaultValue={action.trigger}
                disabled={canWrite}
            />
        </div>}
        {(category === 'reaction' || category === 'action') && <div className='ClassPage-input'>
            Requirement:
            <input
                className='ClassPage-input-box'
                style={{ width: 400 }}
                name={`actions[${index}].requirement`}
                onChange={handleChange}
                type="text"
                placeholder="You are not Engaged"
                defaultValue={action.requirement}
                disabled={canWrite}
            />
        </div>}
        {areTagsVisible && action.tags !== undefined && action.tags.map((tag, tagIndex) => {
            return <div className='ClassPage-tag-input-box' key={tagIndex}
                style={tag.tagColor !== undefined ? tag.textColor !== undefined ? { backgroundColor: tag.tagColor, color: tag.textColor } : { backgroundColor: tag.tagColor } : { color: tag.textColor }}>
                Tag Information:
                <input
                    className='ClassPage-input-box'
                    name={`actions[${index}].tags[${tagIndex}].tagInfo`}
                    onChange={handleChange}
                    required
                    type="text"
                    defaultValue={tag.tagInfo}
                    disabled={canWrite}
                />
                {"\xa0Tag Color"}
                <input
                    className='ClassPage-input-box'
                    name={`actions[${index}].tags[${tagIndex}].tagColor`}
                    onChange={handleChange}
                    required
                    type="color"
                    defaultValue={tag.tagColor}
                    disabled={canWrite}
                />
                {"\xa0Text Color"}
                <input
                    className='ClassPage-input-box'
                    name={`actions[${index}].tags[${tagIndex}].textColor`}
                    onChange={handleChange}
                    required
                    type="color"
                    defaultValue={tag.textColor}
                    disabled={canWrite}
                />
                {"\xa0Tag Description"}
                <input
                    className='ClassPage-input-box'
                    style={{ width: 400 }}
                    name={`actions[${index}].tags[${tagIndex}].tagDescription`}
                    onChange={handleChange}
                    required
                    type="text"
                    defaultValue={tag.tagDescription}
                    disabled={canWrite}
                />
                <button className='ClassPage-delete-tag-button' onClick={() => onRemoveTag(index, tagIndex)} disabled={canWrite}>
                    Delete Tag
                </button>
            </div>
        })}
        Description:
        <textarea
            className='ClassPage-input-text-area'
            name={`actions[${index}].description`}
            onChange={handleChange}
            required
            type="textarea"
            defaultValue={action.description}
            disabled={canWrite}
        />
        <div className='ClassPage-hint'>Supports Markdown - **bold**, *italic*, and bullet lists (- item) all render on the character sheet.</div>
        <label className='ClassPage-outcome-table-toggle'>
            <input
                type='checkbox'
                checked={showOutcomeTable}
                onChange={e => setShowOutcomeTable(e.target.checked)}
                disabled={canWrite}
            />
            {"\xa0Has outcome table? (Critical Success / Success / Failure / Critical Failure)"}
        </label>
        {showOutcomeTable && <div className='ClassPage-outcome-rows'>
            {OUTCOME_ROWS.map(row => <div className='ClassPage-outcome-row' key={row.key}>
                {row.label + ":"}
                <input
                    className='ClassPage-input-box'
                    style={{ width: 400 }}
                    name={`actions[${index}].outcomeTable.${row.key}`}
                    onChange={handleChange}
                    type="text"
                    defaultValue={action.outcomeTable?.[row.key]}
                    disabled={canWrite}
                />
            </div>)}
        </div>}
    </div>
}
