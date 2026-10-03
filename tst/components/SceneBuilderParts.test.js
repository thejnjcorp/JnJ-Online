import { render, screen, fireEvent, within } from '@testing-library/react';
import { AttachmentsEditor, BuilderSide, NewNpcDialog, OnlyIfSelect, PlayersInScene, TimeGoalBar, conditionKey } from '../../src/components/SceneBuilderParts';

describe('AttachmentsEditor', () => {
    test('attaches an NPC or a check, edits it where it is, and removes it', () => {
        const onChange = jest.fn();
        const beat = { id: 'n', type: 'narration' };
        const { rerender } = render(<AttachmentsEditor beat={beat} onChange={onChange}/>);
        fireEvent.click(screen.getByRole('button', { name: '+ Attach NPC or check to this beat' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'NPC' }));
        expect(onChange).toHaveBeenLastCalledWith({ ...beat, attachments: [expect.objectContaining({ kind: 'npc', npcName: '' })] });

        const withNpc = { ...beat, attachments: [{ id: 'a1', kind: 'npc', npcName: 'Bully', behaviors: '' }, { id: 'a2', kind: 'check', skill: '', dc: '', text: '' }] };
        rerender(<AttachmentsEditor beat={withNpc} onChange={onChange}/>);
        fireEvent.change(screen.getByLabelText('Attached NPC name'), { target: { value: 'Snotty Bully' } });
        expect(onChange).toHaveBeenLastCalledWith({ ...withNpc, attachments: [{ ...withNpc.attachments[0], npcName: 'Snotty Bully' }, withNpc.attachments[1]] });
        fireEvent.change(screen.getByLabelText('Attached check DC'), { target: { value: '12' } });
        expect(onChange.mock.calls.at(-1)[0].attachments[1].dc).toBe('12');
        fireEvent.click(screen.getByRole('button', { name: 'Remove attached check' }));
        expect(onChange.mock.calls.at(-1)[0].attachments).toHaveLength(1);
    });

    test('a check can be attached too', () => {
        const onChange = jest.fn();
        render(<AttachmentsEditor beat={{ id: 'n' }} onChange={onChange}/>);
        fireEvent.click(screen.getByRole('button', { name: '+ Attach NPC or check to this beat' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Check' }));
        expect(onChange.mock.calls[0][0].attachments[0]).toMatchObject({ kind: 'check', skill: '' });
    });
});

describe('OnlyIfSelect', () => {
    const choices = [{ key: 's:d:a', sceneId: 's', beatId: 'd', optionId: 'a', label: 'Warehouse approach = Front door' }];

    test('is always, until a path is chosen, and always again when cleared', () => {
        const onChange = jest.fn();
        render(<OnlyIfSelect label="Only runs if" choices={choices} value="" onChange={onChange}/>);
        expect(screen.getByLabelText('Only runs if')).toHaveValue('');
        fireEvent.change(screen.getByLabelText('Only runs if'), { target: { value: 's:d:a' } });
        expect(onChange).toHaveBeenLastCalledWith(choices[0]);
        fireEvent.change(screen.getByLabelText('Only runs if'), { target: { value: '' } });
        expect(onChange).toHaveBeenLastCalledWith(null);
    });

    test('the key of a condition is its scene, decision and option', () => {
        expect(conditionKey({ sceneId: 's', beatId: 'd', optionId: 'a' })).toBe('s:d:a');
        expect(conditionKey(null)).toBe('');
    });
});

describe('PlayersInScene', () => {
    const players = [{ id: 'a', name: 'Floyd' }, { id: 'b', name: 'Armani' }, { id: 'c', name: 'Leon' }];

    test('everyone is in unless left out, and switching them all back on is everyone again', () => {
        const onChange = jest.fn();
        const { rerender } = render(<PlayersInScene players={players} scene={{}} onChange={onChange}/>);
        players.forEach(player => expect(screen.getByRole('button', { name: player.name })).toHaveAttribute('aria-pressed', 'true'));
        fireEvent.click(screen.getByRole('button', { name: 'Armani' }));
        expect(onChange).toHaveBeenLastCalledWith(['a', 'c']);
        rerender(<PlayersInScene players={players} scene={{ playerIds: ['a', 'c'] }} onChange={onChange}/>);
        expect(screen.getByRole('button', { name: 'Armani' })).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(screen.getByRole('button', { name: 'Armani' }));
        expect(onChange).toHaveBeenLastCalledWith(null);
    });

    test('says so with no players', () => {
        render(<PlayersInScene players={[]} scene={{}} onChange={jest.fn()}/>);
        expect(screen.getByText('No players in this campaign yet.')).toBeInTheDocument();
    });
});

describe('NewNpcDialog', () => {
    test('needs a name, then adds the NPC with how they behave', () => {
        const onAdd = jest.fn();
        const onClose = jest.fn();
        render(<NewNpcDialog onAdd={onAdd} onClose={onClose}/>);
        expect(screen.getByRole('button', { name: 'Add NPC beat' })).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Snotty Bully ' } });
        fireEvent.change(screen.getByLabelText('Voice and behaviors (one per line)'), { target: { value: 'Rude' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add NPC beat' }));
        expect(onAdd).toHaveBeenCalledWith('Snotty Bully', 'Rude');
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });
});

describe('TimeGoalBar', () => {
    test('shows the estimate against the goal range', () => {
        render(<TimeGoalBar scene={{ timeMin: 30, timeMax: 50 }} estimate={34}/>);
        expect(screen.getByRole('img', { name: 'Beats add up to about 34 minutes against a goal of 30 to 50 minutes' })).toBeInTheDocument();
    });

    test('is not there with no goal', () => {
        const { container } = render(<TimeGoalBar scene={{}} estimate={10}/>);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('BuilderSide', () => {
    const base = { id: 'me', sessionId: 's1', type: 'mixed', beats: [], branch: null };
    const split = { id: 'split', sessionId: 's1', name: 'Combat', beats: [{ id: 'd', type: 'decision', title: 'How did they approach?', options: [{ id: 'oa', label: 'Front door' }] }] };
    const props = (extra = {}) => ({
        current: base, edit: jest.fn(), estimate: 34, beats: [], scenes: [base, split], players: [{ id: 'a', name: 'Floyd' }], owner: null, ownerBeat: null, endsWith: null,
        onOpenScene: jest.fn(), onSetCondition: jest.fn(), onAddNpc: jest.fn(), ...extra,
    });

    test('lists NPCs from beats and from what is attached to them, and opens the New NPC popup', () => {
        const p = props({ beats: [
            { id: 'b1', type: 'npc', npcName: 'Kal' },
            { id: 'b2', type: 'narration', attachments: [{ id: 'x', kind: 'npc', npcName: 'Snotty Bully' }, { id: 'y', kind: 'check', skill: 'Dex' }] },
        ] });
        render(<BuilderSide {...p}/>);
        expect(screen.getByText('Kal · beat 1')).toBeInTheDocument();
        expect(screen.getByText('Snotty Bully · beat 2')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '+ New NPC' }));
        expect(p.onAddNpc).toHaveBeenCalled();
    });

    test('Only runs if offers the session\'s decision paths, and chooses one for the scene', () => {
        const p = props();
        render(<BuilderSide {...p}/>);
        const select = screen.getByLabelText('Only runs if');
        expect(within(select).getByRole('option', { name: 'How did they approach? = Front door' })).toBeInTheDocument();
        fireEvent.change(select, { target: { value: 'split:d:oa' } });
        expect(p.onSetCondition).toHaveBeenCalledWith(base, expect.objectContaining({ sceneId: 'split', beatId: 'd', optionId: 'oa' }));
    });

    test('a scene that is already a path shows which, and the players can be switched', () => {
        const p = props({ current: { ...base, branch: { fromSceneId: 'split', optionId: 'oa' } }, owner: split, ownerBeat: split.beats[0] });
        render(<BuilderSide {...p}/>);
        expect(screen.getByLabelText('Only runs if')).toHaveValue('split:d:oa');
        fireEvent.click(screen.getByRole('button', { name: 'Floyd' }));
        expect(p.edit).toHaveBeenCalledWith({ playerIds: [] });
    });
});
