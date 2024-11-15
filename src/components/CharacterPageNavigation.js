import { CharacterPageNavigationColorPickerButton } from './CharacterPageNavigationColorPickerButton';
import '../styles/CharacterPage.scss';


export function CharacterPageNavigation({characterPageLayoutLive, setCharacterPageLayoutLive, refreshPageRender}) {


    return <div className="CharacterPage-navigation" style={{background: characterPageLayoutLive.navigation_color}}>
        <CharacterPageNavigationColorPickerButton 
            characterPageLayoutLive={characterPageLayoutLive} 
            setCharacterPageLayoutLive={setCharacterPageLayoutLive} 
            refreshPageRender={refreshPageRender}
        />
    </div>
}