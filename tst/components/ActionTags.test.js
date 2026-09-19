import { render, screen, fireEvent, within } from '@testing-library/react';
import { ActionTags } from '../../src/components/ActionTags';

const fireOnAction = { id: 'a1', tagId: 'c-fire', tagInfo: 'Fire', tagColor: '#f00', textColor: '#fff', tagDescription: 'Burns' };
const custom = { id: 'a2', tagInfo: 'Sneaky', tagColor: '#000', textColor: '#fff' };

const catalog = {
    status: 'ready',
    tags: [
        { id: 'c-fire', tagInfo: 'Fire', tagColor: '#f00', textColor: '#fff' },
        { id: 'c-melee', tagInfo: 'Melee', tagColor: '#00f', textColor: '#fff', isDefault: true },
        { id: 'c-ice', tagInfo: 'Ice', tagColor: '#0ff', textColor: '#000' },
        { id: 'c-monk', tagInfo: 'Stance', tagColor: '#0a0', textColor: '#fff', classes: ['Monk'] },
        { id: 'c-gun', tagInfo: 'Trick', tagColor: '#a0a', textColor: '#fff', classes: ['Gunslinger'] },
    ],
};

const handlers = () => ({ onAdd: jest.fn(), onRemove: jest.fn(), onCustom: jest.fn(), onEditCustom: jest.fn() });
const openPicker = () => fireEvent.click(screen.getByRole('button', { name: '+ Tag' }));

