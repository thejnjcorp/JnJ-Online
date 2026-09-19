import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ClassLevelRewards } from '../../src/components/ClassLevelRewards';

const actions = [{ actionName: 'Start' }, { actionName: 'Fleetfoot', actionLevel: 3 }, { actionName: '', actionLevel: 3 }];

// The page owns the rewards; this stands in for it.
function Page({ initial = [], isEditable = true, errors, onChange = () => {} }) {
    const [rewards, setRewards] = useState(initial);
    return <ClassLevelRewards rewards={rewards} actions={actions} isEditable={isEditable} errors={errors} onChange={next => { setRewards(next); onChange(next); }}/>;
}

const level = n => screen.getByRole('region', { name: `Level ${n}` });

describe('ClassLevelRewards', () => {
    describe('editing', () => {
        test('starts with just the levels that have an action unlocking, and a hint that there is nothing else', () => {
            render(<Page/>);
            expect(screen.getByText('Level 3')).toBeInTheDocument();
            expect(screen.queryByText('Level 2')).not.toBeInTheDocument();
            expect(within(level(3)).getByText(/Unlocks: Fleetfoot, Unnamed/)).toBeInTheDocument();
        });

        test('says so when there is nothing at all yet', () => {
            const { container } = render(<ClassLevelRewards rewards={[]} actions={[]} isEditable onChange={() => {}}/>);
            expect(container).toHaveTextContent('No rewards yet.');
        });

        test.each([
            ['+ Stat point', 'Points'],
            ['+ Bonus', 'Amount'],
            ['+ Note', 'Note'],
        ])('%s adds a reward at the chosen level, in a group for that level', (button, field) => {
            const onChange = jest.fn();
            render(<Page onChange={onChange}/>);
            fireEvent.change(screen.getByRole('combobox', { name: /Add to level/ }), { target: { value: '5' } });

            fireEvent.click(screen.getByRole('button', { name: button }));

            expect(onChange.mock.calls[0][0][0].level).toBe(5);
            expect(within(level(5)).getByLabelText(field)).toBeInTheDocument();
        });

        test('rewards start out valid apart from a note, which needs writing', () => {
            const onChange = jest.fn();
            render(<Page onChange={onChange}/>);
            fireEvent.click(screen.getByRole('button', { name: '+ Stat point' }));
            fireEvent.click(screen.getByRole('button', { name: '+ Bonus' }));

            const [stat, bonus] = onChange.mock.calls.at(-1)[0];
            expect(stat).toMatchObject({ kind: 'stat_point', points: 1 });
            expect(bonus).toMatchObject({ kind: 'bonus', stat: 'armor_class', amount: 1 });
        });

        test('editing a reward reports the change to just that reward', () => {
            const onChange = jest.fn();
            const initial = [
                { id: 'a', level: 2, kind: 'bonus', stat: 'armor_class', amount: 1 },
                { id: 'b', level: 2, kind: 'note', text: 'Old' },
            ];
            render(<Page initial={initial} onChange={onChange}/>);

            fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '3' } });
            expect(onChange).toHaveBeenLastCalledWith([{ ...initial[0], amount: 3 }, initial[1]]);

            fireEvent.change(screen.getByLabelText('Stat'), { target: { value: 'hit_modifier' } });
            expect(onChange.mock.calls.at(-1)[0][0].stat).toBe('hit_modifier');

            fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'New' } });
            expect(onChange.mock.calls.at(-1)[0][1].text).toBe('New');
        });

        test('a stat point\'s points can be changed', () => {
            const onChange = jest.fn();
            render(<Page initial={[{ id: 'a', level: 2, kind: 'stat_point', points: 1 }]} onChange={onChange}/>);
            fireEvent.change(screen.getByLabelText('Points'), { target: { value: '2' } });
            expect(onChange.mock.calls[0][0][0].points).toBe(2);
        });

        test('Remove takes the reward away, and its level with it when nothing else is there', () => {
            render(<Page initial={[{ id: 'a', level: 7, kind: 'note', text: 'Hi' }]}/>);
            expect(screen.getByText('Level 7')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Remove reward' }));

            expect(screen.queryByText('Level 7')).not.toBeInTheDocument();
        });

        test('rewards are grouped by level, in level order, however they were added', () => {
            render(<Page initial={[
                { id: 'a', level: 9, kind: 'note', text: 'Nine' },
                { id: 'b', level: 4, kind: 'note', text: 'Four' },
            ]}/>);
            const titles = screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent);
            expect(titles).toEqual(['Level 3', 'Level 4', 'Level 9']);
        });

        test('an invalid reward is outlined and says why, on the field', () => {
            render(<Page initial={[{ id: 'a', level: 2, kind: 'note', text: '' }]} errors={{ a: { text: 'Write the note.' } }}/>);

            expect(screen.getByLabelText('Note')).toHaveAttribute('aria-invalid', 'true');
            expect(screen.getByLabelText('Note')).toHaveAttribute('data-problem', 'reward-a-text');
            expect(screen.getByText('Write the note.')).toBeInTheDocument();
        });
    });

    describe('viewing', () => {
        test('lists what each level gives, without any editing controls', () => {
            render(<Page isEditable={false} initial={[
                { id: 'a', level: 2, kind: 'stat_point', points: 1 },
                { id: 'b', level: 2, kind: 'bonus', stat: 'armor_class', amount: 1 },
                { id: 'c', level: 2, kind: 'note', text: 'Pick a Stance' },
            ]}/>);

            expect(within(level(2)).getAllByRole('listitem').map(item => item.textContent)).toEqual([
                '+1 to an ability score of your choice', '+1 Armor Class', 'Pick a Stance',
            ]);
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        test('shows nothing at all for a class with no rewards and no unlocks', () => {
            const { container } = render(<ClassLevelRewards rewards={[]} actions={[{ actionName: 'Start' }]} isEditable={false} onChange={() => {}}/>);
            expect(container).toBeEmptyDOMElement();
        });

        test('still shows the levels where actions unlock', () => {
            render(<Page isEditable={false}/>);
            expect(within(level(3)).getByText(/Unlocks: Fleetfoot/)).toBeInTheDocument();
        });
    });
});
