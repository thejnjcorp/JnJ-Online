jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CombatActionList } from '../../src/components/CombatActionList';

// experience_points=0 -> level 1, at which HitModifier and
// ClassDifficultyClass pass through from the base stats unmodified (see
// CharacterStatCalculator's level-1 case) - keeps the expected to-hit/DC
// numbers below simple to reason about.
const STAT_PROPS = {
    experience_points: 0,
    baseArmorClass: 10,
    baseHitModifier: 2,
    baseDamageModifier: 0,
    baseDamageDice: 1,
    baseDamageDiceType: 1,
    baseHealingDiceType: 1,
};

const characterPage = { character_id: 'char-1', userId: 'owner-1', action_points: 3 };

const toHitAction = { actionName: 'Stab', toHitBool: true, toHit: 3, actionCost: 1 };
const dcAction = { actionName: 'Persuade', toHitBool: false, difficultyClass: 'stat,2', actionCost: 1 };

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockUpdateDoc.mockResolvedValue(undefined);
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

describe('CombatActionList', () => {
    describe('meta text', () => {
        test('a to-hit action shows "+<mod> to hit"', () => {
            render(<CombatActionList actions={[toHitAction]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" />);
            expect(screen.getByText(/\+5 to hit/)).toBeInTheDocument();
        });

        test('a DC-check action shows "DC<n> check"', () => {
            render(<CombatActionList actions={[dcAction]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" />);
            expect(screen.getByText(/DC16 check/)).toBeInTheDocument();
        });

        test('includes the action\'s range when present', () => {
            render(<CombatActionList actions={[{ ...toHitAction, range: '1 Zone' }]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" />);
            expect(screen.getByText(/1 Zone/)).toBeInTheDocument();
        });

        test('when locked, appends the action point cost', () => {
            render(<CombatActionList actions={[toHitAction]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" locked />);
            expect(screen.getByText(/1 AP/)).toBeInTheDocument();
        });

        test('when not locked, the action point cost is not shown in the meta line', () => {
            render(<CombatActionList actions={[toHitAction]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" locked={false} />);
            expect(screen.queryByText(/AP/)).not.toBeInTheDocument();
        });
    });

    describe('action point pips', () => {
        test('shows one pip per action point cost when unlocked', () => {
            render(<CombatActionList actions={[{ ...toHitAction, actionCost: 3 }]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" />);
            expect(screen.getAllByAltText('circle')).toHaveLength(3);
        });

        test('shows no pips when locked (replaced by the lock icon)', () => {
            render(<CombatActionList actions={[{ ...toHitAction, actionCost: 3 }]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" locked />);
            expect(screen.queryAllByAltText('circle')).toHaveLength(0);
        });
    });

    describe('tags', () => {
        test('a feat action gets a synthetic "Feat" chip ahead of its own tags', () => {
            const feat = { ...toHitAction, category: 'feat', tags: [{ tagInfo: 'Utility' }] };
            render(<CombatActionList actions={[feat]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" />);
            expect(screen.getByText('Feat')).toBeInTheDocument();
            expect(screen.getByText('Utility')).toBeInTheDocument();
        });

        test('a non-feat action shows only its own tags, no synthetic chip', () => {
            const action = { ...toHitAction, category: 'action', tags: [{ tagInfo: 'Fire' }] };
            render(<CombatActionList actions={[action]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" />);
            expect(screen.queryByText('Feat')).not.toBeInTheDocument();
            expect(screen.getByText('Fire')).toBeInTheDocument();
        });

        test('a tag with a description shows it; one without shows nothing extra', () => {
            const action = { ...toHitAction, tags: [{ tagInfo: 'Fire', tagDescription: 'Deals fire damage' }, { tagInfo: 'Plain' }] };
            render(<CombatActionList actions={[action]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" />);
            expect(screen.getByText('Deals fire damage')).toBeInTheDocument();
        });
    });

    describe('trigger/requirement lines', () => {
        test('shows Trigger and Requirement when present, when unlocked', () => {
            const action = { ...toHitAction, trigger: 'On hit', requirement: 'Wielding a blade' };
            render(<CombatActionList actions={[action]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" />);
            expect(screen.getByText('On hit')).toBeInTheDocument();
            expect(screen.getByText('Wielding a blade')).toBeInTheDocument();
        });

        test('hides Trigger/Requirement entirely when locked', () => {
            const action = { ...toHitAction, trigger: 'On hit' };
            render(<CombatActionList actions={[action]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" locked />);
            expect(screen.queryByText('On hit')).not.toBeInTheDocument();
        });
    });

    describe('outcome table', () => {
        test('renders only the outcome rows that have a value', () => {
            const action = { ...toHitAction, outcomeTable: { success: 'Hit for 2d6', criticalSuccess: '', failure: null } };
            render(<CombatActionList actions={[action]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" />);
            expect(screen.getByText('Success')).toBeInTheDocument();
            expect(screen.getByText('Hit for 2d6')).toBeInTheDocument();
            expect(screen.queryByText('Critical Success')).not.toBeInTheDocument();
            expect(screen.queryByText('Failure')).not.toBeInTheDocument();
        });

        test('no table at all when every outcome is empty', () => {
            const action = { ...toHitAction, outcomeTable: { success: '', failure: '' } };
            render(<CombatActionList actions={[action]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" />);
            expect(screen.queryByRole('table')).not.toBeInTheDocument();
        });
    });

    describe('Use Action / Use Reaction button', () => {
        test('hidden when canUseActions is false', () => {
            render(<CombatActionList actions={[toHitAction]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" canUseActions={false} />);
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        test('hidden without write permissions even if canUseActions is true', () => {
            render(<CombatActionList actions={[toHitAction]} {...STAT_PROPS} characterPage={characterPage} userId="stranger-1" canUseActions />);
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        test('hidden when locked, even with permissions and canUseActions', () => {
            render(<CombatActionList actions={[toHitAction]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" canUseActions locked />);
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        test('reads "Use Action" for a normal action, "Use Reaction" for a reaction', () => {
            render(<CombatActionList actions={[{ ...toHitAction, category: 'action' }, { ...toHitAction, actionName: 'Parry', category: 'reaction' }]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" canUseActions />);
            expect(screen.getByRole('button', { name: 'Use Action' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Use Reaction' })).toBeInTheDocument();
        });

        test('clicking it, with no onUseAction override, deducts the action cost from the character doc', async () => {
            render(<CombatActionList actions={[{ ...toHitAction, actionCost: 2 }]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" canUseActions />);

            fireEvent.click(screen.getByRole('button', { name: 'Use Action' }));

            expect(mockDoc).toHaveBeenCalledWith({}, 'characters', 'char-1');
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { action_points: 1 }); // 3 - 2
        });

        test('clicking it with an onUseAction override calls that instead of writing to Firestore', () => {
            const onUseAction = jest.fn();
            render(<CombatActionList actions={[toHitAction]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" canUseActions onUseAction={onUseAction} />);

            fireEvent.click(screen.getByRole('button', { name: 'Use Action' }));

            expect(onUseAction).toHaveBeenCalledWith(toHitAction);
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('an error while using the action is alerted', () => {
            mockDoc.mockImplementation(() => { throw new Error('boom'); });
            render(<CombatActionList actions={[toHitAction]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" canUseActions />);

            fireEvent.click(screen.getByRole('button', { name: 'Use Action' }));

            expect(window.alert).toHaveBeenCalled();
        });

        describe('hasWritePermissions override', () => {
            test('explicit hasWritePermissions=true grants the button even for a non-owner', () => {
                render(<CombatActionList actions={[toHitAction]} {...STAT_PROPS} characterPage={characterPage} userId="stranger-1" canUseActions hasWritePermissions={true} />);
                expect(screen.getByRole('button', { name: 'Use Action' })).toBeInTheDocument();
            });

            test('explicit hasWritePermissions=false hides it even for the owner', () => {
                render(<CombatActionList actions={[toHitAction]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" canUseActions hasWritePermissions={false} />);
                expect(screen.queryByRole('button')).not.toBeInTheDocument();
            });
        });
    });
});
