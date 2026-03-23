import { collection, getDocs, doc, updateDoc, addDoc, getDoc, query, where } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

// ── Collection name ───────────────────────────────────────
const RENEWALS_COL = "scholar_renewals";

// ─────────────────────────────────────────────────────────
// ADMIN — Fetch ALL renewals from scholar_renewals
// ─────────────────────────────────────────────────────────
export async function fetchAllRenewals() {
    try {
        var settingsSnap = await getDoc(doc(db, "settings", "renewal"));
        var currentCycleId = settingsSnap.exists() ?
            settingsSnap.data().currentCycleId || null : null;
        var hasCycleToggle = Boolean(currentCycleId);

        var snap = await getDocs(collection(db, RENEWALS_COL));

        var renewals = snap.docs.map(function(d) {
            var app = { id: d.id };
            var raw = d.data();
            Object.keys(raw).forEach(function(k) { app[k] = raw[k]; });

            var edu = app.educationInfo || {};
            var personal = app.personalInfo || {};
            var docs = app.documents || {};
            var financial = app.financialInfo || {};

            var firstName = personal.firstName || app.firstName || "";
            var middleName = personal.middleName || app.middleName || "";
            var lastName = personal.lastName || app.lastName || "";
            var fullName = [firstName, middleName, lastName]
                .filter(Boolean).join(" ").trim() || app.name || "—";

            var school = edu.schoolName || edu.school || app.schoolName || app.school || "—";
            var gpa = edu.gwa || edu.gpa || app.gpa || app.gwa || "—";
            var semester = edu.semester || app.semester || "—";

            var rawDate = app.submittedAt || app.createdAt;
            var dateSubmitted = "—";
            if (rawDate) {
                var ms = typeof rawDate === "number" ?
                    rawDate :
                    typeof rawDate.toMillis === "function" ?
                    rawDate.toMillis() : Number(rawDate);
                dateSubmitted = new Date(ms).toLocaleDateString(undefined, { dateStyle: "medium" });
            }

            var rawStatus = (app.status || "pending").toLowerCase().trim();
            var cycleId = app.cycleId || null;

            return {
                id: app.id,
                userId: app.userId || app.uid || "",
                cycleId: cycleId,
                isCurrentCycle: hasCycleToggle ? cycleId === currentCycleId : true,
                _source: RENEWALS_COL,
                name: fullName,
                school: school,
                gpa: gpa,
                semester: semester,
                dateSubmitted: dateSubmitted,
                status: rawStatus,
                email: personal.email || app.email || "—",
                contactNumber: personal.contactNumber || app.contactNumber || "—",
                dateOfBirth: personal.dateOfBirth || app.dateOfBirth || "—",
                barangay: personal.barangay || app.barangay || "—",
                address: personal.address || app.address || "—",
                course: edu.course || app.course || "—",
                yearLevel: edu.yearLevel || app.yearLevel || "—",
                studentId: edu.studentId || app.studentId || "—",
                fatherName: financial.fatherName || "—",
                motherName: financial.motherName || "—",
                totalIncome: financial.totalIncome || financial.annualIncome || "—",
                coeUrl: docs.coeUrl || app.coeUrl || "",
                gradesUrl: docs.gradesUrl || app.gradesUrl || "",
                indigencyUrl: docs.indigencyUrl || app.indigencyUrl || "",
                itrUrl: docs.itrUrl || app.itrUrl || "",
                residencyUrl: docs.residencyUrl || app.residencyUrl || "",
                photoUrl: docs.photoUrl || app.photoUrl || "",
                birthCertUrl: docs.birthCertUrl || app.birthCertUrl || "",
                goodMoralUrl: docs.goodMoralUrl || app.goodMoralUrl || "",
                validIdUrl: docs.validIdUrl || app.validIdUrl || "",
            };
        });

        return renewals.sort(function(a, b) {
            var aTime = a.dateSubmitted === "—" ? 0 : new Date(a.dateSubmitted).getTime();
            var bTime = b.dateSubmitted === "—" ? 0 : new Date(b.dateSubmitted).getTime();
            return bTime - aTime;
        });

    } catch (err) {
        console.error("fetchAllRenewals error:", err);
        return [];
    }
}

