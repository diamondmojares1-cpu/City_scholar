export function getRawStatus(raw) {
  return (
    raw.status ||
    raw.applicationStatus ||
    raw.scholarshipStatus ||
    raw.renewalStatus ||
    raw.approvalStatus ||
    ""
  ).toString().toLowerCase().trim();
}

export function getApplicantType(raw, eduInfo) {
  return (
    raw.applicantType ||
    eduInfo?.applicantType ||
    raw.type ||
    ""
  ).toString().trim();
}

export function parseScholarApplication(docSnap) {
  const data = docSnap.data();
  const personal = data.personalInfo || {};
  const edu = data.educationInfo || {};
  const financial = data.financialInfo || {};
  const docs = data.documents || {};
  const applicantType = getApplicantType(data, edu);
  const originalApplicantType =
    (
      data.originalApplicantType ||
      data.previousApplicantType ||
      (data.promoted === true ? "" : applicantType)
    ).toString().trim();

  const firstName =
    personal.firstName ||
    data.firstName ||
    (data.name || "").split(" ")[0] ||
    "";
  const lastName =
    personal.lastName ||
    data.lastName ||
    (data.name || "").split(" ").slice(1).join(" ") ||
    "";

  return {
    id: docSnap.id,
    firstName,
    lastName,
    fullName: data.name || (firstName + " " + lastName).trim() || "-",
    email: personal.email || data.email || "-",
    contactNumber: personal.contactNumber || data.contactNumber || data.contact || "-",
    dateOfBirth: personal.dateOfBirth || data.dateOfBirth || "-",
    barangay: personal.barangay || data.barangay || "-",
    houseNo: personal.houseNo || data.houseNo || "-",
    middleName: personal.middleName || data.middleName || "-",
    applicantType,
    originalApplicantType,
    schoolName: edu.schoolName || data.schoolName || data.school || "-",
    course: edu.course || data.course || "-",
    semester: edu.semester || data.semester || "-",
    yearLevel: edu.yearLevel || data.yearLevel || "-",
    studentId: edu.studentId || data.studentId || "-",
    gwa: edu.gwa || data.gwa || data.gpa || "-",
    fatherName: financial.fatherName || data.fatherName || "-",
    fatherOccupation: financial.fatherOccupation || data.fatherOccupation || "-",
    fatherIncome: financial.fatherIncome || data.fatherIncome || "-",
    motherName: financial.motherName || data.motherName || "-",
    motherOccupation: financial.motherOccupation || data.motherOccupation || "-",
    motherIncome: financial.motherIncome || data.motherIncome || "-",
    totalIncome: financial.totalIncome || financial.annualIncome || data.totalIncome || "-",
    coeUrl: docs.coeUrl || data.coeUrl || "",
    gradesUrl: docs.gradesUrl || data.gradesUrl || "",
    indigencyUrl: docs.indigencyUrl || data.indigencyUrl || "",
    itrUrl: docs.itrUrl || data.itrUrl || "",
    residencyUrl: docs.residencyUrl || data.residencyUrl || "",
    photoUrl: docs.photoUrl || data.photoUrl || "",
    birthCertUrl: docs.birthCertUrl || data.birthCertUrl || "",
    goodMoralUrl: docs.goodMoralUrl || data.goodMoralUrl || "",
    validIdUrl: docs.validIdUrl || data.validIdUrl || "",
    status: getRawStatus(data),
    submittedAt: data.submittedAt || data.createdAt || data.dateSubmitted || 0,
    promoted: data.promoted || false,
    renewalAccess: data.renewalAccess || false,
    userId: data.userId || data.uid || docSnap.id,
    _raw: data,
  };
}

export function isReturningApplicant(applicantType) {
  const type = (applicantType || "").toLowerCase().trim();
  return (
    type.includes("returning") ||
    type.includes("renewal") ||
    type.includes("renewing") ||
    type.includes("old")
  );
}

export function filterScholars(list, searchQuery) {
  const query = (searchQuery || "").toLowerCase().trim();
  if (!query) return list;

  return list.filter((scholar) =>
    (scholar.fullName || "").toLowerCase().includes(query) ||
    (scholar.course || "").toLowerCase().includes(query) ||
    (scholar.semester || "").toLowerCase().includes(query) ||
    (scholar.schoolName || "").toLowerCase().includes(query)
  );
}
