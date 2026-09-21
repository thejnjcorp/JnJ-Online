import { useState } from 'react';
import { uploadImageToImgur } from '../utils/imgurUploader';
import { imageRef, imageSrc } from '../utils/imageRefs';
import { tokenInitials } from '../utils/mapTokens';
import { FieldError, invalidClass, invalidProps } from './FormErrors';
import '../styles/ClassPage.scss';
import '../styles/EnemyPage.scss';

// A picture for something being edited - an enemy's token, an item - with a preview,
// a link to paste in or a file to upload (through Imgur, like the other pictures in
// the app), and a button to take it off. An Imgur link is kept as just its hash (see
// imageRefs.js); `value` and `onChange` are whatever is typed or uploaded, and the
// page normalizes it when it saves. With none, the preview shows the initials of
// `name`. `square` is for things that are not round tokens; `error` is the field's
// validation message and `fieldId` the id the page's problem summary jumps to.
export function PictureField({ name, value, readOnly, error, onChange, square = false, fieldId = 'field-portrait_url' }) {
    const [uploading, setUploading] = useState(false);
    const ref = imageRef(value);
    const [broken, setBroken] = useState(false);

    async function handleFile(event) {
        const [file] = event.target.files;
        event.target.value = '';
        if (!file) return;
        setUploading(true);
        try {
            const uploaded = await uploadImageToImgur(file);
            if (uploaded) {
                setBroken(false);
                onChange(uploaded);
            }
        } catch (uploadError) {
            alert("Couldn't upload the picture: " + uploadError.message);
        } finally {
            setUploading(false);
        }
    }

    return <div className="EnemyPage-picture">
        <div className={square ? 'EnemyPage-picture-token EnemyPage-picture-token-square' : 'EnemyPage-picture-token'} aria-hidden="true">
            {ref && !broken
                ? <img className="EnemyPage-picture-image" src={imageSrc(ref)} alt="" onError={() => setBroken(true)}/>
                : <span className="EnemyPage-picture-initials">{tokenInitials(name)}</span>}
        </div>
        <div className="EnemyPage-picture-fields">
            <label className="EnemyPage-picture-field">
                <span className="ClassPage-field-label">Picture link</span>
                <input
                    className={invalidClass('ClassPage-field-input', error)}
                    {...invalidProps(fieldId, error)}
                    type="url"
                    placeholder="https://..."
                    value={value ? imageSrc(value) : ''}
                    disabled={readOnly}
                    onChange={event => { setBroken(false); onChange(event.target.value); }}
                />
            </label>
            {!readOnly && <div className="EnemyPage-picture-actions">
                <label className="EnemyPage-picture-upload">
                    <span className="ClassPage-field-label">Or upload one</span>
                    <input type="file" accept="image/*" disabled={uploading} onChange={handleFile}/>
                </label>
                {value && <button type="button" className="EnemyPage-modifier-remove" onClick={() => { setBroken(false); onChange(''); }}>Remove picture</button>}
            </div>}
            {uploading && <div className="ClassPage-hint" role="status">Uploading...</div>}
            {broken && <div className="ClassPage-hint" role="alert">That picture didn't load - check the link.</div>}
            <FieldError message={error}/>
        </div>
    </div>;
}