describe('ActionTags', () => {
    describe('viewing', () => {
        test('shows each tag as a pill in its colours, with its description on hover', () => {
            render(<ActionTags tags={[fireOnAction, custom]} isEditable={false}/>);

            const pill = screen.getByText('Fire');
            expect(pill).toHaveStyle({ backgroundColor: '#f00', color: '#fff' });
            expect(pill).toHaveAttribute('title', 'Burns');
            expect(screen.getByText('Sneaky')).toBeInTheDocument();
        });

        test('has no controls, and says so when there are no tags', () => {
            render(<ActionTags tags={[]} isEditable={false}/>);
            expect(screen.getByText('No tags.')).toBeInTheDocument();
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        test('a tag with no label is not shown', () => {
            render(<ActionTags tags={[{ id: 'b', tagInfo: '' }]} isEditable={false}/>);
            expect(screen.getByText('No tags.')).toBeInTheDocument();
        });
    });

    describe('editing', () => {
        test('a catalog tag is a pill with a remove button; a custom tag\'s pill opens it for editing', () => {
            const on = handlers();
            render(<ActionTags tags={[fireOnAction, custom]} isEditable {...on}/>);

            fireEvent.click(screen.getByRole('button', { name: 'Remove tag Fire' }));
            expect(on.onRemove).toHaveBeenCalledWith(0);

            expect(screen.queryByRole('button', { name: 'Fire' })).not.toBeInTheDocument(); // catalog tags aren't edited here
            fireEvent.click(screen.getByRole('button', { name: 'Sneaky' }));
            expect(on.onEditCustom).toHaveBeenCalledWith(1);
        });

        test('a custom tag that has no label yet is still visible, as "Unnamed tag", so it can be found and finished', () => {
            const on = handlers();
            render(<ActionTags tags={[{ id: 'b', tagInfo: '' }]} isEditable {...on}/>);
            fireEvent.click(screen.getByRole('button', { name: 'Unnamed tag' }));
            expect(on.onEditCustom).toHaveBeenCalledWith(0);
        });

        test('the picker is closed until + Tag is pressed, and + Tag toggles it', () => {
            render(<ActionTags tags={[]} isEditable catalog={catalog} {...handlers()}/>);
            expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();

            openPicker();
            expect(screen.getByRole('searchbox', { name: 'Search tags' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '+ Tag' })).toHaveAttribute('aria-expanded', 'true');

            openPicker();
            expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
        });
    });

    describe('the picker', () => {
        test('offers general tags, and tags for the class being edited, but not ones for other classes', () => {
            render(<ActionTags tags={[]} isEditable catalog={catalog} forClass="Monk" {...handlers()}/>);
            openPicker();

            const general = within(screen.getByRole('group', { name: 'General' }));
            expect(general.getAllByRole('button').map(button => button.textContent)).toEqual(['Melee', 'Fire', 'Ice']); // default first, then A-Z... by label
            expect(within(screen.getByRole('group', { name: 'For Monk' })).getByRole('button', { name: 'Stance' })).toBeInTheDocument();
            expect(screen.queryByText('Trick')).not.toBeInTheDocument();
        });

        test('with no class yet (a race, or an unnamed class) only general tags are offered', () => {
            render(<ActionTags tags={[]} isEditable catalog={catalog} {...handlers()}/>);
            openPicker();
            expect(screen.queryByText('Stance')).not.toBeInTheDocument();
            expect(screen.getByRole('group', { name: 'General' })).toBeInTheDocument();
        });

        test('leaves out a tag the action already has', () => {
            render(<ActionTags tags={[fireOnAction]} isEditable catalog={catalog} {...handlers()}/>);
            openPicker();
            expect(within(screen.getByRole('group', { name: 'General' })).queryByRole('button', { name: 'Fire' })).not.toBeInTheDocument();
        });

        test('choosing a tag adds a copy of it, and the picker stays open for another', () => {
            const on = handlers();
            render(<ActionTags tags={[]} isEditable catalog={catalog} {...on}/>);
            openPicker();

            fireEvent.click(screen.getByRole('button', { name: 'Ice' }));

            expect(on.onAdd).toHaveBeenCalledTimes(1);
            expect(on.onAdd.mock.calls[0][0]).toMatchObject({ tagId: 'c-ice', tagInfo: 'Ice', tagColor: '#0ff', textColor: '#000' });
            expect(screen.getByRole('searchbox')).toBeInTheDocument();
        });

        test('search narrows the list without regard to case', () => {
            render(<ActionTags tags={[]} isEditable catalog={catalog} forClass="Monk" {...handlers()}/>);
            openPicker();

            fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'STAN' } });

            expect(screen.getByRole('button', { name: 'Stance' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Fire' })).not.toBeInTheDocument();
        });

        test('says so when nothing matches, and when the catalog is empty', () => {
            const { unmount } = render(<ActionTags tags={[]} isEditable catalog={catalog} {...handlers()}/>);
            openPicker();
            fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
            expect(screen.getByText('No more tags match.')).toBeInTheDocument();
            unmount();

            render(<ActionTags tags={[]} isEditable catalog={{ status: 'ready', tags: [] }} {...handlers()}/>);
            openPicker();
            expect(screen.getByText(/No tags in the catalog yet/)).toBeInTheDocument();
        });

        test('says when the tags are loading, and when they could not be loaded (custom tags still work)', () => {
            const on = handlers();
            const { unmount } = render(<ActionTags tags={[]} isEditable catalog={{ status: 'loading', tags: [] }} {...on}/>);
            openPicker();
            expect(screen.getByText('Loading tags…')).toBeInTheDocument();
            unmount();

            render(<ActionTags tags={[]} isEditable catalog={{ status: 'error', tags: [] }} {...on}/>);
            openPicker();
            expect(screen.getByRole('alert')).toHaveTextContent(/Couldn't load the tag catalog/);
            fireEvent.click(screen.getByRole('button', { name: 'Custom tag…' }));
            expect(on.onCustom).toHaveBeenCalled();
        });

        test('Custom tag… closes the picker and asks for a custom tag; Done just closes it', () => {
            const on = handlers();
            render(<ActionTags tags={[]} isEditable catalog={catalog} {...on}/>);
            openPicker();
            fireEvent.click(screen.getByRole('button', { name: 'Custom tag…' }));
            expect(on.onCustom).toHaveBeenCalledTimes(1);
            expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();

            openPicker();
            fireEvent.click(screen.getByRole('button', { name: 'Done' }));
            expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
            expect(on.onCustom).toHaveBeenCalledTimes(1);
        });

        test('a tag\'s description is its hover text in the picker', () => {
            render(<ActionTags tags={[]} isEditable catalog={{ status: 'ready', tags: [{ id: 'x', tagInfo: 'Fire', tagDescription: 'Burns things' }] }} {...handlers()}/>);
            openPicker();
            expect(screen.getByRole('button', { name: 'Fire' })).toHaveAttribute('title', 'Burns things');
        });
    });
});
