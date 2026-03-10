// services/scholarshipApplicationService.js
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

/**
 * Fetch ALL scholarship applications from "scholarship_applications" collection.
 *
 * Firestore structure (from screenshot):
 *   scholarship_applications/
 *     └── {docId}/
 *           ├── documents/
 *           │     ├── coeUrl
 *           │     ├── gradesUrl
 *           │     ├── indigencyUrl
 *           │     ├── itrUrl
 *           │     └── residencyUrl
 *           ├── personalInfo/  { firstName, lastName, ... }
 *           ├── educationInfo/ { course, gwa, ... }
 *           └── financialInfo/ { fatherName, ... }
 *
 * @returns {Promise<Array>} Array of normalized application objects
 */
export async function fetchScholarshipApplications() {
    const snap = await getDocs(collection(db, "scholarship_applications"));

    return snap.docs.map((d) => {
        const data = d.data();

        const personal = data.personalInfo || {};
        const edu = data.educationInfo || {};
        const financial = data.financialInfo || {};

        // ── File URLs are nested inside "documents" object ──
        const docs = data.documents || {};

        return {
            id: d.id,

            // ── Personal Information ──────────────────────────
            personalInfo: personal,
            firstName: personal.firstName || "—",
            middleName: personal.middleName || "—",
            lastName: personal.lastName || "—",
            email: personal.email || "—",
            contactNumber: personal.contactNumber || "—",
            dateOfBirth: personal.dateOfBirth || "—",
            barangay: personal.barangay || "—",
            houseNo: personal.houseNo || "—",
            address: personal.address || "—",

            // ── Education Information ─────────────────────────
            educationInfo: edu,
            applicantType: edu.applicantType || "—",
            course: edu.course || "—",
            gwa: edu.gwa || "—",
            schoolName: edu.schoolName || "—",
            studentId: edu.studentId || "—",
            yearLevel: edu.yearLevel || "—",

            // ── Financial Information ─────────────────────────
            financialInfo: financial,
            fatherName: financial.fatherName || "—",
            fatherIncome: financial.fatherIncome || "—",
            fatherOccupation: financial.fatherOccupation || "—",
            motherName: financial.motherName || "—",
            motherIncome: financial.motherIncome || "—",
            motherOccupation: financial.motherOccupation || "—",
            totalIncome: financial.totalIncome || "—",
            annualIncome: financial.annualIncome || "—",

            // ── Uploaded File URLs ────────────────────────────
            // Checks inside "documents" object first, then top-level as fallback
            coeUrl: docs.coeUrl || data.coeUrl || "",
            gradesUrl: docs.gradesUrl || data.gradesUrl || "",
            indigencyUrl: docs.indigencyUrl || data.indigencyUrl || "",
            itrUrl: docs.itrUrl || data.itrUrl || "",
            residencyUrl: docs.residencyUrl || data.residencyUrl || "",
            photoUrl: docs.photoUrl || data.photoUrl || "",
            birthCertUrl: docs.birthCertUrl || data.birthCertUrl || "",
            goodMoralUrl: docs.goodMoralUrl || data.goodMoralUrl || "",
            validIdUrl: docs.validIdUrl || data.validIdUrl || "",

            // ── Meta ──────────────────────────────────────────
            userId: data.userId || null,
            status: data.status || "pending",

            // Raw data for debugging
            _raw: data,
        };
    });
}