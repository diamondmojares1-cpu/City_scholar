// services/ApplicantService.js
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export async function fetchApplicantsFromFirebase() {

    // ─────────────────────────────────────────────────────────
    // STEP 1: Fetch all student users from "users" collection
    // ─────────────────────────────────────────────────────────
    let usersSnap;
    try {
        usersSnap = await getDocs(collection(db, "users"));
        console.log("✅ users fetched:", usersSnap.docs.length);
    } catch (err) {
        console.error("❌ Failed to fetch users:", err.code, err.message);
        throw err;
    }

    const applicants = [];

    usersSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();

        // FIX: Skip admin accounts only — include users with no role field (students)
        if (data.role === "admin") return;

        const rawStatus =
            data.applicationStatus || data.scholarshipStatus || "pending";

        if (rawStatus === "approved") return;

        // FIX: Support both fullName and firstName+lastName
        const name =
            data.fullName ||
            `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
            "—";

        applicants.push({
            id: docSnap.id,
            name,
            email: data.email || "—",
            school: data.course || "—",
            gpa: data.gpa != null ? data.gpa : "—",
            yearLevel: data.yearLevel || "—",
            barangay: data.barangay || "—",
            dateSubmitted: data.createdAt ?
                new Date(data.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—",
            status: rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1),
            scholarshipApplication: null,
        });
    });

    console.log("✅ student applicants found:", applicants.length);

    // ─────────────────────────────────────────────────────────
    // STEP 2: Fetch scholarship applications and merge
    // ─────────────────────────────────────────────────────────
    try {
        const appSnap = await getDocs(collection(db, "scholarship_applications"));
        console.log("✅ scholarship_applications fetched:", appSnap.docs.length);

        const appsByUser = {};

        appSnap.docs.forEach((docSnap) => {
            const data = docSnap.data();

            const userId = data.userId || data.uid || data.studentId || docSnap.id;

            console.log("📄 app doc id:", docSnap.id, "| userId field:", data.userId);

            const docs = data.documents || {};

            appsByUser[userId] = {
                id: docSnap.id,

                // ── Personal Information ──────────────────────────
                personalInfo: {
                    firstName: data.personalInfo ? .firstName || data.firstName || "—",
                    middleName: data.personalInfo ? .middleName || data.middleName || "—",
                    lastName: data.personalInfo ? .lastName || data.lastName || "—",
                    email: data.personalInfo ? .email || data.email || "—",
                    contactNumber: data.personalInfo ? .contactNumber || data.contactNumber || "—",
                    dateOfBirth: data.personalInfo ? .dateOfBirth || data.dateOfBirth || "—",
                    barangay: data.personalInfo ? .barangay || data.barangay || "—",
                    houseNo: data.personalInfo ? .houseNo || data.houseNo || "—",
                    address: data.personalInfo ? .address || data.address || "—",
                },

                // ── Education Information ─────────────────────────
                educationInfo: {
                    applicantType: data.educationInfo ? .applicantType || data.applicantType || "—",
                    schoolName: data.educationInfo ? .schoolName || data.schoolName || "—",
                    course: data.educationInfo ? .course || data.course || "—",
                    yearLevel: data.educationInfo ? .yearLevel || data.yearLevel || "—",
                    studentId: data.educationInfo ? .studentId || data.studentId || "—",
                    gwa: data.educationInfo ? .gwa || data.gwa || "—",
                },

                // ── Financial Information ─────────────────────────
                financialInfo: {
                    fatherName: data.financialInfo ? .fatherName || data.fatherName || "—",
                    fatherOccupation: data.financialInfo ? .fatherOccupation || data.fatherOccupation || "—",
                    fatherIncome: data.financialInfo ? .fatherIncome || data.fatherIncome || "—",
                    motherName: data.financialInfo ? .motherName || data.motherName || "—",
                    motherOccupation: data.financialInfo ? .motherOccupation || data.motherOccupation || "—",
                    motherIncome: data.financialInfo ? .motherIncome || data.motherIncome || "—",
                    totalIncome: data.financialInfo ? .totalIncome || data.totalIncome || "—",
                    annualIncome: data.financialInfo ? .annualIncome || data.annualIncome || "—",
                },

                // ── Uploaded File URLs ────────────────────────────
                coeUrl: docs.coeUrl || data.coeUrl || "",
                gradesUrl: docs.gradesUrl || data.gradesUrl || "",
                indigencyUrl: docs.indigencyUrl || data.indigencyUrl || "",
                itrUrl: docs.itrUrl || data.itrUrl || "",
                residencyUrl: docs.residencyUrl || data.residencyUrl || "",
                photoUrl: docs.photoUrl || data.photoUrl || "",
                birthCertUrl: docs.birthCertUrl || data.birthCertUrl || "",
                goodMoralUrl: docs.goodMoralUrl || data.goodMoralUrl || "",
                validIdUrl: docs.validIdUrl || data.validIdUrl || "",
            };
        });

        // Merge application into matching applicant by userId
        applicants.forEach((applicant) => {
            if (appsByUser[applicant.id]) {
                applicant.scholarshipApplication = appsByUser[applicant.id];
                console.log("🔗 merged:", applicant.name);
            } else {
                console.log("ℹ️ no application for:", applicant.name, "| id:", applicant.id);
            }
        });

    } catch (err) {
        console.error("❌ Failed to fetch scholarship_applications:", err.code, err.message);
        // Non-fatal — table loads, modal shows "no application yet"
    }

    // ─────────────────────────────────────────────────────────
    // STEP 3: Sort newest first
    // ─────────────────────────────────────────────────────────
    return applicants.sort((a, b) => {
        const aTime = a.dateSubmitted === "—" ? 0 : new Date(a.dateSubmitted).getTime();
        const bTime = b.dateSubmitted === "—" ? 0 : new Date(b.dateSubmitted).getTime();
        return bTime - aTime;
    });
}