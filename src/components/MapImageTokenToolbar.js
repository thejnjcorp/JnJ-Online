import { useState } from 'react';
import { uploadImageToImgur } from '../utils/imgurUploader';
import { DEFAULT_IMAGE_TOKEN_SIZE, IMAGE_TOKEN_SIZES, MAX_IMAGE_TOKENS, MAX_LABEL_LENGTH, isImageUrl } from '../utils/mapImageTokens';
import '../styles/MapDrawing.scss';
import '../styles/MapImageTokens.scss';

function SizePills({ label, value, onChange }) {
    return <div className="MapDrawingToolbar-group" role="group" aria-label={label}>
        {IMAGE_TOKEN_SIZES.map(size => <button key={size.key} type="button" className="MapDrawingToolbar-button" aria-pressed={value === size.value} onClick={() => onChange(size.value)}>{size.label}</button>)}
    </div>;
}

// A director's way to put pictures - fire, trees, pillars, holes, loot - on the
// combat map, and to resize, copy and remove the one selected. `imageTokens` is
// what useMapImageTokens returns, with `add`, `copy` and `remove` already given the
// map's shape (so they take just the fields / the id).
export function MapImageTokenToolbar({ imageTokens }) {
    const { tokens, full, selected, add, resize, copy, remove } = imageTokens;
    const [adding, setAdding] = useState(false);
    const [link, setLink] = useState('');
    const [label, setLabel] = useState('');
    const [size, setSize] = useState(DEFAULT_IMAGE_TOKEN_SIZE);
    const [uploading, setUploading] = useState(false);

    const chosen = tokens.find(token => token.id === selected);
    const usable = isImageUrl(link.trim());

    async function handleFile(event) {
        const [file] = event.target.files;
        event.target.value = '';
        if (!file) return;
        setUploading(true);
        try {
            const uploaded = await uploadImageToImgur(file);
            if (uploaded) setLink(uploaded);
        } catch (error) {
            alert("Couldn't upload the image: " + error.message);
        } finally {
            setUploading(false);
        }
    }

    function handlePlace() {
        if (!usable) return;
        add({ image: link, label, size });
        setLink('');
        setLabel('');
        setAdding(false);
    }

    return <div className="MapImageTokenToolbar" role="toolbar" aria-label="Map image tokens">
        <button type="button" className="MapDrawingToolbar-button" aria-pressed={adding} onClick={() => setAdding(!adding)}>Add image token</button>
        {chosen && <div className="MapDrawingToolbar-group" role="group" aria-label="Selected image token">
            <span className="MapDrawingToolbar-label">{chosen.label || 'Image token'}</span>
            <SizePills label="Selected size" value={chosen.size} onChange={value => resize(chosen.id, value)}/>
            <button type="button" className="MapDrawingToolbar-button" disabled={full} onClick={() => copy(chosen.id)}>Copy</button>
            <button type="button" className="MapDrawingToolbar-button" onClick={() => remove(chosen.id)}>Remove</button>
        </div>}
        {full && <span className="MapDrawingToolbar-note MapDrawingToolbar-note-full" role="alert">The map has {MAX_IMAGE_TOKENS} image tokens - remove some to add more.</span>}
        {adding && <div className="MapImageTokenToolbar-form">
            <label className="MapImageTokenToolbar-field">
                <span className="MapDrawingToolbar-label">Picture link</span>
                <input className="MapImageTokenToolbar-input" type="url" placeholder="https://..." value={link} onChange={event => setLink(event.target.value)}/>
            </label>
            <label className="MapImageTokenToolbar-field">
                <span className="MapDrawingToolbar-label">Or upload one</span>
                <input className="MapImageTokenToolbar-file" type="file" accept="image/*" disabled={uploading} onChange={handleFile}/>
            </label>
            <label className="MapImageTokenToolbar-field">
                <span className="MapDrawingToolbar-label">Name (optional)</span>
                <input className="MapImageTokenToolbar-input" type="text" maxLength={MAX_LABEL_LENGTH} placeholder="Fire" value={label} onChange={event => setLabel(event.target.value)}/>
            </label>
            <SizePills label="Size" value={size} onChange={setSize}/>
            {usable && <img className="MapImageTokenToolbar-preview" src={link.trim()} alt="Preview"/>}
            {uploading && <span className="MapDrawingToolbar-note" role="status">Uploading...</span>}
            {link.trim() !== '' && !usable && <span className="MapDrawingToolbar-note">That isn't a web link to a picture (it should start with https://).</span>}
            <button type="button" className="MapDrawingToolbar-button" disabled={!usable || full || uploading} onClick={handlePlace}>Place on map</button>
        </div>}
    </div>;
}
