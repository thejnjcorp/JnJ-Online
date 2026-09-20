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

        test('a DC-check action shows "DC <n> <stat> check"', () => {
            render(<CombatActionList actions={[{ ...dcAction, difficultyClass: 'Dex,2' }]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" />);
            expect(screen.getByText(/DC 16 Dex check/)).toBeInTheDocument();
        });

        test('a DC with no stat named is just "DC <n> check"', () => {
            render(<CombatActionList actions={[{ ...dcAction, difficultyClass: ',2' }]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" />);
            expect(screen.getByText(/DC 16 check/)).toBeInTheDocument();
        });

        test('a DC with no modifier is the class DC', () => {
            render(<CombatActionList actions={[{ ...dcAction, difficultyClass: 'Cha' }]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" />);
            expect(screen.getByText(/DC 14 Cha check/)).toBeInTheDocument();
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
        test('shows the action cost in the subtitle when unlocked', () => {
            render(<CombatActionList actions={[{ ...toHitAction, actionCost: 3 }]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" />);
            expect(screen.getByText(/3 Actions/)).toBeInTheDocument();
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

        test('a tag with no label yet shows nothing, rather than an empty pill', () => {
            const action = { ...toHitAction, tags: [{ tagInfo: '' }, { tagInfo: '   ' }, { tagInfo: 'Fire' }] };
            const { container } = render(<CombatActionList actions={[action]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" />);
            expect(container.querySelectorAll('.CombatActionList-tag')).toHaveLength(1);
        });

        test('a feat with only blank tags still gets its Feat chip', () => {
            const feat = { ...toHitAction, category: 'feat', tags: [{ tagInfo: '' }] };
            const { container } = render(<CombatActionList actions={[feat]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" />);
            expect(container.querySelectorAll('.CombatActionList-tag')).toHaveLength(1);
            expect(screen.getByText('Feat')).toBeInTheDocument();
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
    describe('limited-use actions', () => {
        const fleetfoot = { ...toHitAction, actionName: 'Fleetfoot', category: 'action', actionType: 'perDay', actionTypeCount: 2 };
        const setup = (props = {}, action = fleetfoot) => {
            const onActionUsesChange = jest.fn();
            render(<CombatActionList actions={[action]} {...STAT_PROPS} characterPage={{ ...characterPage, action_uses: {} }} userId="owner-1" canUseActions actionUses={{}} onActionUsesChange={onActionUsesChange} {...props} />);
            return onActionUsesChange;
        };

        test('shows how many uses are left, next to the Use button', () => {
            setup({ actionUses: { Fleetfoot: 1 } });
            expect(screen.getByText('1 / 2')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Use Action' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Use Action' }).closest('.CombatActionListCard-footer')).toContainElement(screen.getByRole('group', { name: 'Uses of Fleetfoot' }));
        });

        test('using it spends a use along with the action points, in one write', () => {
            setup({ actionUses: { Fleetfoot: 1 } });
            fireEvent.click(screen.getByRole('button', { name: 'Use Action' }));
            expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { action_points: 2, action_uses: { Fleetfoot: 2 } });
        });

        test('with none left the Use button is off, says so, and does nothing', () => {
            setup({ actionUses: { Fleetfoot: 2 } });
            const button = screen.getByRole('button', { name: 'No uses left' });
            expect(button).toBeDisabled();
            fireEvent.click(button);
            expect(mockUpdateDoc).not.toHaveBeenCalled();
            expect(button.closest('.CombatActionListCard')).toHaveClass('CombatActionListCard-spent');
        });

        test('a use given back by hand turns the Use button back on', () => {
            const { rerender } = render(<CombatActionList actions={[fleetfoot]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" canUseActions actionUses={{ Fleetfoot: 2 }} onActionUsesChange={jest.fn()} />);
            expect(screen.getByRole('button', { name: 'No uses left' })).toBeDisabled();
            rerender(<CombatActionList actions={[fleetfoot]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" canUseActions actionUses={{ Fleetfoot: 1 }} onActionUsesChange={jest.fn()} />);
            expect(screen.getByRole('button', { name: 'Use Action' })).toBeEnabled();
        });

        test('the uses can be corrected by hand, without using the action', () => {
            const onActionUsesChange = setup({ actionUses: { Fleetfoot: 1 } });
            fireEvent.click(screen.getByRole('button', { name: 'Spend a use of Fleetfoot' }));
            expect(onActionUsesChange).toHaveBeenCalledWith({ Fleetfoot: 2 });
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('someone who cannot edit the sheet sees the uses but cannot change them', () => {
            setup({ userId: 'stranger-1', actionUses: { Fleetfoot: 1 } });
            expect(screen.getByText('1 / 2')).toBeInTheDocument();
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        test('a passive with limited uses shows them without a Use button', () => {
            setup({ canUseActions: false }, { ...fleetfoot, category: 'passive' });
            expect(screen.getByText('2 / 2')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /^Use/ })).not.toBeInTheDocument();
        });

        test('an action that is not limited shows no uses, and uses its points as before', () => {
            setup({}, toHitAction);
            expect(screen.queryByRole('group', { name: /Uses of/ })).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Use Action' }));
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { action_points: 2 });
        });

        test('a locked (unaffordable) card shows no tracker', () => {
            setup({ locked: true, canUseActions: false });
            expect(screen.queryByRole('group', { name: /Uses of/ })).not.toBeInTheDocument();
        });

        test('without onActionUsesChange (an enemy card, a preview) the uses are only the "2/Day" label', () => {
            const onUseAction = jest.fn();
            render(<CombatActionList actions={[fleetfoot]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" canUseActions onUseAction={onUseAction} />);
            expect(screen.getByText(/2\/Day/)).toBeInTheDocument();
            expect(screen.queryByRole('group', { name: /Uses of/ })).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Use Action' }));
            expect(onUseAction).toHaveBeenCalledWith(fleetfoot);
        });

        test('with an onUseAction override and tracking, the use is spent through onActionUsesChange', () => {
            const onUseAction = jest.fn();
            const onActionUsesChange = jest.fn();
            render(<CombatActionList actions={[fleetfoot]} {...STAT_PROPS} characterPage={characterPage} hasWritePermissions canUseActions onUseAction={onUseAction} actionUses={{}} onActionUsesChange={onActionUsesChange} />);
            fireEvent.click(screen.getByRole('button', { name: 'Use Action' }));
            expect(onUseAction).toHaveBeenCalledWith(fleetfoot);
            expect(onActionUsesChange).toHaveBeenCalledWith({ Fleetfoot: 1 });
        });
    });

    describe('the footer', () => {
        test('holds the Use button in the card (not pinned over its content), and is absent when there is nothing for it', () => {
            const { container, rerender } = render(<CombatActionList actions={[toHitAction]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" canUseActions />);
            expect(screen.getByRole('button', { name: 'Use Action' }).parentElement).toHaveClass('CombatActionListCard-footer');

            rerender(<CombatActionList actions={[toHitAction]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" />);
            expect(container.querySelector('.CombatActionListCard-footer')).not.toBeInTheDocument();
        });
    });
    describe('roleplay cards', () => {
        const persuade = { actionName: 'Silver Tongue', category: 'action', toHitBool: false, difficultyClass: 'Cha,1', actionCost: 2, range: 'Earshot' };
        const limitedTalk = { ...persuade, actionName: 'Old Friend', actionType: 'perDay', actionTypeCount: 2 };
        const setup = (action, props = {}) => {
            const onActionUsesChange = jest.fn();
            render(<CombatActionList actions={[action]} {...STAT_PROPS} characterPage={characterPage} userId="owner-1" canUseActions roleplay actionUses={{}} onActionUsesChange={onActionUsesChange} {...props} />);
            return onActionUsesChange;
        };

        test('show the check and range, but no action point cost', () => {
            setup(persuade);
            expect(screen.getByText('DC 15 Cha check · Earshot')).toBeInTheDocument();
            expect(screen.queryByText(/Actions?$/)).not.toBeInTheDocument();
        });

        test('a reaction is not called a reaction here either', () => {
            setup({ ...persuade, category: 'reaction' });
            expect(screen.queryByText(/Reaction/)).not.toBeInTheDocument();
        });

        test('keep the frequency of a limited action', () => {
            setup(limitedTalk);
            expect(screen.getByText('2/Day · DC 15 Cha check · Earshot')).toBeInTheDocument();
        });

        test('an action with no limit has no Use button: there is nothing to spend', () => {
            setup(persuade);
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        test('a limited one has a Use button that spends a use and not action points', () => {
            const onActionUsesChange = setup(limitedTalk);
            fireEvent.click(screen.getByRole('button', { name: 'Use' }));
            expect(onActionUsesChange).toHaveBeenCalledWith({ 'Old Friend': 1 });
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('with none left, the button says so and is off', () => {
            setup(limitedTalk, { actionUses: { 'Old Friend': 2 } });
            expect(screen.getByRole('button', { name: 'No uses left' })).toBeDisabled();
        });

        test('someone who cannot edit the sheet gets no Use button', () => {
            setup(limitedTalk, { userId: 'stranger-1' });
            expect(screen.queryByRole('button', { name: 'Use' })).not.toBeInTheDocument();
        });

        test('a passive with limited uses shows them but has nothing to use', () => {
            setup({ ...limitedTalk, category: 'passive' }, { canUseActions: false });
            expect(screen.getByText('2 / 2')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Use' })).not.toBeInTheDocument();
        });
    });
    describe('the reaction (one per turn)', () => {
        const parry = { ...toHitAction, actionName: 'Parry', category: 'reaction', actionCost: 1 };
        const setup = (extra = {}, sheet = characterPage, action = parry) => render(<CombatActionList actions={[action]} {...STAT_PROPS} characterPage={sheet} userId="owner-1" canUseActions {...extra} />);

        test('using a reaction spends it along with its action points, in one write', () => {
            setup();
            fireEvent.click(screen.getByRole('button', { name: 'Use Reaction' }));
            expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { action_points: 2, reaction_used: true });
        });

        test('using an ordinary action leaves the reaction alone', () => {
            setup({}, characterPage, { ...toHitAction, category: 'action' });
            fireEvent.click(screen.getByRole('button', { name: 'Use Action' }));
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { action_points: 2 });
        });

        test('with the reaction already used, a reaction can\'t be used again this turn', () => {
            setup({}, { ...characterPage, reaction_used: true });
            const button = screen.getByRole('button', { name: 'Reaction used' });
            expect(button).toBeDisabled();
            fireEvent.click(button);
            expect(mockUpdateDoc).not.toHaveBeenCalled();
            expect(button.closest('.CombatActionListCard')).toHaveClass('CombatActionListCard-spent');
        });

        test('but the actions still can', () => {
            setup({}, { ...characterPage, reaction_used: true }, { ...toHitAction, category: 'action' });
            expect(screen.getByRole('button', { name: 'Use Action' })).toBeEnabled();
        });

        test('an override (an enemy card) is given the action, and left to spend the reaction', () => {
            const onUseAction = jest.fn();
            setup({ onUseAction });
            fireEvent.click(screen.getByRole('button', { name: 'Use Reaction' }));
            expect(onUseAction).toHaveBeenCalledWith(parry);
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('an override with the reaction already used has the button off too', () => {
            setup({ onUseAction: jest.fn() }, { ...characterPage, reaction_used: true });
            expect(screen.getByRole('button', { name: 'Reaction used' })).toBeDisabled();
        });

        test('a reaction on the roleplay tab is not limited by the turn\'s reaction', () => {
            render(<CombatActionList actions={[{ ...parry, actionType: 'perDay', actionTypeCount: 1 }]} {...STAT_PROPS} characterPage={{ ...characterPage, reaction_used: true }} userId="owner-1" canUseActions roleplay actionUses={{}} onActionUsesChange={jest.fn()} />);
            expect(screen.getByRole('button', { name: 'Use' })).toBeEnabled();
        });

        test('a card with no character to look at (a preview) still works', () => {
            render(<CombatActionList actions={[parry]} {...STAT_PROPS} hasWritePermissions canUseActions onUseAction={jest.fn()} />);
            expect(screen.getByRole('button', { name: 'Use Reaction' })).toBeEnabled();
        });
    });
});
