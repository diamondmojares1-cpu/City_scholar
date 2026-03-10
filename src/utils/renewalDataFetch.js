import { collection, getDocs, doc, updateDoc, addDoc, query, where } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export async function fetchAllRenewals() {
    try {
        const appSnap = await getDocs(collection(db, "scholarship_applications"));

        const returningApps = appSnap.docs
            .map(function(d) { return Object.assign({ id: d.id }, d.data()); })
            .filter(function(app) {
                var edu = app.educationInfo || {};
                return edu.applicantType === "Returning Applicant";
            });

        if (returningApps.length === 0) return [];

        const usersSnap = await getDocs(collection(db, "users"));
        const usersMap = {};
        usersSnap.docs.forEach(function(d) {
            usersMap[d.id] = Object.assign({ id: d.id }, d.data());
        });

        const renewals = returningApps.map(function(app) {
            var edu = app.educationInfo || {};
            var personal = app.personalInfo || {};
            var docs = app.documents || {};
            var financial = app.financialInfo || {};

            var userId = app.userId || app.uid || app.studentId || app.id;
            var user = usersMap[userId] || {};

            var firstName = personal.firstName || "";
            var middleName = personal.middleName ? (" " + personal.middleName) : "";
            var lastName = personal.lastName ? (" " + personal.lastName) : "";
            var fullName =
                (firstName + middleName + lastName).trim() ||
                user.fullName ||
                "—";

            var school = edu.schoolName || edu.school || user.schoolName || user.school || user.course || user.university || user.college || "—";
            var gpa = edu.gwa || app.gpa || user.gpa || "—";

            var rawDate = app.submittedAt || app.createdAt || user.createdAt;
            var dateSubmitted = rawDate ?
                new Date(rawDate).toLocaleDateString(undefined, { dateStyle: "medium" }) :
                "—";

            var rawStatus =
                app.status ||
                user.applicationStatus ||
                user.scholarshipStatus ||
                "pending";

            var status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);

            return {
                id: app.id,
                userId: userId,
                name: fullName,
                school: school,
                gpa: gpa,
                dateSubmitted: dateSubmitted,
                status: status,
                email: personal.email || user.email || "—",
                contactNumber: personal.contactNumber || "—",
                dateOfBirth: personal.dateOfBirth || "—",
                barangay: personal.barangay || user.barangay || "—",
                address: personal.address || "—",
                course: edu.course || user.course || "—",
                yearLevel: edu.yearLevel || user.yearLevel || "—",
                studentId: edu.studentId || "—",
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
        }).filter(Boolean);

        return renewals.sort(function(a, b) {
            var aTime = a.dateSubmitted === "—" ? 0 : new Date(a.dateSubmitted).getTime();
            var bTime = b.dateSubmitted === "—" ? 0 : new Date(b.dateSubmitted).getTime();
            return bTime - aTime;
        });

    } catch (err) {
        console.error("Failed to load renewals:", err);
        return [];
    }
}

export async function updateRenewalStatus(applicationId, newStatus, notes) {
    notes = notes || "";
    try {
        // Step 1: Update scholarship_applications status
        var appRef = doc(db, "scholarship_applications", applicationId);
        var payload = { status: newStatus, updatedAt: Date.now() };
        if (notes) { payload.adminNotes = notes; }
        await updateDoc(appRef, payload);

        // Step 2: Find the userId from the application and update users collection too
        // This ensures the Scholars (old applicants) page picks up the approved status
        var appSnap = await getDocs(collection(db, "scholarship_applications"));
        var appDoc = appSnap.docs.find(function(d) { return d.id === applicationId; });
        if (appDoc) {
            var appData = appDoc.data();
            var userId = appData.userId || appData.uid || appData.studentId;
            if (userId) {
                var userRef = doc(db, "users", userId);
                await updateDoc(userRef, {
                    applicationStatus: newStatus,
                    scholarshipStatus: newStatus,
                    updatedAt: Date.now(),
                });
            }
        }
    } catch (err) {
        console.error("Failed to update renewal status:", err);
        throw err;
    }
}

export async function submitRenewalApplication(userId, renewalData) {
    try {
        var payload = {
            userId: userId,
            status: "pending",
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
                applicantType: "Returning Applicant",
                schoolName: renewalData.schoolName || "",
                course: renewalData.course || "",
                yearLevel: renewalData.yearLevel || "",
                studentId: renewalData.studentId || "",
                gwa: renewalData.gpa || "",
            },
            financialInfo: renewalData.financialInfo || {},
            documents: renewalData.documents || {},
        };

        var docRef = await addDoc(collection(db, "scholarship_applications"), payload);
        await updateDoc(doc(db, "users", userId), {
            renewalStatus: "pending",
            lastRenewalDate: Date.now(),
        });
        return Object.assign({ id: docRef.id }, payload);
    } catch (err) {
        console.error("Failed to submit renewal application:", err);
        throw err;
    }
}

export async function fetchStudentRenewals(userId) {
    try {
        var q = query(
            collection(db, "scholarship_applications"),
            where("userId", "==", userId)
        );
        var snap = await getDocs(q);
        return snap.docs
            .map(function(d) { return Object.assign({ id: d.id }, d.data()); })
            .filter(function(app) {
                var edu = app.educationInfo || {};
                return edu.applicantType === "Returning Applicant";
            })
            .sort(function(a, b) { return (b.submittedAt || 0) - (a.submittedAt || 0); });
    } catch (err) {
        console.error("Failed to load student renewals:", err);
        return [];
    }
}

export function getRenewalStatusCounts(renewals) {
    var counts = { pending: 0, approved: 0, rejected: 0, missing: 0, reviewing: 0 };
    renewals.forEach(function(r) {
        var s = (r.status || "pending").toLowerCase();
        if (counts.hasOwnProperty(s)) counts[s] += 1;
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
    if (!formData.renewalReason || formData.renewalReason.trim().length < 10)
        errors.push("Renewal reason is required and must be at least 10 characters");
    if (!Array.isArray(formData.documents) || formData.documents.length === 0)
        errors.push("At least one document is required");
    return { isValid: errors.length === 0, errors: errors };
}

export function getRenewalStatusLabel(status) {
    var labels = {
        pending: "Pending Review",
        approved: "Approved",
        rejected: "Rejected",
        missing: "Missing Documents",
        reviewing: "Under Review",
    };
    // normalize to lowercase so "Approved", "APPROVED" all match
    var key = (status || "").toLowerCase();
    return labels[key] || "Pending Review";
}

export function getRenewalStatusClass(status) {
    var classes = {
        pending: "pending",
        approved: "approved",
        rejected: "rejected",
        missing: "missing",
        reviewing: "reviewing",
    };
    var key = (status || "").toLowerCase();
    return classes[key] || "pending";
}

export function checkRenewalEligibility(lastRenewalDate, renewalPeriodMonths) {
    renewalPeriodMonths = renewalPeriodMonths || 12;
    var now = Date.now();
    var renewalIntervalMs = renewalPeriodMonths * 30 * 24 * 60 * 60 * 1000;
    var nextRenewalDate = lastRenewalDate + renewalIntervalMs;
    var eligible = now >= nextRenewalDate;
    return {
        eligible: eligible,
        daysUntilEligible: eligible ? 0 : Math.ceil((nextRenewalDate - now) / (24 * 60 * 60 * 1000)),
        nextRenewalDate: nextRenewalDate,
    };
}