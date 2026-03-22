import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import {
  getRawStatus,
  isReturningApplicant,
  parseScholarApplication,
} from "../utils/scholarHelpers";

export async function fetchApprovedScholars() {
  const [applicationSnapshot, renewalSnapshot] = await Promise.all([
    getDocs(collection(db, "scholarship_applications")),
    getDocs(collection(db, "scholar_renewals")),
  ]);

  const newList = [];
  const oldList = [];

  applicationSnapshot.docs.forEach((docSnap) => {
    const raw = docSnap.data();
    if (raw.archived === true || getRawStatus(raw) !== "approved") return;

    const scholar = parseScholarApplication(docSnap);
    scholar.sourceCollection = "scholarship_applications";

    if (isReturningApplicant(scholar.applicantType) || raw.promoted === true) {
      oldList.push(scholar);
    } else {
      newList.push(scholar);
    }
  });

  renewalSnapshot.docs.forEach((docSnap) => {
    const raw = docSnap.data();
    if (raw.archived === true || getRawStatus(raw) !== "approved") return;

    const scholar = parseScholarApplication(docSnap);
    scholar.sourceCollection = "scholar_renewals";

    if (!scholar.applicantType || scholar.applicantType === "-") {
      scholar.applicantType = "Returning Applicant";
    }

    oldList.push(scholar);
  });

  newList.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
  oldList.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));

  return { newList, oldList };
}

export async function archiveScholarRecord(scholar) {
  await setDoc(doc(db, "archives", scholar.id), {
    ...scholar._raw,
    archivedAt: serverTimestamp(),
    sourceCollection: scholar.sourceCollection,
    originalId: scholar.id,
    archived: true,
  });

  await updateDoc(doc(db, scholar.sourceCollection, scholar.id), {
    archived: true,
  });
}

export async function promoteScholarRecord(scholar) {
  await updateDoc(doc(db, scholar.sourceCollection, scholar.id), {
    promoted: true,
    renewalAccess: true,
    applicantType: "Returning Applicant",
    promotedAt: serverTimestamp(),
  });

  const targetId = scholar.userId || scholar.id;
  if (targetId) {
    try {
      await updateDoc(doc(db, "users", targetId), {
        renewalAccess: true,
        promoted: true,
      });
    } catch (_) {
      // Keep scholar promotion successful even when the user record is missing.
    }
  }

  return {
    ...scholar,
    promoted: true,
    renewalAccess: true,
    applicantType: "Returning Applicant",
  };
}
