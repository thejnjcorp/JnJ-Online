import { useRef, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { uploadImageToImgur } from '../utils/imgurUploader';
import { ReactComponent as PersonIcon } from '../icons/person.svg';
import { ReactComponent as PencilIcon } from '../icons/pencil.svg';

// Desktop-only panel (see the mobile override in CharacterPage.scss) - the
// narrow mobile vitals card never had the dead space this fills, so it isn't
// worth the extra height there. Uploads reuse uploadImageToImgur, the same
// utility DirectorsPage.js already uses for map images.
//
// `field`/`label` let this same control edit a second picture - `portrait_url`
// (the default, shown on the sheet's masthead and vitals panel) is the
// "fancy/roleplay" image; `combat_portrait_url` (see CharacterMainTab.js's
// Combat tab) is what a map token and the Director's Page show instead, when
// set - a player who never sets one keeps seeing their roleplay portrait
// everywhere, per useCombatEntities/DirectorsPage's own `||` fallback.
export function CharacterPortrait({characterPage, userId, field = 'portrait_url', label = 'portrait'}) {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const hasWritePermissions = userId ? (characterPage.userId === userId || characterPage.canWrite?.includes(userId)) : false;
    const capitalized = label.charAt(0).toUpperCase() + label.slice(1);

    async function handleFileChange(event) {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        setUploading(true);
        try {
            const imageLink = await uploadImageToImgur(file);
            if (imageLink) {
                await updateDoc(doc(db, "characters", characterPage.character_id), {
                    [field]: imageLink
                });
            }
        } catch (e) {
            alert(e);
        }
        setUploading(false);
    }

    return <div className="CharacterPage-portrait">
        {characterPage[field]
            ? <img src={characterPage[field]} alt="" className="CharacterPage-portrait-image"/>
            : <>
                <PersonIcon className="CharacterPage-portrait-placeholder-icon"/>
                <div className="CharacterPage-portrait-placeholder-text">No {label} yet</div>
            </>}
        {hasWritePermissions && <>
            <button type="button"
                className="CharacterPage-portrait-edit-button"
                onClick={() => fileInputRef.current.click()}
                disabled={uploading}
                aria-label={`Change ${label}`}
            >
                <PencilIcon/>
            </button>
            <input
                ref={fileInputRef}
                type="file"
                aria-label={`${capitalized} image file`}
                accept="image/*"
                onChange={handleFileChange}
                style={{display: 'none'}}
            />
        </>}
    </div>
}
