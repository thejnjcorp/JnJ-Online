import { useState } from 'react';
import '../styles/CharacterPageStyles/DefaultCharacterPage.scss';
import '../styles/DirectorsPage.scss';
import '../styles/CharacterMainTab.scss';
import { useLocation } from 'react-router-dom';
import { db } from '../utils/firebase';
import { doc, query, collection, where, onSnapshot } from 'firebase/firestore';
import { SkillsAndFlaws } from './SkillsAndFlaws';
import Collapsible from 'react-collapsible';
import characterPageLayout from '../CharacterPageLayout.json';
import npcLayout from '../NPCLayout.json';
import { TabContainer } from './TabContainer';
import { CharacterPageAbilityScorePanel } from './CharacterPageAbilityScorePanel';
import { CharacterPageStatsPanel } from './CharacterPageStatsPanel';
import { CombatActionList } from './CombatActionList';
import starIcon from '../icons/star.svg';
import starFilledIcon from '../icons/star_filled.svg';
import { CombatTracker } from './CombatTracker';

export function DirectorsPage() {
    const location = useLocation();
    const pageTheme = 'DefaultCharacterPage';
    const [isLoaded, setIsLoaded] = useState(false);
    const [campaignInfo, setCampaignInfo] = useState({
        "campaign_name":"placeholder", 
        "director_name":"placeholder", 
        "enemy_list":[], 
        "ally_combat_npc_list":[], 
        "neutral_combat_npc_list":[],
        "conbat_tracker": {
            "zones":[]
        }
    });
    const [characterList, setCharacterList] = useState([]);
    const campaignDoc = doc(db, "campaigns", location.pathname.split("/").at(2));
    // eslint-disable-next-line
    const campaignDocSnap = onSnapshot(campaignDoc, { includeMetadataChanges: true }, (docSnap) => {
        if (docSnap.metadata.hasPendingWrites || !isLoaded) {
            setCampaignInfo(prevData => ({
                ...prevData,
                ...docSnap.data()
            }));
            setIsLoaded(true);
        }
    });
    const charactersQuery = query(collection(db, "characters"), where("campaigns", "array-contains", location.pathname.split("/").at(2)));
    // eslint-disable-next-line
    const characterQuerySnap = onSnapshot(charactersQuery, { includeMetadataChanges: true }, (querySnapshot) => {
        if (querySnapshot.metadata.hasPendingWrites || !isLoaded) {
            setCharacterList(querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
        }
    });

    return <div className="DirectorsPage">
        <div className={'DirectorsPage-SkillsTab ' + pageTheme}>
            {characterList.map((character, index) => {
                const actualCharacter = { ...characterPageLayout, ...character } 
                return <Collapsible
                    key={index}
                    trigger={<>{character.character_name}</>}
                    className="DirectorsPage-player-skill-dropdown"
                    openedClassName="DirectorsPage-player-skill-dropdown-open"
                    contentInnerClassName='DirectorsPage-player-skill-inner-div'
                    triggerClassName='DirectorsPage-player-skill-trigger'
                    triggerOpenedClassName='DirectorsPage-player-skill-trigger'
                    transitionTime={100}
                    open={true}
                >
                    <SkillsAndFlaws isOpen={true} characterPage={actualCharacter}/>
                </Collapsible>
            })}
        </div>
        <div className='DirectorsPage-MainBody'>
            <TabContainer tabs={[
                {tabName: "Roleplay", content: <>
                    hi
                </>}, 
                {tabName: "Combat", content: <div className='DirectorsPage-Combat'>
                    <div className='DirectorsPage-CombatCharacterStats'>
                        Player Stats<br/>
                        {characterList.map((character, index) => {
                            const actualCharacter = { ...characterPageLayout, ...character } 
                            const setActionPoints = function(actionPoints) {
                                setCharacterList(prevState => 
                                    prevState.map((originalCharacter, i) =>
                                        i === index ? { ...originalCharacter, action_points: actionPoints } : originalCharacter
                                    )
                                );
                            }
                            return <Collapsible
                                key={index}
                                trigger={<>{character.character_name}</>}
                                className="DirectorsPage-player-stats-dropdown"
                                openedClassName="DirectorsPage-player-stats-dropdown-open"
                                contentInnerClassName='DirectorsPage-player-stats-inner-div'
                                triggerClassName='DirectorsPage-player-stats-trigger'
                                triggerOpenedClassName='DirectorsPage-player-stats-trigger'
                                transitionTime={100}
                                open={true}
                            >
                                <div className='DirectorsPageCharacterStatsOverride'>
                                    <CharacterPageAbilityScorePanel characterPageLayoutLive={actualCharacter}/>
                                    <CharacterPageStatsPanel characterPageLayoutLive={actualCharacter}/>
                                </div>
                                <Collapsible
                                    trigger={<div className="CharacterMainTab-action-points">
                                        Action Points:{"\xa0\xa0\xa0"}
                                        {actualCharacter.action_points > 0 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={(e) => {
                                            e.stopPropagation();
                                            setActionPoints(1);
                                        }}/> :
                                        <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={(e) => {
                                            e.stopPropagation();
                                            setActionPoints(1);
                                        }}/>}
                                        {actualCharacter.action_points > 1 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={(e) => {
                                            e.stopPropagation();
                                            setActionPoints(2);
                                        }}/> :
                                        <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={(e) => {
                                            e.stopPropagation();
                                            setActionPoints(2);
                                        }}/>}
                                        {actualCharacter.action_points > 2 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={(e) => {
                                            e.stopPropagation();
                                            setActionPoints(3);
                                        }}/> :
                                        <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={(e) => {
                                            e.stopPropagation();
                                            setActionPoints(3);
                                        }}/>}
                                        {actualCharacter.action_points > 3 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={(e) => {
                                            e.stopPropagation();
                                            setActionPoints(4);
                                        }}/> :
                                        <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={(e) => {
                                            e.stopPropagation();
                                            setActionPoints(4);
                                        }}/>}
                                    </div>}
                                    className="DirectorsPage-player-stats-dropdown"
                                    openedClassName="DirectorsPage-player-stats-dropdown-open"
                                    contentInnerClassName='DirectorsPage-player-stats-inner-div'
                                    triggerClassName='DirectorsPage-player-stats-trigger'
                                    triggerOpenedClassName='DirectorsPage-player-stats-trigger'
                                    transitionTime={100}
                                >
                                    <CombatActionList 
                                        actions={actualCharacter.actions}
                                        experience_points={actualCharacter.experience_points}
                                        baseArmorClass={actualCharacter.base_armor_class}
                                        baseHitModifier={actualCharacter.base_hit_modifier}
                                        baseDamageModifier={actualCharacter.base_damage_modifier}
                                        baseDamageDice={actualCharacter.base_damage_dice}
                                        baseDamageDiceType={actualCharacter.base_damage_dice_type}
                                        baseHealingDiceType={actualCharacter.base_healing_dice_type}
                                    />
                                </Collapsible>
                            </Collapsible>
                        })}
                    </div>
                    <div className='DirectorsPage-CombatTracker'>
                        Combat Tracker<br/>
                        {/*<CombatTracker 
                            entityList={campaignInfo.ally_combat_npc_list.concat(campaignInfo.enemy_list, campaignInfo.neutral_combat_npc_list)}
                            zoneList={campaignInfo.conbat_tracker.zones}
                        />*/}
                        <CombatTracker/>
                    </div>
                    <div className='DirectorsPage-CombatEnemyStats'>
                        Enemy Stats<br/>
                        {campaignInfo.enemy_list.map((enemy, index) => {
                            const actualEnemy = { ...npcLayout, ...enemy }
                            const setActionPoints = function(actionPoints) {
                                setCampaignInfo(prevState => ({
                                    ...prevState,
                                    enemy_list: prevState.enemy_list.map(originalEnemy =>
                                        originalEnemy.id === actualEnemy.id ? { ...originalEnemy, action_points: actionPoints } : originalEnemy
                                    )
                                }));
                            }

                            return <Collapsible
                                key={index}
                                trigger={<>{actualEnemy.enemy_name + " Lvl " + actualEnemy.level}</>}
                                className="DirectorsPage-enemy-stats-dropdown"
                                openedClassName="DirectorsPage-enemy-stats-dropdown-open"
                                contentInnerClassName='DirectorsPage-enemy-stats-inner-div'
                                triggerClassName='DirectorsPage-enemy-stats-trigger'
                                triggerOpenedClassName='DirectorsPage-enemy-stats-trigger'
                                transitionTime={100}
                                open={true}
                            >
                                <div className='DirectorsPageCharacterStatsOverride'>
                                    <CharacterPageAbilityScorePanel characterPageLayoutLive={actualEnemy}/>
                                    <CharacterPageStatsPanel characterPageLayoutLive={actualEnemy}/>
                                </div>
                                <Collapsible
                                    trigger={<div className="CharacterMainTab-action-points">
                                        Action Points:{"\xa0\xa0\xa0"}
                                        {actualEnemy.action_points > 0 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={(e) => {
                                            e.stopPropagation();
                                            setActionPoints(1);
                                        }}/> :
                                        <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={(e) => {
                                            e.stopPropagation();
                                            setActionPoints(1);
                                        }}/>}
                                        {actualEnemy.action_points > 1 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={(e) => {
                                            e.stopPropagation();
                                            setActionPoints(2);
                                        }}/> :
                                        <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={(e) => {
                                            e.stopPropagation();
                                            setActionPoints(2);
                                        }}/>}
                                        {actualEnemy.action_points > 2 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={(e) => {
                                            e.stopPropagation();
                                            setActionPoints(3);
                                        }}/> :
                                        <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={(e) => {
                                            e.stopPropagation();
                                            setActionPoints(3);
                                        }}/>}
                                        {actualEnemy.action_points > 3 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={(e) => {
                                            e.stopPropagation();
                                            setActionPoints(4);
                                        }}/> :
                                        <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={(e) => {
                                            e.stopPropagation();
                                            setActionPoints(4);
                                        }}/>}
                                    </div>}
                                    className="DirectorsPage-enemy-stats-dropdown"
                                    openedClassName="DirectorsPage-enemy-stats-dropdown-open"
                                    contentInnerClassName='DirectorsPage-enemy-stats-inner-div'
                                    triggerClassName='DirectorsPage-enemy-stats-trigger'
                                    triggerOpenedClassName='DirectorsPage-enemy-stats-trigger'
                                    transitionTime={100}
                                    open={true}
                                >
                                    <CombatActionList 
                                        actions={actualEnemy.actions}
                                        experience_points={0}
                                        baseArmorClass={actualEnemy.base_armor_class}
                                        baseHitModifier={actualEnemy.base_hit_modifier}
                                        baseDamageModifier={actualEnemy.base_damage_modifier}
                                        baseDamageDice={actualEnemy.base_damage_dice}
                                        baseDamageDiceType={actualEnemy.base_damage_dice_type}
                                        baseHealingDiceType={actualEnemy.base_healing_dice_type}
                                        canUseActions={true}
                                        lowerUseActionButton={true}
                                        characterPage={actualEnemy}
                                        setCharacterPage={function(enemy) {
                                            setCampaignInfo(prevState => ({
                                                ...prevState,
                                                enemy_list: prevState.enemy_list.map(originalEnemy =>
                                                    originalEnemy.id === enemy.id ? { ...originalEnemy, ...enemy } : originalEnemy
                                                )
                                            }));
                                        }}
                                    />
                                </Collapsible>
                            </Collapsible>
                        })}
                    </div>
                </div>},
                {
                    tabName: "Maps",
                    content: <>map</>
                }
            ]}/>
        </div>
    </div>
}