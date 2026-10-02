import { listVersions, publishVersion, resolveVersion } from './versionedDocs';

// Race-flavored entry points onto the shared versioning in versionedDocs.js.
// races/{id} is always the current version; older ones are immutable
// snapshots in races/{id}/versions/{n}.

export { versionOf, docContent as raceContent } from './versionedDocs';

export const resolveRaceVersion = (raceId, version) => resolveVersion('races', raceId, version);
export const listRaceVersions = (raceId) => listVersions('races', raceId);
export const publishRaceVersion = (raceId, nextData, notes, expectedVersion) => publishVersion('races', raceId, nextData, notes, expectedVersion);
