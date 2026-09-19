jest.mock('../../src/utils/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), updateDoc: jest.fn() }));

// eslint-disable-next-line import/first
import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { ActionPreview } from '../../src/components/ActionPreview';

const action = {
    actionName: 'Stab', actionCost: 1, actionLevel: 1, actionType: 'standard', category: 'action',
    toHitBool: true, toHit: 2, range: '1 Zone', description: 'Deal **2d6** damage.',
};

const feat = { ...action, actionName: 'Second Wind', actionCost: 0, category: 'feat', toHitBool: false, difficultyClass: 'Dex,0' };

const views = () => screen.getAllByRole('button').map(b => b.textContent);

describe('ActionPreview', () => {
    test('shows the action as a Combat tab card, with a Use button for something you can spend', () => {
        render(<ActionPreview action={action} />);

        expect(document.querySelector('.CombatActionListCard-name')).toHaveTextContent('Stab');
        expect(screen.getByRole('button', { name: 'Use Action' })).toBeInTheDocument();
        expect(document.querySelector('.CombatActionListCard-description strong')).toHaveTextContent('2d6');
    });

    test('a reaction offers "Use Reaction", as on the sheet', () => {
        render(<ActionPreview action={{ ...action, category: 'reaction' }} />);
        expect(screen.getByRole('button', { name: 'Use Reaction' })).toBeInTheDocument();
    });

    test('a passive is shown without a Use button', () => {
        render(<ActionPreview action={{ ...action, category: 'passive', actionCost: 0 }} />);
        expect(screen.queryByRole('button', { name: /Use/ })).not.toBeInTheDocument();
    });

    test('the numbers use the action\'s own level and the class hit modifier', () => {
        render(<ActionPreview action={{ ...action, actionLevel: 1 }} stats={{ baseHitModifier: 3 }} />);
        expect(screen.getByText(/\+5 to hit/)).toBeInTheDocument(); // 3 + the action's +2

        render(<ActionPreview action={{ ...action, actionLevel: 2 }} stats={{ baseHitModifier: 3 }} />);
        expect(screen.getAllByText(/to hit/).at(-1)).toHaveTextContent('+6 to hit'); // level 2 adds 1
    });

    test('says what it assumes', () => {
        render(<ActionPreview action={{ ...action, actionLevel: 4 }} stats={{ baseHitModifier: 1 }} />);
        expect(screen.getByText(/Shown at level 4 with this class's base hit modifier/)).toBeInTheDocument();
    });

    describe('views', () => {
        test('an action that costs points can also be previewed as unaffordable', () => {
            render(<ActionPreview action={action} />);
            expect(views()).toEqual(expect.arrayContaining(['Combat tab', 'Not enough AP']));

            fireEvent.click(screen.getByRole('button', { name: 'Not enough AP' }));

            expect(document.querySelector('.CombatActionListCard-locked')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Use Action' })).not.toBeInTheDocument();
        });

        test('a free action has nothing to be unaffordable', () => {
            render(<ActionPreview action={{ ...action, actionCost: 0 }} />);
            expect(views()).not.toContain('Not enough AP');
        });

        test('a feat can also be previewed in the Skills sidebar, open, showing its description', () => {
            render(<ActionPreview action={feat} />);
            expect(views()).toContain('Skills sidebar');

            fireEvent.click(screen.getByRole('button', { name: 'Skills sidebar' }));

            expect(document.querySelector('.ActionPreview-sidebar .SkillsAndFlaws-name')).toHaveTextContent('Second Wind');
            expect(document.querySelector('.SkillsAndFlaws-feat-description strong')).toHaveTextContent('2d6');
            expect(screen.queryByRole('button', { name: 'Phone' })).not.toBeInTheDocument(); // the sidebar has one width
        });

        test('only feats get the sidebar view', () => {
            render(<ActionPreview action={action} />);
            expect(views()).not.toContain('Skills sidebar');
        });

        test('if the category changes under it, a view that no longer applies falls back to the Combat tab', () => {
            const { rerender } = render(<ActionPreview action={feat} />);
            fireEvent.click(screen.getByRole('button', { name: 'Skills sidebar' }));

            rerender(<ActionPreview action={{ ...feat, category: 'action', actionCost: 1 }} />);

            expect(document.querySelector('.ActionPreview-sidebar')).not.toBeInTheDocument();
            expect(document.querySelector('.CombatActionListCard')).toBeInTheDocument();
        });
    });

    describe('screen size', () => {
        test('Phone narrows the card and applies the phone layout; Desktop restores it', () => {
            render(<ActionPreview action={action} />);
            const stage = () => document.querySelector('.ActionPreview-stage');
            expect(stage()).not.toHaveClass('ActionPreview-phone');
            expect(screen.getByRole('button', { name: 'Desktop' })).toHaveAttribute('aria-pressed', 'true');

            fireEvent.click(screen.getByRole('button', { name: 'Phone' }));
            expect(stage()).toHaveClass('ActionPreview-phone');
            expect(screen.getByRole('button', { name: 'Phone' })).toHaveAttribute('aria-pressed', 'true');

            fireEvent.click(screen.getByRole('button', { name: 'Desktop' }));
            expect(stage()).not.toHaveClass('ActionPreview-phone');
        });
    });

    describe('an action that is part-way through being edited', () => {
        test('an unnamed action is labelled rather than blank', () => {
            render(<ActionPreview action={{ ...action, actionName: '' }} />);
            expect(document.querySelector('.CombatActionListCard-name')).toHaveTextContent('Unnamed action');
        });

        test('a missing DC and a cleared cost do not break the preview', () => {
            render(<ActionPreview action={{ ...action, toHitBool: false, difficultyClass: undefined, actionCost: '' }} />);
            expect(document.querySelector('.CombatActionListCard')).toBeInTheDocument();
        });

        test('a missing description is fine', () => {
            render(<ActionPreview action={{ ...action, description: undefined }} />);
            expect(document.querySelector('.CombatActionListCard-description').textContent).toBe('');
        });
    });
});