// ─────────────────────────────────────────────────────────
// ADMIN — Update renewal status in scholar_renewals
// Saves lowercase status + syncs ALL relevant fields to users/{userId}
// ─────────────────────────────────────────────────────────
export async function updateRenewalStatus(applicationId, newStatus, notes) {
    notes = notes || "";
    var statusLower = (newStatus || "").toLowerCase().trim();

    try {
        var ref = doc(db, RENEWALS_COL, applicationId);

        var payload = { status: statusLower, updatedAt: Date.now() };
        if (notes) payload.adminNotes = notes;
        await updateDoc(ref, payload);

        var snap = await getDoc(ref);
        if (snap.exists()) {
            var data = snap.data();
            var userId = data.userId || data.uid || "";
            if (userId) {
                await updateDoc(doc(db, "users", userId), {
                    renewalStatus: statusLower,
                    applicationStatus: statusLower,
                    scholarshipStatus: statusLower,
                    updatedAt: Date.now(),
                });
            }
        }
    } catch (err) {
        console.error("updateRenewalStatus error:", err);
        throw err;
    }
}

// ─────────────────────────────────────────────────────────
// STUDENT — Check eligibility before showing renewal form
//
// ✅ FIXED: A student can ONLY submit a renewal if:
//   1. Admin explicitly set promoted:true OR renewalAccess:true on their user doc
//   2. The renewal period is open (settings/renewal → isOpen:true)
//   3. They haven't already submitted for the current cycle
//
// Removed all status-based bypasses (scholarshipStatus, applicationStatus).
// "Approved" status alone does NOT grant renewal access.
// ─────────────────────────────────────────────────────────
export async function checkRenewalEligibility(userId) {
    try {
        // ── Step 1: Load the student's user document ──────────
        const userSnap = await getDoc(doc(db, "users", userId));

        if (!userSnap.exists()) {
            return {
                canSubmit: false,
                reason: "User account not found. Please contact support.",
                cycleId: null,
            };
        }

        const userData = userSnap.data();

        // ── Step 2: Check promotion status ────────────────────
        // ONLY promoted:true OR renewalAccess:true allows access.
        // No other field (status, scholarshipStatus, etc.) can bypass this.
        const isPromoted =
            userData.promoted === true ||
            userData.renewalAccess === true;

        if (!isPromoted) {
            return {
                canSubmit: false,
                reason: "You are not yet eligible for renewal. Please wait for admin or staff to promote your account.",
                cycleId: null,
            };
        }

        // ── Step 3: Check if renewal period is open ───────────
        const settingsSnap = await getDoc(doc(db, "settings", "renewal"));
        const settings = settingsSnap.exists() ? settingsSnap.data() : {};
        const isOpen = settings.isOpen === true;
        let currentCycleId = settings.currentCycleId || null;

        if (!isOpen) {
            return {
                canSubmit: false,
                reason: "Renewal submissions are currently closed. Please check back later.",
                cycleId: null,
            };
        }

        // Fallback cycle ID if not set in settings
        if (!currentCycleId) {
            const now = new Date();
            currentCycleId =
                "cycle_" + now.getFullYear() +
                "_" + (now.getMonth() + 1) +
                "_" + now.getDate();
        }

        // ── Step 4: Check if already submitted this cycle ─────
        const existingSnap = await getDocs(
            query(
                collection(db, RENEWALS_COL),
                where("userId", "==", userId),
                where("cycleId", "==", currentCycleId)
            )
        );

        if (!existingSnap.empty) {
            return {
                canSubmit: false,
                reason: "You have already submitted a renewal for this cycle. Please wait for the review.",
                cycleId: currentCycleId,
            };
        }

        // ── All checks passed ─────────────────────────────────
        return { canSubmit: true, reason: null, cycleId: currentCycleId };

    } catch (err) {
        console.error("checkRenewalEligibility error:", err);
        return {
            canSubmit: false,
            reason: "Unable to verify eligibility. Please try again.",
            cycleId: null,
        };
    }
}

