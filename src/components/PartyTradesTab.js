import { useState } from 'react';
import { ItemLine } from './ItemLine';
import { holdingsOf } from '../utils/inventory';
import { cancelTrade, offerItems, setConfirmed, startTrade } from '../utils/partyTrades';
import { SIDES, isAgreed, otherSide, shortfalls, tidyItems } from '../utils/trades';
import '../styles/Party.scss';

function formatWhen(millis) {
    return millis ? new Date(millis).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
}

// One character's half of a trade: what they are putting in, whether they have
// agreed, and - for the player whose character it is - the means to change it.
function TradeSide({ trade, side, character, mine, campaignId, onError }) {
    const half = trade[side];
    const [chosen, setChosen] = useState('');
    const [amount, setAmount] = useState(1);
    const holdings = character ? holdingsOf(character) : [];
    const short = shortfalls(half.items, character || {});

    async function run(action) {
        onError('');
        try {
            await action();
        } catch (error) {
            onError(error.message);
        }
    }

    function addLine() {
        const held = holdings.find(candidate => candidate.item_id === chosen);
        if (!held) return;
        const quantity = Math.min(held.quantity, Math.max(1, Math.floor(Number(amount)) || 1));
        run(() => offerItems(campaignId, trade.id, half.character_id, tidyItems([...half.items, { item_id: held.item_id, title: held.title, quantity }])));
        setChosen('');
        setAmount(1);
    }

    const removeLine = itemId => run(() => offerItems(campaignId, trade.id, half.character_id, half.items.filter(line => line.item_id !== itemId)));

    return <div className={half.confirmed ? 'Trade-side Trade-side-confirmed' : 'Trade-side'} aria-label={`${half.character_name}'s side of the trade`} role="group">
        <div className="Trade-side-header">
            <span className="Trade-side-name">{half.character_name}</span>
            <span className={half.confirmed ? 'Trade-badge Trade-badge-confirmed' : 'Trade-badge'}>{half.confirmed ? 'Agreed' : 'Not agreed yet'}</span>
        </div>
        {half.items.length === 0 && <div className="Party-hint">Nothing offered.</div>}
        <ul className="Party-list">
            {half.items.map(line => <li key={line.item_id} className="Party-list-item">
                <ItemLine itemId={line.item_id} title={line.title} quantity={line.quantity}>
                    {mine && <button type="button" className="Party-button" aria-label={`Take ${line.title} out of the offer`} onClick={() => removeLine(line.item_id)}>Take back</button>}
                </ItemLine>
            </li>)}
        </ul>
        {short.length > 0 && <div className="Party-error" role="alert">{half.character_name} doesn't have enough {short.map(line => line.title).join(', ')}.</div>}
        {mine && <div className="Trade-offer">
            <select className="Party-input" aria-label="Item to offer" value={chosen} onChange={event => setChosen(event.target.value)}>
                <option value="">Add an item to the offer…</option>
                {holdings.map(held => <option key={held.item_id} value={held.item_id}>{held.title} (×{held.quantity})</option>)}
            </select>
            <input className="Party-input Party-input-narrow" type="number" min={1} aria-label="How many to offer" value={amount} onChange={event => setAmount(event.target.value)}/>
            <button type="button" className="Party-button" disabled={chosen === ''} onClick={addLine}>Add</button>
        </div>}
    </div>;
}

// Trades between the party's characters. A trade is a shared window: each side puts in
// what it will give and agrees; changing either side takes back both agreements; when
// both have agreed it is carried out at once. Everyone in the party can see every
// trade, but only a character's own player changes their side.
export function PartyTradesTab({ campaignId, party, characters, myCharacters, isDirector }) {
    const trades = Array.isArray(party.trades) ? party.trades : [];
    const log = Array.isArray(party.trade_log) ? party.trade_log : [];
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [message, setMessage] = useState('');

    const mineIds = new Set(myCharacters.map(character => character.character_id));
    const characterOf = id => characters.find(character => character.character_id === id);
    const starter = myCharacters.find(character => character.character_id === from) ?? myCharacters[0];
    const partners = characters.filter(character => character.character_id !== starter?.character_id);

    async function run(action) {
        setMessage('');
        try {
            await action();
        } catch (error) {
            setMessage(error.message);
        }
    }

    return <div className="PartyTrades">
        {message && <div className="Party-error" role="alert">{message}</div>}

        <section className="Party-section" aria-label="Start a trade">
            <div className="Party-section-header"><h2 className="Party-section-title">Start a trade</h2></div>
            {myCharacters.length === 0
                ? <div className="Party-hint">You need a character in this campaign to trade.</div>
                : <div className="Trade-start">
                    <label className="Party-acting"><span>Your character</span>
                        <select className="Party-input" aria-label="Your character" value={starter?.character_id || ''} onChange={event => setFrom(event.target.value)}>
                            {myCharacters.map(character => <option key={character.character_id} value={character.character_id}>{character.character_name}</option>)}
                        </select>
                    </label>
                    <label className="Party-acting"><span>Trade with</span>
                        <select className="Party-input" aria-label="Trade with" value={to} onChange={event => setTo(event.target.value)}>
                            <option value="">Pick a character…</option>
                            {partners.map(character => <option key={character.character_id} value={character.character_id}>{character.character_name}</option>)}
                        </select>
                    </label>
                    <button type="button" className="Party-button Party-button-primary" disabled={!starter || !to} onClick={() => run(async () => { await startTrade(campaignId, starter, characterOf(to)); setTo(''); })}>Start trade</button>
                </div>}
        </section>

        <section className="Party-section" aria-label="Open trades">
            <div className="Party-section-header"><h2 className="Party-section-title">Open trades</h2></div>
            {trades.length === 0 && <div className="Party-hint">No trades are open.</div>}
            {trades.map(trade => {
                // the sides that are the viewer's own characters (both, when they trade between two of theirs)
                const mySides = SIDES.filter(side => mineIds.has(trade[side].character_id));
                const both = mySides.length === 2;
                const agreed = isAgreed(trade);
                return <article className="Trade" key={trade.id} aria-label={`Trade between ${trade.a.character_name} and ${trade.b.character_name}`}>
                    <div className="Trade-sides">
                        {SIDES.map(side => <TradeSide key={side} trade={trade} side={side} character={characterOf(trade[side].character_id)} mine={mySides.includes(side)} campaignId={campaignId} onError={setMessage}/>)}
                    </div>
                    <div className="Trade-actions">
                        {mySides.map(side => {
                            const half = trade[side];
                            const label = half.confirmed
                                ? (both ? `Take back ${half.character_name}'s agreement` : 'Take back my agreement')
                                : (both ? `${half.character_name} agrees to this trade` : 'I agree to this trade');
                            return <button key={side} type="button" className="Party-button Party-button-primary" onClick={() => run(() => setConfirmed(campaignId, trade.id, half.character_id, !half.confirmed))}>{label}</button>;
                        })}
                        {(mySides.length > 0 || isDirector) && <button type="button" className="Party-button Party-button-danger" onClick={() => run(() => cancelTrade(campaignId, trade.id))}>Cancel trade</button>}
                        {mySides.length === 1 && !agreed && <span className="Party-hint">
                            {trade[otherSide(mySides[0])].confirmed ? `${trade[otherSide(mySides[0])].character_name} has agreed - it goes through when you do.` : 'It goes through when both of you have agreed.'}
                        </span>}
                    </div>
                </article>;
            })}
        </section>

        {log.length > 0 && <section className="Party-section" aria-label="Recent trades">
            <div className="Party-section-header"><h2 className="Party-section-title">Recent trades</h2></div>
            <ul className="Party-list">
                {[...log].reverse().map(entry => <li key={entry.id} className="Party-list-item Trade-log-entry">
                    <span>{entry.a.character_name} gave {entry.a.gave}; {entry.b.character_name} gave {entry.b.gave}.</span>
                    <span className="Party-hint">{formatWhen(entry.at)}</span>
                </li>)}
            </ul>
        </section>}
    </div>;
}
