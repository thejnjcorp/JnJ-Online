import { useRef, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { uploadImageToImgur } from '../utils/imgurUploader';
import '../styles/CharacterPage.scss';
import { CharacterPageNavigationColorPickerButton } from './CharacterPageNavigationColorPickerButton';
import { ReactComponent as PersonIcon } from '../icons/person.svg';
import { ReactComponent as PencilIcon } from '../icons/pencil.svg';

export function CharacterPageNavigation({characterPage, userId}) {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const hasWritePermissions = userId ? (characterPage.userId === userId || characterPage.canWrite?.includes(userId)) : false;

    // Real character docs are inconsistent about which field actually holds
    // the class name - some only set class_name (e.g. "Crusader Tank v3"),
    // others only set class. Whichever is populated wins; if neither is,
    // CharacterPageLayout.json's default template still has "class": "class"
    // as a placeholder, so that literal value is filtered out too rather
    // than displayed as if it were real.
    const className = characterPage.class_name || characterPage.class;
    const subline = [className && className !== "class" ? className : null, characterPage.player_name ? `Player: ${characterPage.player_name}` : null]
        .filter(Boolean)
        .join(" \xa0\xa0·\xa0\xa0 ");

    // Same portrait_url field CharacterPortrait.js's full panel writes to -
    // this is meant to be a small thumbnail of the same image, not a second
    // independent one (see the character-page-v2 design handoff), so both
    // upload entry points write the same field.
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

    return <div className="CharacterPage-masthead" style={{background: `linear-gradient(135deg, ${characterPage.navigation_color} 0%, #1a1622 72%)`}}>
        <div className="CharacterPage-masthead-glow"/>
        <div className="CharacterPage-masthead-content">
            <div className="CharacterPage-masthead-avatar-wrap">
                <div className="CharacterPage-masthead-avatar">
                    {characterPage.portrait_url
                        ? <img src={characterPage.portrait_url} alt="" className="CharacterPage-masthead-avatar-image"/>
                        : <PersonIcon/>}
                </div>
                {hasWritePermissions && <>
                    <button type="button"
                        className="CharacterPage-masthead-avatar-badge"
                        style={{borderColor: characterPage.navigation_color}}
                        onClick={() => fileInputRef.current.click()}
                        disabled={uploading}
                        aria-label="Change portrait"
                    >
                        <PencilIcon/>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        aria-label="Portrait image file"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{display: 'none'}}
                    />
                </>}
            </div>
            <div className="CharacterPage-masthead-text">
                <div className="CharacterPage-masthead-name">{characterPage.character_name || "Unnamed Character"}</div>
                {subline && <div className="CharacterPage-masthead-subline">{subline}</div>}
            </div>
            <CharacterPageNavigationColorPickerButton characterPageLayoutLive={characterPage}/>
        </div>
    </div>
}
