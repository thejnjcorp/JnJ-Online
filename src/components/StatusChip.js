import { statusColorClass, statusColorStyle } from '../utils/statusStyle';
import '../styles/CharacterPage.scss';

// A status as a small pill: its dot, name and (when it has one) stack count,
// in its type's colour or its own. A button when `onClick` is given, otherwise
// just a label.
export function StatusChip({ status, onClick, title }) {
    const className = ['CharacterPage-status-chip', `CharacterPage-status-chip-${status.polarity || 'neutral'}`, statusColorClass(status, 'CharacterPage-status-chip')].filter(Boolean).join(' ');
    const content = <>
        <span className="CharacterPage-status-chip-dot"/>
        <span className="CharacterPage-status-chip-name">{status.name}</span>
        {status.stacks > 0 && <span className="CharacterPage-status-chip-badge">{status.stacks}</span>}
    </>;
    if (onClick) return <button type="button" className={className} style={statusColorStyle(status)} title={title} onClick={onClick}>{content}</button>;
    return <span className={className} style={statusColorStyle(status)} title={title}>{content}</span>;
}
