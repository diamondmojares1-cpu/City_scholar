// services/studentService.js
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

/**
 * Fetch all student records from Firebase.
 * Merges data from "users" and "scholarship_applications".
 * Status is checked from BOTH collections so approved renewals appear correctly.
 */
export async function fetchStudentRecords() {
    const [usersSnap, appSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "scholarship_applications")),
    ]);

    // Map applications by userId — take the LATEST one per user
    const appsByUser = {};
    appSnap.docs.forEach(function(docSnap) {
        var data = docSnap.data();
        var userId = data.userId || data.uid || data.studentId || docSnap.id;

        // If user has multiple apps, keep the most recently updated one
        var existing = appsByUser[userId];
        var newTime = data.updatedAt || data.submittedAt || 0;
        var oldTime = existing ? (existing._updatedAt || 0) : -1;

        if (!existing || newTime > oldTime) {
            appsByUser[userId] = Object.assign({}, data, { _appId: docSnap.id, _updatedAt: newTime });
        }
    });

    var students = [];

    usersSnap.docs.forEach(function(docSnap) {
        var data = docSnap.data();

        if (data.role === "admin") return;

        var app = appsByUser[docSnap.id] || {};
        var personalInfo = app.personalInfo || {};
        var eduInfo = app.educationInfo || {};

        var barangay =
            data.barangay ||
            personalInfo.barangay ||
            app.barangay ||
            "Unknown";

        var firstName = data.firstName || personalInfo.firstName || "";
        var lastName = data.lastName || personalInfo.lastName || "";
        var fullName =
            data.fullName ||
            (firstName + " " + lastName).trim() ||
            "—";

        // ── Status resolution ──────────────────────────────────────
        // Check scholarship_applications status first (most up-to-date after renewal approval)
        // then fall back to users collection fields
        var rawStatus = (
            app.status ||
            data.applicationStatus ||
            data.scholarshipStatus ||
            "pending"
        ).toLowerCase();

        students.push({
            id: docSnap.id,
            fullName: fullName,
            firstName: firstName,
            lastName: lastName,
            email: data.email || personalInfo.email || "—",
            barangay: barangay.trim() || "Unknown",
            course: data.course || eduInfo.course || "—",
            yearLevel: data.yearLevel || eduInfo.yearLevel || "—",
            gwa: data.gpa || eduInfo.gwa || "—",
            status: rawStatus,
        });
    });

    return students;
}

/**
 * Group students by barangay and count total scholars per barangay.
 * Only counts APPROVED scholars.
 * Returns array sorted by totalScholars descending.
 */
export function groupStudentsByBarangay(students) {
    var map = {};

    // Only count approved scholars for barangay overview
    var approved = students.filter(function(s) {
        return (s.status || "").toLowerCase() === "approved";
    });

    approved.forEach(function(student) {
        var brgy = student.barangay || "Unknown";
        if (!map[brgy]) {
            map[brgy] = { name: brgy, totalScholars: 0, students: [] };
        }
        map[brgy].totalScholars += 1;
        map[brgy].students.push(student);
    });

    return Object.values(map).sort(function(a, b) { return b.totalScholars - a.totalScholars; });
}