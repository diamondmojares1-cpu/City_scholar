import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

/**
 * Fetch student data from Firestore
 * @returns {Promise<Array>} Array of student objects with their data
 */
export async function fetchStudents() {
    try {
        const snap = await getDocs(collection(db, "users"));
        const students = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((u) => u.role === "student")
            .map((u) => ({
                id: u.id,
                fullName: u.fullName || "—",
                course: u.course || "—",
                yearLevel: u.yearLevel || "—",
                gpa: u.gpa != null ? u.gpa : "—",
                gwa: u.gwa || u.gpa || "—",
                barangay: u.barangay || u.brgy || u.barangayName || "Unknown",
                status: u.applicationStatus || u.scholarshipStatus || "pending",
                createdAt: u.createdAt || 0,
            }))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        return students;
    } catch (err) {
        console.error("Failed to load students:", err);
        return [];
    }
}

/**
 * Alias for fetchStudents — used by BarangayOverview and other pages
 */
export const fetchStudentRecords = fetchApprovedScholarsForBarangay;

/**
 * Fetch APPROVED scholars from scholarship_applications for BarangayOverview.
 * Gets barangay from personalInfo.barangay where status = "approved".
 */
export async function fetchApprovedScholarsForBarangay() {
    try {
        const snap = await getDocs(collection(db, "scholarship_applications"));

        const approved = snap.docs
            .map(function(d) { return Object.assign({ id: d.id }, d.data()); })
            .filter(function(app) {
                var status = (app.status || "").toLowerCase();
                return status === "approved";
            })
            .map(function(app) {
                var personal = app.personalInfo || {};
                var edu = app.educationInfo || {};
                var firstName = personal.firstName || "";
                var middleName = personal.middleName ? (" " + personal.middleName) : "";
                var lastName = personal.lastName ? (" " + personal.lastName) : "";
                var fullName = (firstName + middleName + lastName).trim() || "—";

                return {
                    id: app.id,
                    fullName: fullName,
                    course: edu.course || "—",
                    yearLevel: edu.yearLevel || "—",
                    gpa: edu.gwa || "—",
                    gwa: edu.gwa || "—",
                    barangay: personal.barangay || personal.brgy || "Unknown",
                    status: (app.status || "approved").toLowerCase(),
                    createdAt: app.submittedAt || app.createdAt || 0,
                };
            })
            .sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

        return approved;
    } catch (err) {
        console.error("Failed to load approved scholars:", err);
        return [];
    }
}

/**
 * Normalize status string to standard values
 * @param {string} rawStatus - Raw status string from database
 * @returns {string} Normalized status ("approved", "rejected", "missing", "reviewing", "pending")
 */
export function normalizeStatus(rawStatus) {
    const s = (rawStatus + "").toLowerCase();

    if (s.includes("approve")) return "approved";
    if (s.includes("reject")) return "rejected";
    if (s.includes("missing") || s.includes("incomplete") || s.includes("require"))
        return "missing";
    if (s.includes("review")) return "reviewing";

    return "pending";
}

/**
 * Fetch and process student data for Renewals page
 * @returns {Promise<{students: Array, counts: Object}>} Students and status counts
 */
export async function fetchRenewalsData() {
    try {
        const snap = await getDocs(collection(db, "users"));

        let pending = 0;
        let approved = 0;
        let rejected = 0;
        let missing = 0;

        const students = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((u) => u.role === "student")
            .map((u) => {
                const rawStatus =
                    (u.renewalStatus ||
                        u.applicationStatus ||
                        u.scholarshipStatus ||
                        "pending") + "";
                const status = normalizeStatus(rawStatus);

                if (status === "approved") approved += 1;
                else if (status === "rejected") rejected += 1;
                else if (status === "missing") missing += 1;
                else pending += 1;

                return {
                    id: u.id,
                    fullName: u.fullName || "—",
                    course: u.course || "—",
                    yearLevel: u.yearLevel || "—",
                    gpa: u.gpa != null ? u.gpa : "—",
                    status: status,
                    createdAt: u.createdAt || 0,
                };
            })
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        return {
            students,
            counts: { pending, approved, rejected, missing },
        };
    } catch (err) {
        console.error("Failed to load renewals data:", err);
        return { students: [], counts: { pending: 0, approved: 0, rejected: 0, missing: 0 } };
    }
}

/**
 * Filter students for Scholars page (new vs old/approved)
 * @param {Array} students - Array of student objects
 * @param {string} filterMode - "old" for approved scholars, "new" for new applicants
 * @returns {Array} Filtered students
 */
export function filterScholarsData(students, filterMode) {
    const filtered = students.filter((s) =>
        filterMode === "old" ? s.status === "approved" : s.status !== "approved"
    );
    return filtered.slice(0, 30);
}

/**
 * Get status label for display
 * @param {string} status - Normalized status
 * @returns {string} Human-readable status label
 */
export function getStatusLabel(status) {
    const labels = {
        approved: "Approved",
        rejected: "Rejected",
        missing: "Missing Req.",
        reviewing: "For Reviewing",
        pending: "Pending",
    };
    return labels[status] || "Pending";
}

/**
 * Get CSS class name for status badge
 * @param {string} status - Normalized status
 * @returns {string} CSS class name
 */
export function getStatusClass(status) {
    const classes = {
        approved: "approved",
        rejected: "rejected",
        missing: "missing",
        reviewing: "reviewing",
        pending: "pending",
    };
    return classes[status] || "pending";
}

/**
 * Group students by barangay for BarangayOverview
 * @param {Array} students - Array of student objects
 * @returns {Object} Map of barangay name => array of students
 */
export function groupStudentsByBarangay(students) {
    const groupsMap = {};
    students.forEach(function(student) {
        const barangay = student.barangay || student.brgy || student.barangayName || "Unknown";
        if (!groupsMap[barangay]) {
            groupsMap[barangay] = [];
        }
        groupsMap[barangay].push(student);
    });
    // Return array of { name, totalScholars, students } as expected by BarangayOverview
    return Object.keys(groupsMap)
        .map(function(name) {
            return {
                name: name,
                totalScholars: groupsMap[name].length,
                students: groupsMap[name],
            };
        })
        .sort(function(a, b) { return b.totalScholars - a.totalScholars; });
}