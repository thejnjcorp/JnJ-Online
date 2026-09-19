import { useState } from 'react';
import { GUIDE_SECTIONS } from '../utils/encounterGuideContent';
import '../styles/BalanceGuide.scss';

function Block({ block }) {
    if (block.type === 'callout') {
        return <div className={`BalanceGuide-callout BalanceGuide-callout-${block.tone}`}>
            <span className="BalanceGuide-callout-title">{block.title}</span>
            <p>{block.text}</p>
        </div>;
    }
    if (block.type === 'text') {
        return <div className="BalanceGuide-text">
            {block.title && <h4>{block.title}</h4>}
            {block.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        </div>;
    }
    return <div className="BalanceGuide-table-block">
        {block.title && <h4>{block.title}</h4>}
        {block.intro && <p>{block.intro}</p>}
        <div className="BalanceGuide-table-wrap">
            <table>
                <thead><tr>{block.columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
                <tbody>{block.rows.map(row => <tr key={row.join('|')}>{row.map((cell, index) => index === 0 ? <th key={index} scope="row">{cell}</th> : <td key={index}>{cell}</td>)}</tr>)}</tbody>
            </table>
        </div>
    </div>;
}

// The JnJ Level 1 Encounter Balance Guide as a cheat sheet: closed until you want
// it, then one section at a time.
export function BalanceGuide() {
    const [open, setOpen] = useState(false);
    const [sectionKey, setSectionKey] = useState(GUIDE_SECTIONS[0].key);
    const section = GUIDE_SECTIONS.find(candidate => candidate.key === sectionKey);

    return <div className="ClassPage-card BalanceGuide">
        <button type="button" className="BalanceGuide-toggle" aria-expanded={open} aria-controls="balance-guide-body" onClick={() => setOpen(!open)}>
            <span className="ClassPage-section-title">Balance guide</span>
            <span className="BalanceGuide-toggle-hint">Level 1 encounter cheat sheet</span>
            <span className={open ? 'BalanceGuide-chevron BalanceGuide-chevron-open' : 'BalanceGuide-chevron'} aria-hidden="true">›</span>
        </button>
        {open && <div id="balance-guide-body" className="BalanceGuide-body">
            <div className="ClassPage-pill-group" role="group" aria-label="Guide sections">
                {GUIDE_SECTIONS.map(candidate => <button
                    key={candidate.key}
                    type="button"
                    className={candidate.key === sectionKey ? 'ClassPage-pill ClassPage-pill-selected' : 'ClassPage-pill'}
                    aria-pressed={candidate.key === sectionKey}
                    onClick={() => setSectionKey(candidate.key)}
                >{candidate.label}</button>)}
            </div>
            {section.blocks.map((block, index) => <Block key={index} block={block}/>)}
        </div>}
    </div>;
}
