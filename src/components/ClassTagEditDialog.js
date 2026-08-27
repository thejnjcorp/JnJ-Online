import '../styles/ClassTagEditDialog.scss';

// Popover for editing one action's tag - replaces the old always-rendered
// inline color-swatch row. Reads/writes straight through the same
// `onChange({name, value})` path everything else in ClassPage.js already
// uses (e.g. `actions[2].tags[0].tagColor`), so it needs no local draft
// state and no reducer changes.
export function ClassTagEditDialog({ actionIndex, tagIndex, tag, onChange, onClose, onDelete }) {
    const prefix = `actions[${actionIndex}].tags[${tagIndex}]`;

    const handleChange = event => {
        onChange({ name: `${prefix}.${event.target.name}`, value: event.target.value });
    };

    return <>
        <div className="ClassTagEditDialog-scrim" onClick={onClose}/>
        <div className="ClassTagEditDialog">
            <div className="ClassTagEditDialog-title">Edit Tag</div>
            <div>
                <span className="ClassPage-field-label">Label</span>
                <input
                    className="ClassPage-field-input"
                    name="tagInfo"
                    type="text"
                    onChange={handleChange}
                    defaultValue={tag.tagInfo}
                    placeholder="e.g. Fire"
                />
            </div>
            <div className="ClassTagEditDialog-color-row">
                <div>
                    <span className="ClassPage-field-label">Tag Color</span>
                    <input className="ClassTagEditDialog-color-input" name="tagColor" type="color" onChange={handleChange} defaultValue={tag.tagColor || '#61dafb'}/>
                </div>
                <div>
                    <span className="ClassPage-field-label">Text Color</span>
                    <input className="ClassTagEditDialog-color-input" name="textColor" type="color" onChange={handleChange} defaultValue={tag.textColor || '#1b1b1f'}/>
                </div>
            </div>
            <div>
                <span className="ClassPage-field-label">Live Preview</span>
                <span className="ClassTagEditDialog-preview" style={{ backgroundColor: tag.tagColor, color: tag.textColor }}>{tag.tagInfo || 'Tag'}</span>
            </div>
            <div>
                <span className="ClassPage-field-label">Description</span>
                <textarea
                    className="ClassPage-field-input ClassTagEditDialog-description"
                    name="tagDescription"
                    onChange={handleChange}
                    defaultValue={tag.tagDescription}
                />
            </div>
            <div className="ClassTagEditDialog-actions">
                <button type="button" className="ClassTagEditDialog-delete-button" onClick={onDelete}>Delete Tag</button>
                <button type="button" className="ClassTagEditDialog-done-button" onClick={onClose}>Done</button>
            </div>
        </div>
    </>;
}
