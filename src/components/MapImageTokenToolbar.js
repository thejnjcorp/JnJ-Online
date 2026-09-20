import { useState } from 'react';
import { uploadImageToImgur } from '../utils/imgurUploader';
import { imageRef, imageSrc } from '../utils/imageRefs';
import { DEFAULT_IMAGE_TOKEN_SIZE, IMAGE_TOKEN_SIZES, MAX_IMAGE_TOKENS, MAX_LABEL_LENGTH } from '../utils/mapImageTokens';
import { DRAG_TYPE, MAX_LIBRARY_TOKENS, dragPayload } from '../utils/tokenLibrary';
import { useTokenLibrary } from '../utils/useTokenLibrary';
import '../styles/MapDrawing.scss';
import '../styles/MapImageTokens.scss';

function SizePills({ label, value, onChange }) {
    return <div className="MapDrawingToolbar-group" role="group" aria-label={label}>
        {IMAGE_TOKEN_SIZES.map(size => <button key={size.key} type="button" className="MapDrawingToolbar-button" aria-pressed={value === size.value} onClick={() => onChange(size.value)}>{size.label}</button>)}
    </div>;
}

// A director's way to put pictures - fire, trees, pillars, holes, loot - on the
// combat map, and to resize, copy and remove the one selected. `imageTokens` is
// what useMapImageTokens returns, with `add` and `copy` already given the map's
// shape (so they take just the fields / the id).
//
// The pictures a director has used before are kept in their token library (see
// tokenLibrary.js): press one to put it in the middle of the map, or drag it onto
// the spot it should go (`onDragging(true)` says a drag has started, so the map can
// take the drop). A new picture - a link or an upload - is saved there as it is
// placed, unless told not to.
export function MapImageTokenToolbar({ imageTokens, userId, onDragging = () => {} }) {
    const { tokens, full, selected, add, resize, copy, remove } = imageTokens;
    const [adding, setAdding] = useState(false);
    const [link, setLink] = useState('');
    const [label, setLabel] = useState('');
    const [size, setSize] = useState(DEFAULT_IMAGE_TOKEN_SIZE);
    const [keep, setKeep] = useState(true);
    const [uploading, setUploading] = useState(false);
    const library = useTokenLibrary(userId, adding);

    const chosen = tokens.find(token => token.id === selected);
    const ref = imageRef(link);

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
        if (!ref) return;
        add({ image: ref, label, size });
        if (keep && !library.full && !library.tokens.some(token => token.image === ref)) library.save({ image: ref, label, size });
        setLink('');
        setLabel('');
        setAdding(false);
    }

    const placeFromLibrary = token => add({ image: token.image, label: token.label, size: token.size });

    function startDrag(event, token) {
        event.dataTransfer.setData(DRAG_TYPE, dragPayload(token));
        event.dataTransfer.effectAllowed = 'copy';
        onDragging(true);
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
            <section className="MapImageTokenToolbar-library" aria-label="Token library">
                <span className="MapDrawingToolbar-label">Your token library</span>
                {library.tokens.length === 0
                    ? <p className="MapImageTokenToolbar-empty">{library.loaded ? 'Nothing saved yet - tokens you add below are kept here to use on any map.' : 'Loading...'}</p>
                    : <>
                        <ul className="MapImageTokenToolbar-tokens">
                            {library.tokens.map(token => <li className="MapImageTokenToolbar-item" key={token.id}>
                                {/* a div, not a button: Firefox won't start a drag from a <button> */}
                                <div
                                    role="button"
                                    tabIndex={full ? -1 : 0}
                                    aria-disabled={full}
                                    className={full ? 'MapImageTokenToolbar-token MapImageTokenToolbar-token-disabled' : 'MapImageTokenToolbar-token'}
                                    draggable={!full}
                                    title="Press to place in the middle of the map, or drag it onto the map"
                                    aria-label={`Place ${token.label || 'image token'}`}
                                    onClick={() => !full && placeFromLibrary(token)}
                                    onKeyDown={event => { if (!full && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); placeFromLibrary(token); } }}
                                    onDragStart={event => startDrag(event, token)}
                                    onDragEnd={() => onDragging(false)}
                                >
                                    <img className="MapImageTokenToolbar-token-image" src={imageSrc(token.image)} alt="" draggable={false}/>
                                    {token.label && <span className="MapImageTokenToolbar-token-name">{token.label}</span>}
                                </div>
                                <button type="button" className="MapImageTokenToolbar-forget" aria-label={`Remove ${token.label || 'image token'} from library`} onClick={() => library.remove(token.id)}>×</button>
                            </li>)}
                        </ul>
                        <span className="MapDrawingToolbar-note">Press a token to place it, or drag it onto the map.</span>
                    </>}
                {library.full && <span className="MapDrawingToolbar-note MapDrawingToolbar-note-full" role="alert">Your library holds {MAX_LIBRARY_TOKENS} tokens - remove some to save more.</span>}
            </section>

            <div className="MapImageTokenToolbar-new">
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
                <label className="MapImageTokenToolbar-keep">
                    <input type="checkbox" checked={keep} onChange={event => setKeep(event.target.checked)}/>
                    <span>Save to my library</span>
                </label>
                {ref && <img className="MapImageTokenToolbar-preview" src={imageSrc(ref)} alt="Preview"/>}
                {uploading && <span className="MapDrawingToolbar-note" role="status">Uploading...</span>}
                {link.trim() !== '' && !ref && <span className="MapDrawingToolbar-note">That isn't a web link to a picture (it should start with https://).</span>}
                <button type="button" className="MapDrawingToolbar-button" disabled={!ref || full || uploading} onClick={handlePlace}>Place on map</button>
            </div>
        </div>}
    </div>;
}
