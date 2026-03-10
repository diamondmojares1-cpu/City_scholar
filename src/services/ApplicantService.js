// services/ApplicantService.js
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

/**
 * @param {"New Applicant" | "Returning Applicant"} applicantType
 * - Pass "New Applicant"      → for the Applicants page
 * - Pass "Returning Applicant" → for the Renewal page
 */
export async function fetchApplicantsFromFirebase(applicantType = "New Applicant") {

    // STEP 1: Fetch all student users
    let usersSnap;
    try {
        usersSnap = await getDocs(collection(db, "users"));
    } catch (err) {
        console.error("Failed to fetch users:", err.message);
        throw err;
    }

    const applicants = [];

    usersSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();

        if (data.role !== "student") return;

        const rawStatus =
            data.applicationStatus || data.scholarshipStatus || "pending";

        if (rawStatus === "approved") return;

        applicants.push({
            id: docSnap.id,
            name: data.fullName || "—",
            email: data.email || "—",
            school: data.course || "—",
            gpa: data.gpa != null ? data.gpa : "—",
            yearLevel: data.yearLevel || "—",
            barangay: data.barangay || "—",
            dateSubmitted: data.createdAt ?
                new Date(data.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" }) :
                "—",
            status: rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1),
            scholarshipApplication: null,
        });
    });

    // STEP 2: Fetch scholarship applications
    try {
        const appSnap = await getDocs(collection(db, "scholarship_applications"));
        const appsByUser = {};

        appSnap.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const docs = data.documents || {};

            const userId = data.userId || data.uid || data.studentId || docSnap.id;

            const personal = data.personalInfo || {};
            const edu = data.educationInfo || {};
            const financial = data.financialInfo || {};

            appsByUser[userId] = {
                id: docSnap.id,

                personalInfo: {
                    firstName: personal.firstName || "—",
                    middleName: personal.middleName || "—",
                    lastName: personal.lastName || "—",
                    email: personal.email || "—",
                    contactNumber: personal.contactNumber || "—",
                    dateOfBirth: personal.dateOfBirth || "—",
                    barangay: personal.barangay || "—",
                    houseNo: personal.houseNo || "—",
                    address: personal.address || "—",
                },

                educationInfo: {
                    applicantType: edu.applicantType || "—",
                    schoolName: edu.schoolName || "—",
                    course: edu.course || "—",
                    yearLevel: edu.yearLevel || "—",
                    studentId: edu.studentId || "—",
                    gwa: edu.gwa || "—",
                },

                financialInfo: {
                    fatherName: financial.fatherName || "—",
                    fatherOccupation: financial.fatherOccupation || "—",
                    fatherIncome: financial.fatherIncome || "—",
                    motherName: financial.motherName || "—",
                    motherOccupation: financial.motherOccupation || "—",
                    motherIncome: financial.motherIncome || "—",
                    totalIncome: financial.totalIncome || "—",
                    annualIncome: financial.annualIncome || "—",
                },

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

        applicants.forEach((applicant) => {
            if (appsByUser[applicant.id]) {
                applicant.scholarshipApplication = appsByUser[applicant.id];
            }
        });

    } catch (err) {
        console.error("Failed to fetch scholarship_applications:", err.message);
    }

    // STEP 3: Filter by applicantType — only show applicants whose
    // scholarship application matches the requested type.
    // Applicants with no scholarship application are excluded since
    // their type cannot be determined.
    const filtered = applicants.filter((applicant) => {
        const type = applicant.scholarshipApplication?.educationInfo?.applicantType;
        return type === applicantType;
    });

    // STEP 4: Sort newest first
    return filtered.sort((a, b) => {
        const aTime = a.dateSubmitted === "—" ? 0 : new Date(a.dateSubmitted).getTime();
        const bTime = b.dateSubmitted === "—" ? 0 : new Date(b.dateSubmitted).getTime();
        return bTime - aTime;
    });
}