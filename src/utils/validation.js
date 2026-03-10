// src/utils/validation.js

export const isValidName = (name) => {
    return name.trim().length >= 2;
};

export const isGmail = (email) => {
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    return gmailRegex.test(email);
};

export const isValidPassword = (password) => {
    const passwordRegex =
        /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&#]).{8,}$/;
    return passwordRegex.test(password);
};

export const isValidOtp = (otp) => {
    return /^\d{6}$/.test(otp);
};