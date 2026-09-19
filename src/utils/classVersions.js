import { docContent, listVersions, publishVersion, resolveVersion, versionOf } from './versionedDocs';

// Class-flavored entry points onto the shared versioning in versionedDocs.js.
// classes/{id} is always the current version; older ones are immutable
// snapshots in classes/{id}/versions/{n}.

export { versionOf };
export const classContent = docContent;

export const resolveClassVersion = (classId, version) => resolveVersion('classes', classId, version);
export const listClassVersions = (classId) => listVersions('classes', classId);
export const publishClassVersion = (classId, nextData, notes, expectedVersion) => publishVersion('classes', classId, nextData, notes, expectedVersion);
