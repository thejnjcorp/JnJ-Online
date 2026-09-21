// A character doc keeps only the id of its campaign, not its name (see
// NewCharacterPage.js), so a card that wants to say which campaign a character is
// in looks the name up among the campaigns already loaded. Built from every campaign
// loaded - archived ones too, since a character in an archived campaign is still in it.
export const campaignNameMap = campaigns => Object.fromEntries(campaigns.map(campaign => [campaign.id, campaign.campaign_name]));

// " · The Iron Vale", to follow a character's class on its card - or nothing when it
// is in no campaign or its campaign is not one the viewer can see: never the raw id,
// which means nothing to anyone.
export const campaignSuffix = (names, campaignId) => (campaignId && names[campaignId] ? ` · ${names[campaignId]}` : '');
