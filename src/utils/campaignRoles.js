// Whether this user directs the campaign: its director, a co-director (canWrite) or one of
// its document admins. Anyone signed out is nobody's director.
export function isDirectorOf(campaign, userId) {
    if (!userId || !campaign) return false;
    return campaign.director_uid === userId
        || Boolean(campaign.canWrite?.includes(userId))
        || Boolean(campaign.admins?.includes(userId));
}
