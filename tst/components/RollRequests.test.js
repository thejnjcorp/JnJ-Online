let mockParty;
jest.mock('../../src/utils/useParty', () => ({ useParty: () => ({ party: mockParty, loaded: true }) }));
const mockClear = jest.fn();
jest.mock('../../src/utils/party', () => ({ clearRollRequest: (...args) => mockClear(...args) }));

// eslint-disable-next-line import/first
import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { RollRequests } from '../../src/components/RollRequests';

beforeEach(() => {
    mockClear.mockReset().mockResolvedValue(undefined);
    mockParty = { roll_requests: [
        { id: 'r1', characterId: 'c1', skill: 'Dexterity', askedAt: 1 },
        { id: 'r2', characterId: 'c2', skill: 'Strength', askedAt: 2 },
        { id: 'r3', characterId: 'c1', skill: 'Attention to detail', askedAt: 3 },
    ] };
});

describe('RollRequests', () => {
    test('shows what the director asked this character to roll, and nothing meant for someone else', () => {
        render(<RollRequests campaignId="camp-1" characterId="c1" canClear/>);
        expect(screen.getByText('The director asks you to roll Dexterity.')).toBeInTheDocument();
        expect(screen.getByText('The director asks you to roll Attention to detail.')).toBeInTheDocument();
        expect(screen.queryByText(/Strength/)).not.toBeInTheDocument();
    });

    test('Done clears that request', () => {
        render(<RollRequests campaignId="camp-1" characterId="c1" canClear/>);
        fireEvent.click(screen.getAllByRole('button', { name: 'Done' })[0]);
        expect(mockClear).toHaveBeenCalledWith('camp-1', 'r1');
    });

    test('someone only looking at the character cannot clear them', () => {
        render(<RollRequests campaignId="camp-1" characterId="c1" canClear={false}/>);
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });

    test('is not there when there is nothing asked, or the party has none yet', () => {
        mockParty = {};
        const { container } = render(<RollRequests campaignId="camp-1" characterId="c1" canClear/>);
        expect(container).toBeEmptyDOMElement();
    });
});
