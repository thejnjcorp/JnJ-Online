import { isDirectorOf } from '../../src/utils/campaignRoles';

describe('isDirectorOf', () => {
    const campaign = { director_uid: 'dir', canWrite: ['co'], admins: ['admin'] };

    test('the director, a co-director and a document admin direct the campaign', () => {
        expect(isDirectorOf(campaign, 'dir')).toBe(true);
        expect(isDirectorOf(campaign, 'co')).toBe(true);
        expect(isDirectorOf(campaign, 'admin')).toBe(true);
    });

    test('a player or a stranger does not', () => {
        expect(isDirectorOf({ ...campaign, canRead: ['player'] }, 'player')).toBe(false);
        expect(isDirectorOf(campaign, 'stranger')).toBe(false);
    });

    test('nobody signed out does, even for a campaign with no director yet', () => {
        expect(isDirectorOf(campaign, '')).toBe(false);
        expect(isDirectorOf(campaign, undefined)).toBe(false);
        expect(isDirectorOf({}, undefined)).toBe(false);
    });

    test('a campaign that has not loaded has no directors', () => {
        expect(isDirectorOf(undefined, 'dir')).toBe(false);
        expect(isDirectorOf({}, 'dir')).toBe(false);
    });
});
