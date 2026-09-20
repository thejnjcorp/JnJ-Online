// An archived campaign (see CampaignPage.js's Danger Zone) is out of the way: off
// the lists and pickers that are for what is being played now. It is still
// listed - under "Show Archived" - on the campaigns page, where it can be restored.
// Campaigns from before archiving existed have no `archived` field, so this is
// filtered on the client rather than with a Firestore `where`, which would leave
// those out. A campaign scheduled for deletion is always archived (that is the only
// way to schedule it), so it is out of the way too.
export const isCampaignArchived = campaign => Boolean(campaign?.archived);

export const withoutArchivedCampaigns = campaigns => campaigns.filter(campaign => !isCampaignArchived(campaign));
