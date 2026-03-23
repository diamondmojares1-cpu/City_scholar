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
    const isOldScholar = raw.promoted === true || isReturningApplicant(scholar.applicantType);
    scholar.promoted = isOldScholar;
    scholar.renewalAccess = raw.renewalAccess === true || isOldScholar;

    if (isOldScholar) {
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
    const isOldScholar = raw.promoted !== false;
    scholar.promoted = isOldScholar;
    scholar.renewalAccess = raw.renewalAccess === true || isOldScholar;

    if (!scholar.applicantType || scholar.applicantType === "-") {
      scholar.applicantType = isOldScholar
        ? "Returning Applicant"
        : scholar.originalApplicantType || "New Applicant";
    }

    if (isOldScholar) {
      oldList.push(scholar);
    } else {
      newList.push(scholar);
    }
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
  const originalApplicantType =
    scholar.originalApplicantType || scholar.applicantType || "New Applicant";

  await updateDoc(doc(db, scholar.sourceCollection, scholar.id), {
    promoted: true,
    renewalAccess: true,
    originalApplicantType,
    applicantType: "Returning Applicant",
    promotedAt: serverTimestamp(),
  });

  const targetId = scholar.userId || scholar.id;
  if (targetId) {
    await setDoc(
      doc(db, "users", targetId),
      {
        renewalAccess: true,
        promoted: true,
      },
      { merge: true }
    );
  }

  return {
    ...scholar,
    promoted: true,
    renewalAccess: true,
    originalApplicantType,
    applicantType: "Returning Applicant",
  };
}

export async function unpromoteScholarRecord(scholar) {
  const restoredApplicantType = scholar.originalApplicantType || "New Applicant";

  await updateDoc(doc(db, scholar.sourceCollection, scholar.id), {
    promoted: false,
    renewalAccess: false,
    applicantType: restoredApplicantType,
    unpromotedAt: serverTimestamp(),
  });

  const targetId = scholar.userId || scholar.id;
  if (targetId) {
    await setDoc(
      doc(db, "users", targetId),
      {
        renewalAccess: false,
        promoted: false,
      },
      { merge: true }
    );
  }

  return {
    ...scholar,
    promoted: false,
    renewalAccess: false,
    applicantType: restoredApplicantType,
    originalApplicantType: restoredApplicantType,
  };
}
