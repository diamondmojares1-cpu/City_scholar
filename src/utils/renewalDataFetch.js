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

            // ✅ FIX: Always store/return lowercase status for consistent comparison
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
                // ✅ FIX: lowercase status — matches getRenewalStatusClass/Label
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
// ✅ FIX: Saves lowercase status + syncs ALL relevant fields to users/{userId}
// ─────────────────────────────────────────────────────────
export async function updateRenewalStatus(applicationId, newStatus, notes) {
    notes = notes || "";

    // ✅ FIX: Always use lowercase for consistency across admin and student
    var statusLower = (newStatus || "").toLowerCase().trim();

    try {
        var ref = doc(db, RENEWALS_COL, applicationId);

        // 1. Update the renewal doc with lowercase status
        var payload = {
            status: statusLower,
            updatedAt: Date.now(),
        };
        if (notes) payload.adminNotes = notes;
        await updateDoc(ref, payload);

        // 2. Sync status back to users/{userId} so student side sees it immediately
        var snap = await getDoc(ref);
        if (snap.exists()) {
            var data = snap.data();
            var userId = data.userId || data.uid || "";
            if (userId) {
                // ✅ FIX: Update ALL status fields the student side might be reading
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
// Returns { canSubmit, reason, cycleId }
// ─────────────────────────────────────────────────────────
export async function checkRenewalEligibility(userId) {
    try {
        var settingsSnap = await getDoc(doc(db, "settings", "renewal"));
        var settings = settingsSnap.exists() ? settingsSnap.data() : {};
        var isOpen = settings.isOpen === true;
        var currentCycleId = settings.currentCycleId || null;

        var userSnap = await getDoc(doc(db, "users", userId));
        var promoted = false;
        if (userSnap.exists()) {
            var userData = userSnap.data();
            // ✅ FIX: Check lowercase "approved" since we now save lowercase
            var statusVal = (
                userData.scholarshipStatus ||
                userData.applicationStatus ||
                userData.renewalStatus || ""
            ).toLowerCase();
            var isApproved = statusVal === "approved";
            promoted = userData.promoted === true ||
                userData.renewalAccess === true ||
                isApproved;
        }

        if (!settingsSnap.exists() && promoted) isOpen = true;

        if (!isOpen && !promoted) {
            return {
                canSubmit: false,
                reason: "Renewal submissions are currently closed.",
                cycleId: null,
            };
        }

        if (!currentCycleId) {
            var now = new Date();
            currentCycleId = "cycle_" + now.getFullYear() + "_" + (now.getMonth() + 1) + "_" + now.getDate();
        }

        var existingSnap = await getDocs(
            query(collection(db, RENEWALS_COL), where("userId", "==", userId))
        );
        var alreadySubmitted = existingSnap.docs.some(function(d) {
            return d.data().cycleId === currentCycleId;
        });

        if (alreadySubmitted) {
            return {
                canSubmit: false,
                reason: "You have already submitted a renewal for this cycle. Please wait for the review.",
                cycleId: currentCycleId,
            };
        }

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
            status: "pending", // ✅ always lowercase
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

        // ✅ Sync pending status back to user doc
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
// ✅ All lowercase keys to match the lowercase status we save

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