jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockArrayUnion = jest.fn();
const mockArrayRemove = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    arrayUnion: (...args) => mockArrayUnion(...args),
    arrayRemove: (...args) => mockArrayRemove(...args),
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { SkillsAndFlaws } from '../../src/components/SkillsAndFlaws';

const skill = { name: 'Quick Reflexes', degree: 2, isSkill: true, description: 'Move first in combat.' };
const flaw = { name: 'Clumsy', degree: 1, isSkill: false, description: 'Trips over flat ground.' };
const feat = { actionName: 'Second Wind', category: 'feat', description: 'Heal **1d6**.' };
const nonFeatAction = { actionName: 'Stab', category: 'action' };

const characterPage = {
    character_id: 'char-1',
    canWrite: ['owner-1'],
    skills_and_flaws: [skill, flaw],
    actions: [feat, nonFeatAction],
};

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockUpdateDoc.mockResolvedValue(undefined);
    mockArrayUnion.mockImplementation((value) => ({ __arrayUnion: value }));
    mockArrayRemove.mockImplementation((value) => ({ __arrayRemove: value }));
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

describe('SkillsAndFlaws', () => {
    test('shows the skill/flaw/feat counts, pluralized', () => {
        render(<SkillsAndFlaws characterPage={characterPage} userId="owner-1" />);
        expect(screen.getByText('1 skill · 1 flaw · 1 feat')).toBeInTheDocument();
    });

    test('lists each skill, flaw, and feat by name', () => {
        render(<SkillsAndFlaws characterPage={characterPage} userId="owner-1" />);
        expect(screen.getByText('Quick Reflexes')).toBeInTheDocument();
        expect(screen.getByText('Clumsy')).toBeInTheDocument();
        expect(screen.getByText('Second Wind')).toBeInTheDocument();
        expect(screen.queryByText('Stab')).not.toBeInTheDocument();
    });

    test('shows one circle pip per point of degree', () => {
        render(<SkillsAndFlaws characterPage={characterPage} userId="owner-1" />);
        expect(screen.getAllByAltText('circle')).toHaveLength(3); // 2 for the skill, 1 for the flaw
    });

    test('shows "None recorded yet" for a group with nothing in it', () => {
        render(<SkillsAndFlaws characterPage={{ ...characterPage, skills_and_flaws: [flaw], actions: [] }} userId="owner-1" />);
        const emptyGroups = screen.getAllByText('None recorded yet');
        expect(emptyGroups).toHaveLength(2); // skills and feats, but not flaws
    });

    test('feats render their markdown description', () => {
        render(<SkillsAndFlaws characterPage={characterPage} userId="owner-1" />);
        const bold = screen.getByText('1d6');
        expect(bold.tagName).toBe('STRONG');
    });

    describe('without write permissions', () => {
        test('shows no Add/Remove toolbar', () => {
            render(<SkillsAndFlaws characterPage={characterPage} userId="stranger-1" />);
            expect(screen.queryByText('+ Add')).not.toBeInTheDocument();
            expect(screen.queryByText('Remove')).not.toBeInTheDocument();
        });
    });

    describe('with write permissions', () => {
        test('shows the Add/Remove toolbar', () => {
            render(<SkillsAndFlaws characterPage={characterPage} userId="owner-1" />);
            expect(screen.getByText('+ Add')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
        });

        describe('adding a skill/flaw', () => {
            test('+ Add opens a dialog; Cancel closes it and discards the draft', () => {
                render(<SkillsAndFlaws characterPage={characterPage} userId="owner-1" />);
                fireEvent.click(screen.getByText('+ Add'));
                expect(screen.getByText('Add Skill or Flaw')).toBeInTheDocument();
                fireEvent.change(screen.getByPlaceholderText('Skill/Flaw Name'), { target: { value: 'Brave' } });

                fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

                expect(screen.queryByText('Add Skill or Flaw')).not.toBeInTheDocument();
                fireEvent.click(screen.getByText('+ Add'));
                expect(screen.getByPlaceholderText('Skill/Flaw Name')).toHaveValue('');
            });

            test('submitting with missing fields alerts and does not write', () => {
                render(<SkillsAndFlaws characterPage={characterPage} userId="owner-1" />);
                fireEvent.click(screen.getByText('+ Add'));

                fireEvent.click(screen.getByRole('button', { name: 'Add' }));

                expect(window.alert).toHaveBeenCalledWith('Invalid Skill/Flaw');
                expect(mockUpdateDoc).not.toHaveBeenCalled();
            });

            test('a fully filled-out form writes the new skill/flaw and closes the dialog', async () => {
                render(<SkillsAndFlaws characterPage={characterPage} userId="owner-1" />);
                fireEvent.click(screen.getByText('+ Add'));

                fireEvent.change(screen.getByPlaceholderText('Skill/Flaw Name'), { target: { value: 'Brave' } });
                fireEvent.change(screen.getByPlaceholderText('Degree (1-3)'), { target: { value: '2' } });
                fireEvent.change(screen.getByPlaceholderText('Description'), { target: { value: 'Never backs down.' } });
                fireEvent.change(screen.getByDisplayValue(''), { target: { value: 'true' } }); // the hidden placeholder option's select

                fireEvent.click(screen.getByRole('button', { name: 'Add' }));

                await waitFor(() => expect(screen.queryByText('Add Skill or Flaw')).not.toBeInTheDocument());
                expect(mockUpdateDoc).toHaveBeenCalledWith(
                    { __doc: ['characters', 'char-1'] },
                    { skills_and_flaws: { __arrayUnion: { name: 'Brave', degree: 2, isSkill: true, description: 'Never backs down.' } } },
                );
            });

            test('a write error is alerted and the dialog stays open for retry', async () => {
                mockUpdateDoc.mockRejectedValue(new Error('offline'));
                render(<SkillsAndFlaws characterPage={characterPage} userId="owner-1" />);
                fireEvent.click(screen.getByText('+ Add'));
                fireEvent.change(screen.getByPlaceholderText('Skill/Flaw Name'), { target: { value: 'Brave' } });
                fireEvent.change(screen.getByPlaceholderText('Degree (1-3)'), { target: { value: '2' } });
                fireEvent.change(screen.getByPlaceholderText('Description'), { target: { value: 'Never backs down.' } });
                fireEvent.change(screen.getByDisplayValue(''), { target: { value: 'true' } });

                fireEvent.click(screen.getByRole('button', { name: 'Add' }));

                await waitFor(() => expect(window.alert).toHaveBeenCalled());
                expect(screen.getByText('Add Skill or Flaw')).toBeInTheDocument();
            });
        });

        describe('removing a skill/flaw', () => {
            test('Remove toggle reveals per-entry trash buttons and flips its own label to Done', () => {
                render(<SkillsAndFlaws characterPage={characterPage} userId="owner-1" />);

                fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

                expect(screen.getAllByAltText('remove')).toHaveLength(2);
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });

            test('clicking a trash icon opens a confirmation naming that entry', () => {
                render(<SkillsAndFlaws characterPage={characterPage} userId="owner-1" />);
                fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

                fireEvent.click(screen.getAllByRole('button', { name: 'remove' })[0]);

                expect(screen.getByText('Remove "Quick Reflexes"?')).toBeInTheDocument();
            });

            test('confirming removal writes arrayRemove for that entry and closes both dialogs', async () => {
                render(<SkillsAndFlaws characterPage={characterPage} userId="owner-1" />);
                fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
                fireEvent.click(screen.getAllByRole('button', { name: 'remove' })[0]);

                fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

                await waitFor(() => expect(screen.queryByText(/^Remove "/)).not.toBeInTheDocument());
                expect(mockUpdateDoc).toHaveBeenCalledWith(
                    { __doc: ['characters', 'char-1'] },
                    { skills_and_flaws: { __arrayRemove: skill } },
                );
                expect(screen.queryByAltText('remove')).not.toBeInTheDocument();
            });

            test('canceling the confirmation writes nothing and keeps remove-mode active', () => {
                render(<SkillsAndFlaws characterPage={characterPage} userId="owner-1" />);
                fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
                fireEvent.click(screen.getAllByRole('button', { name: 'remove' })[0]);

                fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

                expect(mockUpdateDoc).not.toHaveBeenCalled();
                expect(screen.getAllByAltText('remove')).toHaveLength(2);
            });
        });
    });
});
