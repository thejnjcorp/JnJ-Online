import { createContext, useContext, useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { ItemDetails, ItemThumb, itemName } from "../../components/ItemLine";
import { useItem } from "../useItems";
import { isItemEntry, quantityOf, MAX_QUANTITY } from "../inventory";
import { putInParty, removeCharacterEntry, setCharacterQuantity } from "../partyInventory";
import type { Post } from "./Post.ts";
import { ReactComponent as ChevronDownIcon } from "../../icons/chevron_down.svg";
import "../../styles/Party.scss";

// What an inventory card needs to know about whose inventory it is in: the character,
// whether the viewer may change it, and the campaign (for putting something in the
// party inventory) and the viewer.
export type InventoryContextValue = { characterId: string; canEdit: boolean; campaignId?: string; userId?: string };
export const InventoryContext = createContext<InventoryContextValue>({ characterId: "", canEdit: false });

type EntryPost = Post & { item_id?: string; quantity?: number };

// One entry of a character's inventory, in its slot: the item's picture, name and how
// many, dragged from slot to slot. Bar its small details button in the corner, the
// whole card is the drag handle - a card used to be one big button that opened its
// details in place, which left only its thin outer padding free to actually grab and
// drag. The details button opens the item's description and - for someone who may
// change the inventory - the controls (more or fewer, put some in the party inventory,
// or remove it) as a popup instead of inline: inline pushed the rest of the slot grid
// around every time one was open, which didn't fit a small fixed-size slot well. An
// entry from before items existed shows the text it was typed with, and can only be
// removed.
export const InventoryCard = ({ post, index, titleClassName, boxClassName }: { post: Post; index: number; titleClassName: string; contentClassName?: string; boxClassName: string; extraClassNames?: string[]; readOnly?: boolean }) => {
    const { characterId, canEdit, campaignId, userId } = useContext(InventoryContext);
    const entry = post as EntryPost;
    const state = useItem(entry.item_id || "");
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState(1);
    const [message, setMessage] = useState("");
    const quantity = quantityOf(entry);
    const name = itemName(state, entry.title);
    const real = isItemEntry(entry);

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
                        <div className={snapshot.isDragging ? `${boxClassName} isDragging` : boxClassName}>
                            <div className={`${titleClassName} InventoryCard-title`}>
                                <ItemThumb item={state.item} className="InventoryCard-thumb"/>
                                <span className="InventoryCard-name">{name}</span>
                                {quantity > 1 && <span className="ItemLine-quantity" aria-label={`quantity ${quantity}`}>×{quantity}</span>}
                                <button type="button" className="InventoryCard-details-button" aria-label={`${name} details`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(o => !o)}>
                                    <ChevronDownIcon/>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Draggable>
            {open && <>
                <button type="button" className="InventoryCard-popup-scrim" aria-label="Close" onClick={() => setOpen(false)}/>
                <div className="InventoryCard-popup" role="dialog" aria-label={`${name} details`}>
                    <div className="InventoryCard-popup-header">
                        <span className="InventoryCard-popup-title">{name}</span>
                        <button type="button" className="InventoryCard-popup-close" aria-label="Close details" onClick={() => setOpen(false)}>×</button>
                    </div>
                    <ItemDetails state={state} content={(post as Post).content} legacy={!real}/>
                    {canEdit && <div className="InventoryCard-controls">
                        {real && <div className="InventoryCard-quantity" role="group" aria-label="Quantity">
                            <button type="button" className="Party-button" aria-label="One fewer" onClick={() => run(() => setCharacterQuantity(characterId, entry.id as string, quantity - 1))}>−</button>
                            <span>{quantity}</span>
                            <button type="button" className="Party-button" aria-label="One more" disabled={quantity >= MAX_QUANTITY} onClick={() => run(() => setCharacterQuantity(characterId, entry.id as string, quantity + 1))}>+</button>
                        </div>}
                        {real && campaignId && <div className="InventoryCard-party">
                            <input className="Party-input Party-input-narrow" type="number" min={1} max={quantity} aria-label="How many to put in the party inventory" value={amount} onChange={(event) => setAmount(Number(event.target.value))}/>
                            <button type="button" className="Party-button" onClick={() => run(() => putInParty({ campaignId, characterId, itemId: entry.item_id, title: name, quantity: putAmount, userId }))}>Put in party inventory</button>
                        </div>}
                        <button type="button" className="Party-button Party-button-danger" onClick={() => run(() => removeCharacterEntry(characterId, entry.id as string))}>Remove</button>
                    </div>}
                    {message && <div className="Party-error" role="alert">{message}</div>}
                </div>
            </>}
        </div>
    );
};
