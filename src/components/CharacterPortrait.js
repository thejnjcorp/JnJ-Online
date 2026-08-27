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
export function CharacterPortrait({characterPage, userId}) {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const hasWritePermissions = userId ? (characterPage.userId === userId || characterPage.canWrite?.includes(userId)) : false;

    async function handleFileChange(event) {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        setUploading(true);
        try {
            const imageLink = await uploadImageToImgur(file);
            if (imageLink) {
                await updateDoc(doc(db, "characters", characterPage.character_id), {
                    portrait_url: imageLink
                });
            }
        } catch (e) {
            alert(e);
        }
        setUploading(false);
    }

    return <div className="CharacterPage-portrait">
        {characterPage.portrait_url
            ? <img src={characterPage.portrait_url} alt="" className="CharacterPage-portrait-image"/>
            : <>
                <PersonIcon className="CharacterPage-portrait-placeholder-icon"/>
                <div className="CharacterPage-portrait-placeholder-text">No portrait yet</div>
            </>}
        {hasWritePermissions && <>
            <button type="button"
                className="CharacterPage-portrait-edit-button"
                onClick={() => fileInputRef.current.click()}
                disabled={uploading}
                aria-label="Change portrait"
            >
                <PencilIcon/>
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{display: 'none'}}
            />
        </>}
    </div>
}
