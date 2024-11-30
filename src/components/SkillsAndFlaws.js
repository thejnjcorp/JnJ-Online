import '../styles/SkillsAndFlaws.scss';

export function SkillsAndFlaws({skills_and_flaws}) {
    return <>
        {skills_and_flaws.map((skill_or_flaw, index) => 
            <div key={index} className={skill_or_flaw.isSkill ? "SkillsAndFlaws SkillsAndFlaws-skill" : "SkillsAndFlaws SkillsAndFlaws-flaw"}>
                {skill_or_flaw.name}<br/>
                {skill_or_flaw.description}<br/>
            </div>
        )}
    </>
}