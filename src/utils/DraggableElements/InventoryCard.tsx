import { createContext, useContext, useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { ItemDetails, ItemThumb, itemName } from "../../components/ItemLine";
import { useItem } from "../useItems";
import { quantityOf, MAX_QUANTITY } from "../inventory";
import { putInParty, removeCharacterEntry, setCharacterQuantity } from "../partyInventory";
import type { Post } from "./Post.ts";
import "../../styles/Party.scss";

// What an inventory card needs to know about whose inventory it is in: the character,
// whether the viewer may change it, and the campaign (for putting something in the
// party inventory) and the viewer.
export type InventoryContextValue = { characterId: string; canEdit: boolean; campaignId?: string; userId?: string };
export const InventoryContext = createContext<InventoryContextValue>({ characterId: "", canEdit: false });

type EntryPost = Post & { item_id?: string; quantity?: number };

// One entry of a character's inventory, in its slot: the item's picture, name and how
// many, dragged from slot to slot. Pressing it (a real click, not a drag) opens the
// item's details and - for someone who may change the inventory - the controls (more
// or fewer, put some in the party inventory, or remove it) as a popup, not inline:
// inline pushed the rest of the slot grid around every time one was open, which didn't
// fit a small fixed-size slot well. The card itself is a plain div (role="button"), not
// a <button> - @hello-pangea/dnd refuses to start a drag from a native interactive
// element (input/button/textarea/select/...; see isAnInteractiveElement in its source)
// to preserve that element's own click behavior, which is exactly why a card used to
// be so hard to drag: it was one giant <button>, so only its thin outer padding (not
// covered by that button) was ever draggable. A plain div isn't on that list, so the
// library's own mousedown-then-movement-threshold still tells a real drag apart from a
// click perfectly well here - dragging still works from anywhere on the card, clicking
// (without dragging) opens the popup.
export const InventoryCard = ({ post, index, titleClassName, boxClassName }: { post: Post; index: number; titleClassName: string; contentClassName?: string; boxClassName: string; extraClassNames?: string[]; readOnly?: boolean }) => {
    const { characterId, canEdit, campaignId, userId } = useContext(InventoryContext);
    const entry = post as EntryPost;
    const state = useItem(entry.item_id || "");
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState(1);
    const [message, setMessage] = useState("");
    const quantity = quantityOf(entry);
    const name = itemName(state, entry.title);

    async function run(action: () => Promise<unknown>) {
        setMessage("");
        try {
            await action();
        } catch (error) {
            setMessage((error as Error).message);
        }
    }

    const putAmount = Math.min(quantity, Math.max(1, Math.floor(Number(amount)) || 1));

    return (
        <div style={{ position: "relative" }}>
            <Draggable draggableId={String(post.id)} index={index}>
                {(provided, snapshot) => (
                    <div style={{ marginBottom: "1px" }} {...provided.dragHandleProps} {...provided.draggableProps} ref={provided.innerRef}>
                        <div
                            className={[boxClassName, snapshot.isDragging && 'isDragging', 'InventoryCard-clickable'].filter(Boolean).join(' ')}
                            role="button"
                            tabIndex={0}
                            aria-label={`${name} details`}
                            aria-haspopup="dialog"
                            aria-expanded={open}
                            onClick={() => setOpen(o => !o)}
                            onKeyDown={event => { if (event.key === "Enter") { event.stopPropagation(); setOpen(o => !o); } }}
                        >
                            <div className={`${titleClassName} InventoryCard-title`}>
                                <ItemThumb item={state.item} className="InventoryCard-thumb"/>
                                <span className="InventoryCard-name">{name}</span>
                                {quantity > 1 && <span className="ItemLine-quantity" aria-label={`quantity ${quantity}`}>×{quantity}</span>}
                            </div>
                        </div>
                    </div>
                )}
            </Draggable>
            {open && <>
                <button type="button" className="InventoryCard-popup-scrim" aria-label="Close" onClick={() => setOpen(false)}/>
                <dialog open className="InventoryCard-popup" aria-label={`${name} details`}>
                    <div className="InventoryCard-popup-header">
                        <span className="InventoryCard-popup-title">{name}</span>
                        <button type="button" className="InventoryCard-popup-close" aria-label="Close details" onClick={() => setOpen(false)}>×</button>
                    </div>
                    <ItemDetails state={state}/>
                    {canEdit && <div className="InventoryCard-controls">
                        <fieldset className="InventoryCard-quantity" aria-label="Quantity">
                            <button type="button" className="Party-button" aria-label="One fewer" onClick={() => run(() => setCharacterQuantity(characterId, entry.id as string, quantity - 1))}>−</button>
                            <span>{quantity}</span>
                            <button type="button" className="Party-button" aria-label="One more" disabled={quantity >= MAX_QUANTITY} onClick={() => run(() => setCharacterQuantity(characterId, entry.id as string, quantity + 1))}>+</button>
                        </fieldset>
                        {campaignId && <div className="InventoryCard-party">
                            <input className="Party-input Party-input-narrow" type="number" min={1} max={quantity} aria-label="How many to put in the party inventory" value={amount} onChange={(event) => setAmount(Number(event.target.value))}/>
                            <button type="button" className="Party-button" onClick={() => run(() => putInParty({ campaignId, characterId, itemId: entry.item_id, title: name, quantity: putAmount, userId }))}>Put in party inventory</button>
                        </div>}
                        <button type="button" className="Party-button Party-button-danger" onClick={() => run(() => removeCharacterEntry(characterId, entry.id as string))}>Remove</button>
                    </div>}
                    {message && <div className="Party-error" role="alert">{message}</div>}
                </dialog>
            </>}
        </div>
    );
};
