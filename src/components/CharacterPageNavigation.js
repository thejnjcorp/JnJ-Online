import '../styles/CharacterPage.scss';
import { CharacterPageNavigationColorPickerButton } from './CharacterPageNavigationColorPickerButton';
import { ReactComponent as PersonIcon } from '../icons/person.svg';
import { ReactComponent as PencilIcon } from '../icons/pencil.svg';

export function CharacterPageNavigation({characterPage}) {
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

    return <div className="CharacterPage-masthead" style={{background: `linear-gradient(135deg, ${characterPage.navigation_color} 0%, #1a1622 72%)`}}>
        <div className="CharacterPage-masthead-glow"/>
        <div className="CharacterPage-masthead-content">
            <div className="CharacterPage-masthead-avatar-wrap">
                <div className="CharacterPage-masthead-avatar">
                    <PersonIcon/>
                </div>
                <div className="CharacterPage-masthead-avatar-badge" style={{borderColor: characterPage.navigation_color}}>
                    <PencilIcon/>
                </div>
            </div>
            <div className="CharacterPage-masthead-text">
                <div className="CharacterPage-masthead-name">{characterPage.character_name || "Unnamed Character"}</div>
                {subline && <div className="CharacterPage-masthead-subline">{subline}</div>}
            </div>
            <CharacterPageNavigationColorPickerButton characterPageLayoutLive={characterPage}/>
        </div>
    </div>
}
