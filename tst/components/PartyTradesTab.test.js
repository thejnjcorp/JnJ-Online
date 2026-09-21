const mockUseItem = jest.fn();
jest.mock('../../src/utils/useItems', () => ({ useItem: (...args) => mockUseItem(...args) }));
const mockOps = { startTrade: jest.fn(), offerItems: jest.fn(), setConfirmed: jest.fn(), cancelTrade: jest.fn() };
jest.mock('../../src/utils/partyTrades', () => ({
    startTrade: (...args) => mockOps.startTrade(...args),
    offerItems: (...args) => mockOps.offerItems(...args),
    setConfirmed: (...args) => mockOps.setConfirmed(...args),
    cancelTrade: (...args) => mockOps.cancelTrade(...args),
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { PartyTradesTab } from '../../src/components/PartyTradesTab';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const entry = (item_id, title, quantity) => ({ id: `e-${item_id}`, item_id, title, quantity, status: '1', index: 0 });
const aria = { character_id: 'aria', character_name: 'Aria', playerId: 'alice', inventory: [entry('torch', 'Torch', 3), entry('rope', 'Rope', 1)], inventory_pocket: [] };
const bram = { character_id: 'bram', character_name: 'Bram', playerId: 'bob', inventory: [entry('lamp', 'Lamp', 1)], inventory_pocket: [] };
const cleo = { character_id: 'cleo', character_name: 'Cleo', playerId: 'cara', inventory: [], inventory_pocket: [] };
const line = (item_id, title, quantity) => ({ item_id, title, quantity });
const trade = (extra = {}) => ({
    id: 't1', status: 'open', created_at: 1,
    a: { character_id: 'aria', character_name: 'Aria', uid: 'alice', items: [], confirmed: false },
    b: { character_id: 'bram', character_name: 'Bram', uid: 'bob', items: [], confirmed: false },
    ...extra,
});

const draw = (props = {}) => renderWithRouter(
    <PartyTradesTab campaignId="camp-1" party={{ trades: [] }} characters={[aria, bram, cleo]} myCharacters={[aria]} isDirector={false} {...props}/>
);
const side = name => within(screen.getByRole('group', { name: `${name}'s side of the trade` }));

beforeEach(() => {
    Object.values(mockOps).forEach(op => op.mockResolvedValue(undefined));
    mockUseItem.mockReturnValue({ item: null, status: 'missing' });
});

describe('PartyTradesTab', () => {
    describe('starting a trade', () => {
        test('offers the other characters in the campaign to trade with, not your own', () => {
            draw();
            const options = within(screen.getByLabelText('Trade with')).getAllByRole('option').map(option => option.textContent);
            expect(options).toEqual(['Pick a character…', 'Bram', 'Cleo']);
        });

        test('needs a partner before it can start', () => {
            draw();
            expect(screen.getByRole('button', { name: 'Start trade' })).toBeDisabled();
            fireEvent.change(screen.getByLabelText('Trade with'), { target: { value: 'bram' } });
            expect(screen.getByRole('button', { name: 'Start trade' })).toBeEnabled();
        });

        test('starts a trade between the two characters', async () => {
            draw();
            fireEvent.change(screen.getByLabelText('Trade with'), { target: { value: 'bram' } });
            fireEvent.click(screen.getByRole('button', { name: 'Start trade' }));
            expect(mockOps.startTrade).toHaveBeenCalledWith('camp-1', aria, bram);
            await waitFor(() => expect(screen.getByLabelText('Trade with')).toHaveValue(''));
        });

        test('a player with several characters chooses which is trading', () => {
            draw({ myCharacters: [aria, cleo] });
            fireEvent.change(screen.getByLabelText('Your character'), { target: { value: 'cleo' } });
            expect(within(screen.getByLabelText('Trade with')).getAllByRole('option').map(option => option.textContent)).toEqual(['Pick a character…', 'Aria', 'Bram']);
            fireEvent.change(screen.getByLabelText('Trade with'), { target: { value: 'bram' } });
            fireEvent.click(screen.getByRole('button', { name: 'Start trade' }));
            expect(mockOps.startTrade).toHaveBeenCalledWith('camp-1', cleo, bram);
        });

        test('someone with no character is told they need one', () => {
            draw({ myCharacters: [] });
            expect(screen.getByText('You need a character in this campaign to trade.')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Start trade' })).not.toBeInTheDocument();
        });

        test('a refusal - already in a trade - is shown', async () => {
            mockOps.startTrade.mockRejectedValue(new Error('Bram is already in a trade.'));
            draw();
            fireEvent.change(screen.getByLabelText('Trade with'), { target: { value: 'bram' } });
            fireEvent.click(screen.getByRole('button', { name: 'Start trade' }));
            expect(await screen.findByRole('alert')).toHaveTextContent('Bram is already in a trade.');
        });
    });

    describe('open trades', () => {
        test('says when there are none', () => {
            draw();
            expect(screen.getByText('No trades are open.')).toBeInTheDocument();
        });

        test('shows both sides of a trade, everything each is offering, and whether each has agreed', () => {
            draw({ party: { trades: [trade({ a: { ...trade().a, items: [line('torch', 'Torch', 2)], confirmed: true }, b: { ...trade().b, items: [line('lamp', 'Lamp', 1)] } })] } });
            expect(side('Aria').getByText('Agreed')).toBeInTheDocument();
            expect(side('Aria').getByRole('button', { name: /^Torch/ })).toHaveTextContent('×2');
            expect(side('Bram').getByText('Not agreed yet')).toBeInTheDocument();
            expect(side('Bram').getByRole('button', { name: /^Lamp/ })).toBeInTheDocument();
        });

        test('says when a side is offering nothing', () => {
            draw({ party: { trades: [trade()] } });
            expect(screen.getAllByText('Nothing offered.')).toHaveLength(2);
        });

        test('everyone sees every trade, but can only change their own side', () => {
            draw({ party: { trades: [trade()] }, myCharacters: [cleo] });
            expect(screen.getByRole('article')).toBeInTheDocument();
            expect(screen.queryByLabelText('Item to offer')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /I agree/ })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Cancel trade' })).not.toBeInTheDocument();
        });

        test('a director can cancel a trade they are not in', () => {
            draw({ party: { trades: [trade()] }, myCharacters: [], isDirector: true });
            fireEvent.click(screen.getByRole('button', { name: 'Cancel trade' }));
            expect(mockOps.cancelTrade).toHaveBeenCalledWith('camp-1', 't1');
            expect(screen.queryByRole('button', { name: /I agree/ })).not.toBeInTheDocument();
        });
    });

    describe('offering', () => {
        const open = () => draw({ party: { trades: [trade()] } });

        test('a player offers from what their character is carrying, only their own side', () => {
            open();
            const mine = side('Aria');
            expect(within(mine.getByLabelText('Item to offer')).getAllByRole('option').map(option => option.textContent)).toEqual(['Add an item to the offer…', 'Torch (×3)', 'Rope (×1)']);
            expect(side('Bram').queryByLabelText('Item to offer')).not.toBeInTheDocument();
        });

        test('adds an item and a quantity to the offer', () => {
            open();
            const mine = side('Aria');
            fireEvent.change(mine.getByLabelText('Item to offer'), { target: { value: 'torch' } });
            fireEvent.change(mine.getByLabelText('How many to offer'), { target: { value: '2' } });
            fireEvent.click(mine.getByRole('button', { name: 'Add' }));
            expect(mockOps.offerItems).toHaveBeenCalledWith('camp-1', 't1', 'aria', [line('torch', 'Torch', 2)]);
        });

        test('cannot offer more than they have, or less than one', () => {
            open();
            const mine = side('Aria');
            fireEvent.change(mine.getByLabelText('Item to offer'), { target: { value: 'torch' } });
            fireEvent.change(mine.getByLabelText('How many to offer'), { target: { value: '99' } });
            fireEvent.click(mine.getByRole('button', { name: 'Add' }));
            expect(mockOps.offerItems).toHaveBeenLastCalledWith('camp-1', 't1', 'aria', [line('torch', 'Torch', 3)]);
        });

        test('adding is off until an item is chosen', () => {
            open();
            expect(side('Aria').getByRole('button', { name: 'Add' })).toBeDisabled();
        });

        test('adds to what is already offered, and the same item again is added up', () => {
            draw({ party: { trades: [trade({ a: { ...trade().a, items: [line('rope', 'Rope', 1)] } })] } });
            const mine = side('Aria');
            fireEvent.change(mine.getByLabelText('Item to offer'), { target: { value: 'torch' } });
            fireEvent.click(mine.getByRole('button', { name: 'Add' }));
            expect(mockOps.offerItems).toHaveBeenCalledWith('camp-1', 't1', 'aria', [line('rope', 'Rope', 1), line('torch', 'Torch', 1)]);
        });

        test('takes an item back out of the offer', () => {
            draw({ party: { trades: [trade({ a: { ...trade().a, items: [line('rope', 'Rope', 1), line('torch', 'Torch', 2)] } })] } });
            fireEvent.click(side('Aria').getByRole('button', { name: 'Take Rope out of the offer' }));
            expect(mockOps.offerItems).toHaveBeenCalledWith('camp-1', 't1', 'aria', [line('torch', 'Torch', 2)]);
        });

        test('says when a side offers more than it has, so the other player is not caught out', () => {
            draw({ party: { trades: [trade({ a: { ...trade().a, items: [line('torch', 'Torch', 9)] } })] } });
            expect(side('Aria').getByRole('alert')).toHaveTextContent("Aria doesn't have enough Torch.");
        });
    });

    describe('agreeing and cancelling', () => {
        test('a player agrees to the trade', () => {
            draw({ party: { trades: [trade()] } });
            fireEvent.click(screen.getByRole('button', { name: 'I agree to this trade' }));
            expect(mockOps.setConfirmed).toHaveBeenCalledWith('camp-1', 't1', 'aria', true);
        });

        test('and can take their agreement back', () => {
            draw({ party: { trades: [trade({ a: { ...trade().a, confirmed: true } })] } });
            fireEvent.click(screen.getByRole('button', { name: 'Take back my agreement' }));
            expect(mockOps.setConfirmed).toHaveBeenCalledWith('camp-1', 't1', 'aria', false);
        });

        test('says it goes through when both have agreed, and who has agreed already', () => {
            const { unmount } = draw({ party: { trades: [trade()] } });
            expect(screen.getByText('It goes through when both of you have agreed.')).toBeInTheDocument();
            unmount();
            draw({ party: { trades: [trade({ b: { ...trade().b, confirmed: true } })] } });
            expect(screen.getByText('Bram has agreed - it goes through when you do.')).toBeInTheDocument();
        });

        test('a player in the trade can cancel it', () => {
            draw({ party: { trades: [trade()] } });
            fireEvent.click(screen.getByRole('button', { name: 'Cancel trade' }));
            expect(mockOps.cancelTrade).toHaveBeenCalledWith('camp-1', 't1');
        });

        test('a trade that will not go through says why', async () => {
            mockOps.setConfirmed.mockRejectedValue(new Error('Bram has no room to carry Torch.'));
            draw({ party: { trades: [trade()] } });
            fireEvent.click(screen.getByRole('button', { name: 'I agree to this trade' }));
            expect(await screen.findByRole('alert')).toHaveTextContent('Bram has no room to carry Torch.');
        });
    });

    describe('a player trading between two of their own characters', () => {
        const both = () => draw({ party: { trades: [trade()] }, myCharacters: [aria, bram] });

        test('can change and agree for both sides, each named', () => {
            both();
            expect(side('Aria').getByLabelText('Item to offer')).toBeInTheDocument();
            expect(side('Bram').getByLabelText('Item to offer')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Bram agrees to this trade' }));
            expect(mockOps.setConfirmed).toHaveBeenCalledWith('camp-1', 't1', 'bram', true);
            fireEvent.click(screen.getByRole('button', { name: 'Aria agrees to this trade' }));
            expect(mockOps.setConfirmed).toHaveBeenCalledWith('camp-1', 't1', 'aria', true);
        });

        test('a side that has agreed can be taken back, by name', () => {
            draw({ party: { trades: [trade({ b: { ...trade().b, confirmed: true } })] }, myCharacters: [aria, bram] });
            fireEvent.click(screen.getByRole('button', { name: "Take back Bram's agreement" }));
            expect(mockOps.setConfirmed).toHaveBeenCalledWith('camp-1', 't1', 'bram', false);
        });

        test('there is one Cancel, and no "waiting for the other player" hint, since there is no other player', () => {
            both();
            expect(screen.getAllByRole('button', { name: 'Cancel trade' })).toHaveLength(1);
            expect(screen.queryByText(/goes through when/)).not.toBeInTheDocument();
        });
    });

    describe('recent trades', () => {
        test('are listed, newest first, with who gave what', () => {
            draw({ party: { trades: [], trade_log: [
                { id: 'l1', at: 1000, a: { character_name: 'Aria', gave: '2 Torch' }, b: { character_name: 'Bram', gave: 'nothing' } },
                { id: 'l2', at: 2000, a: { character_name: 'Cleo', gave: 'Rope' }, b: { character_name: 'Bram', gave: 'Lamp' } },
            ] } });
            const entries = within(screen.getByRole('region', { name: 'Recent trades' })).getAllByRole('listitem');
            expect(entries[0]).toHaveTextContent('Cleo gave Rope; Bram gave Lamp.');
            expect(entries[1]).toHaveTextContent('Aria gave 2 Torch; Bram gave nothing.');
        });

        test('there is no section when nothing has been traded', () => {
            draw();
            expect(screen.queryByRole('region', { name: 'Recent trades' })).not.toBeInTheDocument();
        });
    });
});
