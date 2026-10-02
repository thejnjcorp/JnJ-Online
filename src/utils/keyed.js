// Pairs each item of a list that has no id of its own (the cells of a table row, the
// rows of a form the user edits in place, the blocks of a document) with its position
// and a key for React. The key is made here, away from the JSX, because these lists are
// only ever edited in place - never reordered under the user - so position is the only
// identity such an item has.
export const keyed = (items, prefix = 'item') => items.map((item, index) => ({ item, index, key: `${prefix}-${index}` }));
