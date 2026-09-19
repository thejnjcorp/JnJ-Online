import { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// Versioning shared by every collection that has it (classes, races).
// {collection}/{id} always holds the *current* (latest) version, so every
// existing reader (catalogs, pickers, campaign subscriptions) keeps working
// untouched. Older versions live as immutable snapshots in
// {collection}/{id}/versions/{n}, written when a new version is published. A
// doc with no `version` field is version 1 - nothing needs backfilling.

// Permission/visibility fields belong to the doc as a whole, not to any one
// version, so they're never snapshotted.
const NON_CONTENT_FIELDS = ['id', 'public', 'isDefault', 'canRead', 'canWrite', 'admins', 'visibility'];

const LABELS = { classes: 'Class', races: 'Race' };

export function versionOf(data) {
    return data?.version ?? 1;
}

export function docContent(data) {
    return Object.fromEntries(
        Object.entries(data || {}).filter(([key, value]) => !NON_CONTENT_FIELDS.includes(key) && value !== undefined)
    );
}

// Resolves { data, version, latestVersion } for a pinned version (defaults to
// the latest). Throws if the doc or version can't be read - callers treat
// that as "use the saved copy on the character".
export async function resolveVersion(collectionName, docId, version) {
    const snap = await getDoc(doc(db, collectionName, docId));
    if (!snap.exists()) throw new Error(`${LABELS[collectionName] || 'Document'} not found`);
    const current = snap.data();
    const latestVersion = versionOf(current);
    const target = version ?? latestVersion;
    if (target === latestVersion) return { data: current, version: target, latestVersion };

    const versionSnap = await getDoc(doc(db, collectionName, docId, 'versions', String(target)));
    if (!versionSnap.exists()) throw new Error(`Version ${target} not found`);
    return { data: versionSnap.data(), version: target, latestVersion };
}

function summary(data) {
    return { notes: data.versionNotes || '', publishedAt: data.publishedAt || null };
}

// [{ version, notes, publishedAt }], newest first: the current doc plus every
// snapshot in the versions subcollection.
export async function listVersions(collectionName, docId) {
    const [currentSnap, versionsSnap] = await Promise.all([
        getDoc(doc(db, collectionName, docId)),
        getDocs(collection(db, collectionName, docId, 'versions')),
    ]);
    const entries = versionsSnap.docs.map(d => ({ version: Number(d.id), ...summary(d.data()) }));
    if (currentSnap.exists()) entries.push({ version: versionOf(currentSnap.data()), ...summary(currentSnap.data()) });
    return entries.sort((a, b) => b.version - a.version);
}

// Freezes the doc as it currently is in Firestore (what characters pinned to
// it are seeing right now - never unsaved edits) as versions/{current}, then
// writes `nextData` as the new latest version. Runs in a transaction and
// refuses if the version moved since the caller loaded it, so two people
// publishing at once can't both claim the same number.
export async function publishVersion(collectionName, docId, nextData, notes, expectedVersion) {
    const docRef = doc(db, collectionName, docId);
    return runTransaction(db, async (transaction) => {
        const snap = await transaction.get(docRef);
        const current = snap.data();
        const currentVersion = versionOf(current);
        if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
            throw new Error(`This ${(LABELS[collectionName] || 'document').toLowerCase()} was published by someone else while you were editing. Reload and try again.`);
        }
        transaction.set(doc(db, collectionName, docId, 'versions', String(currentVersion)), {
            ...docContent(current),
            version: currentVersion,
        });
        transaction.update(docRef, {
            ...nextData,
            version: currentVersion + 1,
            versionNotes: notes || '',
            publishedAt: serverTimestamp(),
        });
        return currentVersion + 1;
    });
}
