import Collapsible from 'react-collapsible';
import starIcon from '../icons/star.svg';
import '../styles/SkillsAndFlaws.scss';

export function SkillsAndFlaws({characterPage}) {
    return <>
        {characterPage.skills_and_flaws.map((skill_or_flaw, index, isOpen=false) => 
            <Collapsible 
                key={index}
                trigger={<>{skill_or_flaw.name}
                {Array.from({ length: skill_or_flaw.degree }, (_, index) => (
                    <img key={index} src={starIcon} alt='star' className='SkillsAndFlaws-star' width={30}/>
                ))}</>}
                className={skill_or_flaw.isSkill ? "SkillsAndFlaws SkillsAndFlaws-skill SkillsOverride" : "SkillsAndFlaws SkillsAndFlaws-flaw FlawsOverride"}
                openedClassName={skill_or_flaw.isSkill ? "SkillsAndFlaws SkillsAndFlaws-skill SkillsOverride" : "SkillsAndFlaws SkillsAndFlaws-flaw FlawsOverride"}
                contentInnerClassName='SkillsAndFlaws-inner-div'
                triggerClassName='SkillsAndFlaws-trigger'
                triggerOpenedClassName='SkillsAndFlaws-trigger'
                transitionTime={100}
                open={isOpen}
            >
                <p style={{margin: 0}}>
                    {skill_or_flaw.description}
                </p>
            </Collapsible>
        )}
    </>
}