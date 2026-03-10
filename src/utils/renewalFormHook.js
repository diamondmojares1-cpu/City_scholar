/**
 * RENEWAL FORM HOOK - Example for Mobile App
 * 
 * This file shows how to use the renewalDataFetch functions
 * in a mobile renewal form component.
 * 
 * Usage: Import functions from ../../utils/renewalDataFetch
 */

import { useState } from "react-native";
import {
    submitRenewalApplication,
    validateRenewalForm,
    checkRenewalEligibility,
} from "./utils/renewalDataFetch";

/**
 * Example: useRenewalForm hook for mobile renewal form
 *
 * @param {string} userId - Current logged-in student ID
 * @returns {Object} Form state and handlers
 */
export function useRenewalForm(userId) {
    const [formData, setFormData] = useState({
        fullName: "",
        course: "",
        yearLevel: "",
        gpa: "",
        currentStatus: "active",
        renewalReason: "",
        documents: [],
    });

    const [errors, setErrors] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    /**
     * Update form field
     */
    const updateField = (fieldName, value) => {
        setFormData((prev) => ({
            ...prev,
            [fieldName]: value,
        }));
    };

    /**
     * Submit renewal form
     */
    const submitForm = async(e) => {
        e.preventDefault();
        setErrors([]);
        setSuccess(false);

        // Validate form
        const validation = validateRenewalForm(formData);
        if (!validation.isValid) {
            setErrors(validation.errors);
            return;
        }

        setSubmitting(true);

        try {
            // Submit to Firestore
            const result = await submitRenewalApplication(userId, formData);

            setSuccess(true);
            setFormData({
                fullName: "",
                course: "",
                yearLevel: "",
                gpa: "",
                currentStatus: "active",
                renewalReason: "",
                documents: [],
            });

            console.log("Renewal submitted:", result);
            return result;
        } catch (err) {
            console.error("Submission error:", err);
            setErrors([err.message || "Failed to submit renewal"]);
        } finally {
            setSubmitting(false);
        }
    };

    return {
        formData,
        errors,
        submitting,
        success,
        updateField,
        submitForm,
    };
}

/**
 * Example: Renewal Form Component (React)
 * 
 * import { useRenewalForm } from "./renewalFormHook";
 * 
 * function RenewalForm({ userId }) {
 *   const { formData, errors, submitting, success, updateField, submitForm } = 
 *     useRenewalForm(userId);
 * 
 *   return (
 *     <form onSubmit={submitForm}>
 *       <input
 *         type="text"
 *         placeholder="Full Name"
 *         value={formData.fullName}
 *         onChange={(e) => updateField("fullName", e.target.value)}
 *       />
 *       <input
 *         type="text"
 *         placeholder="Course"
 *         value={formData.course}
 *         onChange={(e) => updateField("course", e.target.value)}
 *       />
 *       <select
 *         value={formData.yearLevel}
 *         onChange={(e) => updateField("yearLevel", e.target.value)}
 *       >
 *         <option value="">Select Year Level</option>
 *         <option value="1st Year">1st Year</option>
 *         <option value="2nd Year">2nd Year</option>
 *         <option value="3rd Year">3rd Year</option>
 *         <option value="4th Year">4th Year</option>
 *       </select>
 *       <input
 *         type="number"
 *         placeholder="GPA"
 *         step="0.01"
 *         min="0"
 *         max="4.0"
 *         value={formData.gpa}
 *         onChange={(e) => updateField("gpa", e.target.value)}
 *       />
 *       <textarea
 *         placeholder="Reason for renewal (min 10 characters)"
 *         value={formData.renewalReason}
 *         onChange={(e) => updateField("renewalReason", e.target.value)}
 *       />
 * 
 *       {errors.length > 0 && (
 *         <div className="error-list">
 *           {errors.map((err, i) => <p key={i}>{err}</p>)}
 *         </div>
 *       )}
 * 
 *       {success && <p className="success">Renewal submitted successfully!</p>}
 * 
 *       <button type="submit" disabled={submitting}>
 *         {submitting ? "Submitting..." : "Submit Renewal"}
 *       </button>
 *     </form>
 *   );
 * }
 */

/**
 * Example: Check eligibility before renewal
 * 
 * const lastRenewalDate = new Date("2023-01-15").getTime();
 * const eligibility = checkRenewalEligibility(lastRenewalDate, 12); // 12 months period
 * 
 * if (eligibility.eligible) {
 *   // Show renewal form
 * } else {
 *   // Show: "You can renew in X days"
 * }
 */

export default useRenewalForm;