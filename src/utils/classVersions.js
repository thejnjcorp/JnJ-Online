import { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// classes/{id} always holds the *current* (latest) version, so every existing
// reader (catalog, pickers, campaign subscriptions) keeps working untouched.
// Older versions live as immutable snapshots in classes/{id}/versions/{n},
// written when a new version is published. A class with no `version` field
// is version 1 - nothing needs backfilling.

// Permission/visibility fields belong to the class as a whole, not to any one
// version, so they're never snapshotted.
const NON_CONTENT_FIELDS = ['id', 'public', 'isDefault', 'canRead', 'canWrite', 'admins', 'visibility'];

export function versionOf(classData) {
    return classData?.version ?? 1;
}

export function classContent(classData) {
    return Object.fromEntries(
        Object.entries(classData || {}).filter(([key, value]) => !NON_CONTENT_FIELDS.includes(key) && value !== undefined)
    );
}

// Resolves { data, version, latestVersion } for a pinned version (defaults to
// the latest). Throws if the class or version can't be read - callers treat
// that as "use the saved copy on the character".
export async function resolveClassVersion(classId, version) {
    const snap = await getDoc(doc(db, 'classes', classId));
    if (!snap.exists()) throw new Error('Class not found');
    const current = snap.data();
    const latestVersion = versionOf(current);
    const target = version ?? latestVersion;
    if (target === latestVersion) return { data: current, version: target, latestVersion };

    const versionSnap = await getDoc(doc(db, 'classes', classId, 'versions', String(target)));
    if (!versionSnap.exists()) throw new Error(`Version ${target} not found`);
    return { data: versionSnap.data(), version: target, latestVersion };
}

// [{ version, notes, publishedAt }], newest first: the current doc plus every
// snapshot in the versions subcollection.
export async function listClassVersions(classId) {
    const [currentSnap, versionsSnap] = await Promise.all([
        getDoc(doc(db, 'classes', classId)),
        getDocs(collection(db, 'classes', classId, 'versions')),
    ]);
    const entries = versionsSnap.docs.map(d => ({ version: Number(d.id), ...summary(d.data()) }));
    if (currentSnap.exists()) entries.push({ version: versionOf(currentSnap.data()), ...summary(currentSnap.data()) });
    return entries.sort((a, b) => b.version - a.version);
}

function summary(data) {
    return { notes: data.versionNotes || '', publishedAt: data.publishedAt || null };
}

// Freezes the class as it currently is in Firestore (what characters pinned
// to it are seeing right now - never unsaved edits) as versions/{current},
// then writes `nextData` as the new latest version. Runs in a transaction and
// refuses if the version moved since the caller loaded it, so two people
// publishing at once can't both claim the same number.
export async function publishClassVersion(classId, nextData, notes, expectedVersion) {
    const classRef = doc(db, 'classes', classId);
    return runTransaction(db, async (transaction) => {
        const snap = await transaction.get(classRef);
        const current = snap.data();
        const currentVersion = versionOf(current);
        if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
            throw new Error('This class was published by someone else while you were editing. Reload and try again.');
        }
        transaction.set(doc(db, 'classes', classId, 'versions', String(currentVersion)), {
            ...classContent(current),
            version: currentVersion,
        });
        transaction.update(classRef, {
            ...nextData,
            version: currentVersion + 1,
            versionNotes: notes || '',
            publishedAt: serverTimestamp(),
        });
        return currentVersion + 1;
    });
}
