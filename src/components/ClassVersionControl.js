import { listClassVersions } from '../utils/classVersions';
import { isLinkedToClass } from '../utils/characterClass';
import { VersionControl } from './VersionControl';

// Only rendered for characters linked to a class (see isLinkedToClass);
// legacy ones just show the saved copy.
export function ClassVersionControl({ characterPage, userId, status, latestVersion }) {
    if (!isLinkedToClass(characterPage)) return null;
    return <VersionControl
        kind="Class"
        name={characterPage.class_name}
        docId={characterPage.class_id}
        pinned={characterPage.class_version}
        versionField="class_version"
        listVersions={listClassVersions}
        characterPage={characterPage}
        userId={userId}
        status={status}
        latestVersion={latestVersion}
    />;
}
