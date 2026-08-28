import { render, screen, fireEvent } from '@testing-library/react';
import { ClassDamageCard } from '../../src/components/ClassDamageCard';

function melee(overrides = {}) {
    return {
        base_melee_damage_dice: 2,
        base_melee_damage_dice_type: 2, // code 2 -> "d6"
        base_melee_damage_modifier: 3,
        base_melee_damage_type: 'Slashing',
        ...overrides,
    };
}

describe('ClassDamageCard', () => {
    describe('read-only mode', () => {
        test('shows only the large preview, no inputs or die pills', () => {
            render(
                <ClassDamageCard kind="melee" label="Melee Damage" formData={melee()} isEditable={false} onChange={() => {}} onSetDieType={() => {}} />
            );
            expect(screen.queryAllByRole('textbox')).toHaveLength(0);
            expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
            expect(screen.getByText('2d6 + 3 · Slashing')).toBeInTheDocument();
        });
    });

    describe('editable mode', () => {
        test('renders the dice/mod/type inputs pre-filled from formData, scoped to the given kind', () => {
            render(
                <ClassDamageCard kind="ranged" label="Ranged Damage" formData={{
                    base_ranged_damage_dice: 1,
                    base_ranged_damage_dice_type: 4,
                    base_ranged_damage_modifier: -1,
                    base_ranged_damage_type: 'Piercing',
                }} isEditable onChange={() => {}} onSetDieType={() => {}} />
            );

            expect(screen.getByDisplayValue('1')).toHaveAttribute('name', 'base_ranged_damage_dice');
            expect(screen.getByDisplayValue('-1')).toHaveAttribute('name', 'base_ranged_damage_modifier');
            expect(screen.getByDisplayValue('Piercing')).toHaveAttribute('name', 'base_ranged_damage_type');
        });

        test('renders one die pill per die type, with the one matching formData highlighted as selected', () => {
            render(<ClassDamageCard kind="melee" label="Melee Damage" formData={melee()} isEditable onChange={() => {}} onSetDieType={() => {}} />);

            const pills = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'].map(label => screen.getByRole('button', { name: label }));
            expect(pills).toHaveLength(6);
            expect(pills[1]).toHaveClass('ClassPage-die-pill-selected'); // d6 = code 2, matches base_melee_damage_dice_type
            expect(pills[0]).not.toHaveClass('ClassPage-die-pill-selected');
        });

        test('clicking a die pill calls onSetDieType with the field name and the die\'s label string', () => {
            const onSetDieType = jest.fn();
            render(<ClassDamageCard kind="melee" label="Melee Damage" formData={melee()} isEditable onChange={() => {}} onSetDieType={onSetDieType} />);

            fireEvent.click(screen.getByRole('button', { name: 'd20' }));

            expect(onSetDieType).toHaveBeenCalledWith('base_melee_damage_dice_type', 'd20');
        });

        test('editing the dice/mod/type fields calls onChange (wired straight to the input)', () => {
            const onChange = jest.fn();
            render(<ClassDamageCard kind="melee" label="Melee Damage" formData={melee()} isEditable onChange={onChange} onSetDieType={() => {}} />);

            // melee()'s base_melee_damage_modifier is 3 - find that field by its current value
            fireEvent.change(screen.getByDisplayValue('3'), { target: { value: '5' } });

            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange.mock.calls[0][0].target.name).toBe('base_melee_damage_modifier');
        });

        test('also shows the small preview line below the inputs', () => {
            render(<ClassDamageCard kind="melee" label="Melee Damage" formData={melee()} isEditable onChange={() => {}} onSetDieType={() => {}} />);
            expect(screen.getByText('2d6 + 3 · Slashing')).toBeInTheDocument();
        });
    });

    describe('damage preview formatting', () => {
        test.each([
            [melee(), '2d6 + 3 · Slashing'],
            [melee({ base_melee_damage_modifier: -2 }), '2d6 - 2 · Slashing'],
            [melee({ base_melee_damage_modifier: 0 }), '2d6 · Slashing'],
            [melee({ base_melee_damage_modifier: undefined }), '2d6 · Slashing'],
            [melee({ base_melee_damage_type: '' }), '2d6 + 3'],
            [melee({ base_melee_damage_type: undefined }), '2d6 + 3'],
            [melee({ base_melee_damage_dice: undefined }), '0d6 + 3 · Slashing'],
            [melee({ base_melee_damage_dice_type: 0 }), '2 + 3 · Slashing'], // unrecognized code -> "N/A" die is omitted entirely
        ])('formData %#', (formData, expected) => {
            render(<ClassDamageCard kind="melee" label="Melee Damage" formData={formData} isEditable={false} onChange={() => {}} onSetDieType={() => {}} />);
            expect(screen.getByText(expected)).toBeInTheDocument();
        });
    });
});
