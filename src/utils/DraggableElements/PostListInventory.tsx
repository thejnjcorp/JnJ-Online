import { useState, useEffect, useMemo } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Post, PostListContentAbstract } from "./Post.ts";
import { Draggable } from "@hello-pangea/dnd";
import '../../styles/PostCardInventoryDefaults.scss';
import doubleArrowIcon from '../../icons/double_arrow.svg';

export function PostListContentInventory({ inputStatuses, characterId, className={}, campaignCharacterList }) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    const docQuery = useMemo(() => doc(db, "characters", characterId), [characterId]);

    useEffect(() => {
        const unsubscribe = onSnapshot(docQuery, (docSnap) => {
            if (docSnap.metadata.hasPendingWrites || loading) {
                setPosts((docSnap.data()?.inventory as unknown as Post[]) ?? []);
                setLoading(false);
            }
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [docQuery]);

    const useCombatTrackerPosts = () => {
        return { posts, loading };
    }

    const updateCombatTrackerPosts = (updatedPosts: Post[]) => {
        updateDoc(docQuery, {
            inventory: updatedPosts
        });
    }

    const PostCardInventory = ({ post, index, titleClassName, contentClassName, boxClassName, extraClassNames }: 
    { post: Post; index: number, titleClassName: string, contentClassName: string, boxClassName: string, extraClassNames: string[] }) => {
        const [isMenuVisible, setIsMenuVisible] = useState(false);
        const [isContentVisible, setIsContentVisible] = useState(false);
        const [isSendMenuVisible, setIsSendMenuVisible] = useState(false);
        const [isTradingMenuVisible, setIsTradingMenuVisible] = useState(false);

        const characterData = campaignCharacterList.find(character => character.character_id === characterId);
        const hasTradePartner = characterData?.trading_metadata?.trade_partner_id !== null;
        const tradePartnerData = campaignCharacterList.find(character => character.character_id === characterData?.trading_metadata?.trade_partner_id);
        const bothTradeConfirmed = characterData?.trading_metadata?.trade_confirmed && tradePartnerData?.trading_metadata?.trade_confirmed;
        const tradeAcked = characterData?.trading_metadata?.trade_confirmed_ack;
        const bothTradeAcked = tradeAcked && tradePartnerData?.trading_metadata?.trade_confirmed_ack;

        useEffect(() => {
            if (bothTradeConfirmed && tradePartnerData?.trading_metadata?.trade_partner_id === characterId && !tradeAcked) {
                updateDoc(docQuery, {
                    trading_metadata: {
                        ...characterData?.trading_metadata,
                        trade_confirmed_ack: true
                    }
                });
            } else if (bothTradeConfirmed && bothTradeAcked && characterData?.trading_metadata?.trade_partner_id === tradePartnerData?.character_id) {
                // start the trade process
                updateDoc(docQuery, {
                    // update the inventory or any other necessary fields
                    trading_metadata: {
                        trade_partner_id: null,
                        trade_confirmed: false,
                        trade_confirmed_ack: false,
                    }
                });
            }
        }, [bothTradeConfirmed, characterData, tradePartnerData, tradeAcked, bothTradeAcked]);

        let tradePartnerWindowColor = "";
        if (hasTradePartner) tradePartnerWindowColor = tradePartnerData?.trading_metadata?.trade_confirmed ? "#07840bff" : "#880a01ff";

        return (
            <div onMouseLeave={() => {
                setIsMenuVisible(false); 
                setIsSendMenuVisible(false);
            }} style={{ position: "relative" }}>
                <Draggable draggableId={String(post.id)} index={index}>
                {(provided, snapshot) => (
                    <div
                        style={{ marginBottom: "1px" }}
                        {...provided.dragHandleProps}
                        {...provided.draggableProps}
                        ref={provided.innerRef}
                        onContextMenu={(e: React.MouseEvent) => {
                            e.preventDefault();
                            setIsMenuVisible(true);
                        }}
                        onClick={() => setIsContentVisible(true)}
                    >
                        <div className={snapshot.isDragging ? `${boxClassName} isDragging` : boxClassName}>
                            <div className={titleClassName}>
                                {post.title}
                            </div>
                        </div>
                    </div>
                )}
                </Draggable>
                {isContentVisible && <div className={contentClassName}>
                    {post.content}
                </div>}
                {isMenuVisible && <div className={extraClassNames.at(0) || "PostCardMenu-default"}>
                    <button type="button" className={extraClassNames.at(1) || "PostCardMenuButton-default"} onClick={() => {

                    }}>
                        Drop
                    </button>
                    <button type="button" className={extraClassNames.at(1) || "PostCardMenuButton-default"} onClick={() => {
                        setIsSendMenuVisible(true);
                    }}>
                        Send To
                    </button>
                    <button type="button" className={extraClassNames.at(1) || "PostCardMenuButton-default"} onClick={() => {
                        setIsTradingMenuVisible(true);
                    }}>
                        Trade
                    </button>
                </div>}
                {isSendMenuVisible && <div className={extraClassNames.at(2) || "PostCardSendMenu-default"}>
                    {campaignCharacterList// .filter((character) => character.character_id !== characterId)
                        .map((character, index) => 
                    <button type="button" key={"inventory-send-button-" + index} className={extraClassNames.at(1) || "PostCardMenuButton-default"}>
                        {character.character_name}
                    </button>)}
                </div>}
                {(isTradingMenuVisible || hasTradePartner) && 
                <div className={extraClassNames.at(3) || "PostCardTradeMenu-default"}>
                    <div className="PostCardTradeMenuHeader">
                        Trade with:{' '}
                        <select className="PostCardTradeMenuSelect" onChange={(e) => {
                            const selectedCharacterId = e.target.value;
                            updateDoc(docQuery, {
                                trading_metadata: {
                                    ...characterData?.trading_metadata,
                                    trade_partner_id: selectedCharacterId || null,
                                    trade_confirmed: false,
                                    trade_confirmed_ack: false,
                                }
                            });
                        }}
                        defaultValue={characterData?.trading_metadata?.trade_partner_id || ""}>
                            <option value="" hidden>Select a character</option>
                            {campaignCharacterList.map((character, index) => 
                                <option key={"trade-select-option-" + index} value={character.character_id}>
                                    {character.character_name}
                                </option>
                            )}
                        </select>
                        <button type="button" className="PostCardTradeMenuCloseButton" onClick={() => {
                            setIsTradingMenuVisible(false);
                            updateDoc(docQuery, {
                                trading_metadata: {
                                    trade_partner_id: null,
                                    trade_confirmed: false,
                                    trade_confirmed_ack: false,
                                }
                            });
                        }}>
                            X
                        </button>
                    </div>
                    <div className="PostCardTradeMenuContent">
                            <div className="PostCardTradeWindow" style={{ backgroundColor: characterData?.trading_metadata?.trade_confirmed ? "#07840bff" : "#880a01ff" }}>

                            </div>
                            <div className="PostCardTradeActions">
                                <img src={doubleArrowIcon} className="PostCardTradeDoubleArrow" alt="double_arrow.svg"/>
                                <button type="button" className="PostCardTradeConfirmButton" onClick={() => {
                                    if (hasTradePartner) {
                                        updateDoc(docQuery, {
                                            trading_metadata: {
                                                ...characterData?.trading_metadata,
                                                trade_confirmed: true,
                                            }
                                        })
                                    }
                                }}>
                                    Confirm Trade
                                </button>
                                <button type="button" className="PostCardTradeCancelButton" onClick={() => {
                                    if (hasTradePartner) {
                                        updateDoc(docQuery, {
                                            trading_metadata: {
                                                ...characterData?.trading_metadata,
                                                trade_confirmed: false,
                                            }
                                        })
                                    }
                                }}>
                                    Cancel Trade
                                </button>
                            </div>
                            <div className="PostCardTradeWindow" style={{ backgroundColor: tradePartnerWindowColor }}>

                            </div>
                    </div>
                </div>}
            </div>
        );
    };

    return <PostListContentAbstract
        inputStatuses={inputStatuses}
        usePosts={useCombatTrackerPosts}
        updatePosts={updateCombatTrackerPosts}
        grid={true}
        swappableMode={true}
        className={className}
        PostCardComponent={PostCardInventory}
    />
}