import { useMemo } from 'react';
import { useParty } from './useParty';
import { engagementOf } from './engagements';

// Who a character is engaged with right now (see engagementOf in engagements.js), or null: read
// from the combat tracker on the character's campaign. `entities` are the campaign's combatants,
// whose names are preferred to the tracker's copies.
export function useEngagement(characterPage, entities) {
    const { party } = useParty(characterPage.campaign || '');
    return useMemo(
        () => engagementOf(party.combat_tracker, `character:${characterPage.character_id}`, Object.fromEntries(entities.map(entity => [entity.id, entity.title]))),
        [party.combat_tracker, characterPage.character_id, entities]
    );
}
