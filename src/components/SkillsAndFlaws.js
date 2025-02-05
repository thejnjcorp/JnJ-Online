import { useState } from 'react';
import starIcon from '../icons/star.svg';
import '../styles/SkillsAndFlaws.scss';

export function SkillsAndFlaws({characterPageLayoutLive, setCharacterPageLayoutLive, saveCharacterPageLayout}) {
    const [isVisible, setIsVisible] = useState(characterPageLayoutLive.skills_and_flaws.map(value => value.isVisible))

    function flipBool(index) {
        var newCharacterPageLayoutLive = characterPageLayoutLive;
        newCharacterPageLayoutLive.skills_and_flaws[index].isVisible = !characterPageLayoutLive.skills_and_flaws[index].isVisible;
        setCharacterPageLayoutLive(newCharacterPageLayoutLive);
        setIsVisible(newCharacterPageLayoutLive.skills_and_flaws.map(value => value.isVisible));
    }

    return <>
        {characterPageLayoutLive.skills_and_flaws.map((skill_or_flaw, index) => 
            <button 
                key={index} 
                className={skill_or_flaw.isSkill ? "SkillsAndFlaws SkillsAndFlaws-skill SkillsOverride" : "SkillsAndFlaws SkillsAndFlaws-flaw FlawsOverride"}
                onClick={() => flipBool(index)}
            >
                <div className='SkillsAndFlaws-inner-div'>
                    {skill_or_flaw.name}
                    {Array.from({ length: skill_or_flaw.degree }, (_, index) => (
                        <img key={index} src={starIcon} alt='star' className='SkillsAndFlaws-star' width={30}/>
                    ))}
                </div>
                <div className='SkillsAndFlaws-inner-div'>
                    {isVisible[index] && <>
                        {skill_or_flaw.description}
                    </>}
                </div>
                
            </button>
        )}
    </>
}