import { render, screen } from '@testing-library/react';
import { EnemyTierBadge } from '../../src/components/EnemyTierBadge';

describe('EnemyTierBadge', () => {
    test.each(['Goon', 'Regular', 'Veteran', 'Elite', 'Captain'])('%s is a badge in its own colour class', tier => {
        render(<EnemyTierBadge tier={tier}/>);
        expect(screen.getByText(tier)).toHaveClass('EnemyTier', `EnemyTier-${tier.toLowerCase()}`);
    });

    test('an enemy with no tier says so', () => {
        render(<EnemyTierBadge tier={undefined}/>);
        expect(screen.getByText('No tier')).toHaveClass('EnemyTier-unknown');
    });
});
