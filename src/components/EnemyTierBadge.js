import { tierClass } from '../utils/enemies';
import '../styles/EnemyTier.scss';

// An enemy's tier as a coloured badge.
export function EnemyTierBadge({ tier }) {
    return <span className={`EnemyTier ${tierClass(tier)}`}>{tier || 'No tier'}</span>;
}
