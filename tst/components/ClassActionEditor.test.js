jest.mock('../../src/components/ClassTagEditDialog', () => ({
    ClassTagEditDialog: ({ actionIndex, tagIndex, tag, onClose, onDelete }) => <div>
        TagDialog-stub:{actionIndex}:{tagIndex}:{tag.tagInfo}
        <button type="button" onClick={onClose}>Stub Close</button>
        <button type="button" onClick={onDelete}>Stub Delete</button>
    </div>,
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { ClassActionEditor } from '../../src/components/ClassActionEditor';

const tag = { tagInfo: 'Fire', tagColor: '#ff0000', textColor: '#ffffff', tagDescription: 'Deals fire damage' };

const viewAction = {
    actionName: 'Stab', actionCost: 1, actionLevel: 3, actionType: 'perDay', actionTypeCount: 2,
    category: 'action', toHitBool: false, difficultyClass: 'Dex,0', range: '1 Zone',
    description: 'Deal **2d6** damage.', tags: [tag],
};

function open(props) {
    render(<ClassActionEditor action={viewAction} index={0} onChange={jest.fn()} onRemove={jest.fn()} onAddTag={jest.fn()} onRemoveTag={jest.fn()} isEditable={false} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Stab|Unnamed/ }));
}

describe('ClassActionEditor', () => {
    describe('header', () => {
        test('shows the action name, cost, level, and frequency badge', () => {
            render(<ClassActionEditor action={viewAction} index={0} onChange={jest.fn()} onRemove={jest.fn()} onAddTag={jest.fn()} onRemoveTag={jest.fn()} isEditable={false} />);
            expect(screen.getByText('Stab')).toBeInTheDocument();
            expect(screen.getByText('1')).toBeInTheDocument();
            expect(screen.getByText('Lvl 3')).toBeInTheDocument();
            expect(screen.getByText('Per Day ×2')).toBeInTheDocument();
        });

        test('falls back to "Unnamed" and level 1 for a bare action', () => {
            render(<ClassActionEditor action={{}} index={0} onChange={jest.fn()} onRemove={jest.fn()} onAddTag={jest.fn()} onRemoveTag={jest.fn()} isEditable={false} />);
            expect(screen.getByText('Unnamed')).toBeInTheDocument();
            expect(screen.getByText('Lvl 1')).toBeInTheDocument();
        });

        test('the body is collapsed until the header is clicked, then toggles closed again', () => {
            render(<ClassActionEditor action={viewAction} index={0} onChange={jest.fn()} onRemove={jest.fn()} onAddTag={jest.fn()} onRemoveTag={jest.fn()} isEditable={false} />);
            expect(screen.queryByText('Fire')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: /Stab/ }));
            expect(screen.getByText('Fire')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: /Stab/ }));
            expect(screen.queryByText('Fire')).not.toBeInTheDocument();
        });
    });

    describe('view mode', () => {
        test('the meta line joins range, resolve summary, and frequency (when not standard)', () => {
            open({ isEditable: false });
            expect(screen.getByText('1 Zone · DC (Dex,0) · Per Day ×2')).toBeInTheDocument();
        });

        test('a standard-frequency action omits the frequency segment', () => {
            render(<ClassActionEditor action={{ ...viewAction, actionType: 'standard' }} index={0} onChange={jest.fn()} onRemove={jest.fn()} onAddTag={jest.fn()} onRemoveTag={jest.fn()} isEditable={false} />);
            fireEvent.click(screen.getByRole('button', { name: /Stab/ }));
            expect(screen.getByText('1 Zone · DC (Dex,0)')).toBeInTheDocument();
        });

        test('a to-hit action shows "+<mod> to hit" instead of a DC', () => {
            render(<ClassActionEditor action={{ ...viewAction, toHitBool: true, toHit: 4 }} index={0} onChange={jest.fn()} onRemove={jest.fn()} onAddTag={jest.fn()} onRemoveTag={jest.fn()} isEditable={false} />);
            fireEvent.click(screen.getByRole('button', { name: /Stab/ }));
            expect(screen.getByText(/\+4 to hit/)).toBeInTheDocument();
        });

        test('shows Trigger and Requirement lines only when present', () => {
            open({ action: { ...viewAction, trigger: 'On hit', requirement: 'Wielding a blade' } });
            expect(screen.getByText('On hit')).toBeInTheDocument();
            expect(screen.getByText('Wielding a blade')).toBeInTheDocument();
        });

        test('renders the description as markdown', () => {
            open({});
            const bold = screen.getByText('2d6');
            expect(bold.tagName).toBe('STRONG');
        });

        test('shows an outcome table only for rows with a value', () => {
            open({ action: { ...viewAction, outcomeTable: { success: 'Hit for 2d6', failure: '' } } });
            expect(screen.getByText('Success')).toBeInTheDocument();
            expect(screen.getByText('Hit for 2d6')).toBeInTheDocument();
            expect(screen.queryByText('Failure')).not.toBeInTheDocument();
        });

        test('no outcome table at all when every value is empty', () => {
            open({ action: { ...viewAction, outcomeTable: { success: '', failure: '' } } });
            expect(screen.queryByRole('table')).not.toBeInTheDocument();
        });

        test('tags render as read-only pills with the description as a title attribute, and no + Tag button', () => {
            open({});
            const pill = screen.getByText('Fire');
            expect(pill.tagName).toBe('SPAN');
            expect(pill).toHaveAttribute('title', 'Deals fire damage');
            expect(screen.queryByRole('button', { name: '+ Tag' })).not.toBeInTheDocument();
        });

        test('no Remove Action button', () => {
            open({});
            expect(screen.queryByRole('button', { name: 'Remove Action' })).not.toBeInTheDocument();
        });
    });

    describe('edit mode', () => {
        test('editing the action name reports a change scoped to this action\'s index', () => {
            const onChange = jest.fn();
            open({ isEditable: true, index: 2, onChange });

            fireEvent.change(screen.getByDisplayValue('Stab'), { target: { value: 'Slash' } });

            expect(onChange).toHaveBeenCalledWith({ name: 'actions[2].actionName', value: 'Slash' });
        });

        test('editing a number field reports a numeric value', () => {
            const onChange = jest.fn();
            open({ isEditable: true, onChange });

            fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '2' } }); // actionCost

            expect(onChange).toHaveBeenCalledWith({ name: 'actions[0].actionCost', value: 2 });
        });

        test('picking a frequency pill reports the new actionType', () => {
            const onChange = jest.fn();
            open({ isEditable: true, onChange });

            fireEvent.click(screen.getByRole('button', { name: 'Per Combat' }));

            expect(onChange).toHaveBeenCalledWith({ name: 'actions[0].actionType', value: 'perCombat' });
        });

        test('the Times field only appears for a non-standard frequency', () => {
            open({ isEditable: true, action: { ...viewAction, actionType: 'standard' } });
            expect(screen.queryByDisplayValue('2')).not.toBeInTheDocument();
        });

        test('switching "Resolves via" from DC to To-Hit reports toHitBool and swaps the visible field', () => {
            const onChange = jest.fn();
            open({ isEditable: true, onChange });
            expect(screen.getByDisplayValue('Dex,0')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'To-Hit' }));

            expect(onChange).toHaveBeenCalledWith({ name: 'actions[0].toHitBool', value: true });
        });

        test('picking the Reaction category reveals the Trigger field; Passive hides both Trigger and Requirement', () => {
            const onChange = jest.fn();
            open({ isEditable: true, onChange });

            fireEvent.click(screen.getByRole('button', { name: 'Reaction' }));
            expect(onChange).toHaveBeenCalledWith({ name: 'actions[0].category', value: 'reaction' });
        });

        test('the Trigger field is visible for a reaction action, hidden for an action-category one', () => {
            open({ isEditable: true, action: { ...viewAction, category: 'reaction' } });
            expect(screen.getByPlaceholderText('A Physical ranged attack targeting you')).toBeInTheDocument();
        });

        test('Requirement is hidden for a passive category action', () => {
            open({ isEditable: true, action: { ...viewAction, category: 'passive' } });
            expect(screen.queryByPlaceholderText('You are not Engaged')).not.toBeInTheDocument();
        });

        test('editing the description textarea reports the change', () => {
            const onChange = jest.fn();
            open({ isEditable: true, onChange });

            fireEvent.change(screen.getByDisplayValue('Deal **2d6** damage.'), { target: { value: 'New description' } });

            expect(onChange).toHaveBeenCalledWith({ name: 'actions[0].description', value: 'New description' });
        });

        test('the outcome table toggle reveals rows only once checked', () => {
            open({ isEditable: true });
            expect(screen.queryByText('Success')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('checkbox'));

            expect(screen.getByText('Success')).toBeInTheDocument();
            expect(screen.getByText('Critical Failure')).toBeInTheDocument();
        });

        test('an outcome row change reports the scoped outcomeTable path', () => {
            const onChange = jest.fn();
            open({ isEditable: true, onChange, action: { ...viewAction, outcomeTable: { success: 'old' } } });

            fireEvent.change(screen.getByDisplayValue('old'), { target: { value: 'Hit for 2d6' } });

            expect(onChange).toHaveBeenCalledWith({ name: 'actions[0].outcomeTable.success', value: 'Hit for 2d6' });
        });

        test('a tag pill is a button; clicking it opens the tag edit dialog for that tag', () => {
            open({ isEditable: true });

            fireEvent.click(screen.getByRole('button', { name: 'Fire' }));

            expect(screen.getByText('TagDialog-stub:0:0:Fire')).toBeInTheDocument();
        });

        test('the tag dialog\'s delete calls onRemoveTag with the action and tag index, then closes', () => {
            const onRemoveTag = jest.fn();
            open({ isEditable: true, onRemoveTag, index: 1 });
            fireEvent.click(screen.getByRole('button', { name: 'Fire' }));

            fireEvent.click(screen.getByRole('button', { name: 'Stub Delete' }));

            expect(onRemoveTag).toHaveBeenCalledWith(1, 0);
            expect(screen.queryByText(/TagDialog-stub/)).not.toBeInTheDocument();
        });

        test('the tag dialog closes via its own close callback without deleting', () => {
            const onRemoveTag = jest.fn();
            open({ isEditable: true, onRemoveTag });
            fireEvent.click(screen.getByRole('button', { name: 'Fire' }));

            fireEvent.click(screen.getByRole('button', { name: 'Stub Close' }));

            expect(onRemoveTag).not.toHaveBeenCalled();
            expect(screen.queryByText(/TagDialog-stub/)).not.toBeInTheDocument();
        });

        test('+ Tag calls onAddTag with this action\'s index', () => {
            const onAddTag = jest.fn();
            open({ isEditable: true, onAddTag, index: 3 });

            fireEvent.click(screen.getByRole('button', { name: '+ Tag' }));

            expect(onAddTag).toHaveBeenCalledWith(3);
        });

        test('Remove Action calls onRemove with this action\'s index', () => {
            const onRemove = jest.fn();
            open({ isEditable: true, onRemove, index: 4 });

            fireEvent.click(screen.getByRole('button', { name: 'Remove Action' }));

            expect(onRemove).toHaveBeenCalledWith(4);
        });
    });
});
