import { listRaceVersions } from '../utils/raceVersions';
import { isLinkedToRace } from '../utils/characterClass';
import { VersionControl } from './VersionControl';

export function RaceVersionControl({ characterPage, userId, status, latestVersion }) {
    if (!isLinkedToRace(characterPage)) return null;
    return <VersionControl
        kind="Race"
        name={characterPage.race_name}
        docId={characterPage.race_id}
        pinned={characterPage.race_version}
        versionField="race_version"
        listVersions={listRaceVersions}
        characterPage={characterPage}
        userId={userId}
        status={status}
        latestVersion={latestVersion}
    />;
}