// ─────────────────────────────────────────────────────────
// STUDENT — Submit renewal to scholar_renewals
// ─────────────────────────────────────────────────────────
export async function submitRenewalApplication(userId, renewalData) {
    try {
        // Re-run eligibility check before submitting
        var eligibility = await checkRenewalEligibility(userId);
        var canSubmit = eligibility.canSubmit;
        var reason = eligibility.reason;
        var currentCycleId = eligibility.cycleId;

        if (!canSubmit) throw new Error(reason || "RENEWAL_CLOSED");
        if (!currentCycleId) throw new Error("RENEWAL_CLOSED");

        var d = renewalData.documents || {};

        var payload = {
            userId: userId,
            cycleId: currentCycleId,
            status: "pending", // always lowercase
            submittedAt: Date.now(),
            updatedAt: Date.now(),
            personalInfo: {
                firstName: renewalData.firstName || "",
                middleName: renewalData.middleName || "",
                lastName: renewalData.lastName || "",
                email: renewalData.email || "",
                contactNumber: renewalData.contactNumber || "",
                dateOfBirth: renewalData.dateOfBirth || "",
                barangay: renewalData.barangay || "",
                address: renewalData.address || "",
            },
            educationInfo: {
                schoolName: renewalData.schoolName || "",
                course: renewalData.course || "",
                semester: renewalData.semester || "",
                yearLevel: renewalData.yearLevel || "",
                studentId: renewalData.studentId || "",
                gwa: renewalData.gpa || "",
            },
            financialInfo: renewalData.financialInfo || {},
            documents: {
                coeUrl: renewalData.coeUrl || d.coeUrl || "",
                gradesUrl: renewalData.gradesUrl || d.gradesUrl || "",
                indigencyUrl: renewalData.indigencyUrl || d.indigencyUrl || "",
                itrUrl: renewalData.itrUrl || d.itrUrl || "",
                residencyUrl: renewalData.residencyUrl || d.residencyUrl || "",
                photoUrl: renewalData.photoUrl || d.photoUrl || "",
                birthCertUrl: renewalData.birthCertUrl || d.birthCertUrl || "",
                goodMoralUrl: renewalData.goodMoralUrl || d.goodMoralUrl || "",
                validIdUrl: renewalData.validIdUrl || d.validIdUrl || "",
            },
        };

        var docRef = await addDoc(collection(db, RENEWALS_COL), payload);

        // Sync pending status back to user doc
        await updateDoc(doc(db, "users", userId), {
            renewalStatus: "pending",
            lastRenewalDate: Date.now(),
        });

        return { id: docRef.id };

    } catch (err) {
        console.error("submitRenewalApplication error:", err);
        throw err;
    }
}

// ─────────────────────────────────────────────────────────
// STUDENT — Fetch own renewal history from scholar_renewals
// ─────────────────────────────────────────────────────────
export async function fetchStudentRenewals(userId) {
    try {
        var q = query(collection(db, RENEWALS_COL), where("userId", "==", userId));
        var snap = await getDocs(q);
        return snap.docs
            .map(function(d) {
                var obj = { id: d.id, _source: RENEWALS_COL };
                var raw = d.data();
                Object.keys(raw).forEach(function(k) { obj[k] = raw[k]; });
                return obj;
            })
            .sort(function(a, b) { return (b.submittedAt || 0) - (a.submittedAt || 0); });
    } catch (err) {
        console.error("fetchStudentRenewals error:", err);
        return [];
    }
}

// ── Status helpers ────────────────────────────────────────
export function getRenewalStatusLabel(status) {
    var labels = {
        pending: "Pending Review",
        approved: "Approved",
        rejected: "Rejected",
        missing: "Missing Documents",
        reviewing: "Under Review",
    };
    return labels[(status || "").toLowerCase().trim()] || "Pending Review";
}

export function getRenewalStatusClass(status) {
    var classes = {
        pending: "pending",
        approved: "approved",
        rejected: "rejected",
        missing: "missing",
        reviewing: "reviewing",
    };
    return classes[(status || "").toLowerCase().trim()] || "pending";
}

export function getRenewalStatusCounts(renewals) {
    var counts = { pending: 0, approved: 0, rejected: 0, missing: 0, reviewing: 0 };
    renewals.forEach(function(r) {
        var s = (r.status || "pending").toLowerCase().trim();
        if (Object.prototype.hasOwnProperty.call(counts, s)) counts[s]++;
    });
    return counts;
}

export function validateRenewalForm(formData) {
    var errors = [];
    if (!formData.fullName || formData.fullName.trim().length < 2)
        errors.push("Full name is required and must be at least 2 characters");
    if (!formData.course || formData.course.trim().length < 2)
        errors.push("Course is required");
    if (!formData.yearLevel || formData.yearLevel.trim().length < 1)
        errors.push("Year level is required");
    if (formData.gpa === null || formData.gpa === undefined || formData.gpa === "")
        errors.push("GPA is required");
    else if (isNaN(parseFloat(formData.gpa)) || parseFloat(formData.gpa) < 0 || parseFloat(formData.gpa) > 4.0)
        errors.push("GPA must be a number between 0 and 4.0");
    return { isValid: errors.length === 0, errors: errors };
}