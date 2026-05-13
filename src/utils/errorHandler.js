/**
 * errorHandler.js — MediFlow Backend Error Parser
 *
 * The backend returns every response in this ApiResponse envelope:
 * {
 *   success   : boolean,
 *   message   : "Human readable description",
 *   data      : T | null,
 *   errors    : { "fieldName": "validation message" },   ← only on 400
 *   timestamp : "2026-05-08T14:30:45.123"
 * }
 *
 * HTTP status → exception class mapping (from GlobalExceptionHandler.java):
 *   400 → MethodArgumentNotValidException / ConstraintViolationException  (field errors present)
 *   404 → ResourceNotFoundException subclasses
 *   409 → ResourceAlreadyExistsException subclasses
 *   422 → BusinessRuleViolationException
 *   500 → generic Exception (catch-all)
 *
 * This module converts that into a display-ready object so every UI
 * component handles errors the same way.
 *
 * @project MediFlow Hospital Management System
 */

/**
 * Parse a caught API error into a display-ready structure.
 *
 * Usage (inside a try/catch wrapping apiService calls):
 *   catch (err) {
 *     setApiError(parseApiError(err));
 *   }
 *
 * @param {Error} error - Error thrown by apiService (has .response.status & .response.data)
 * @returns {{ message: string, errors: Object.<string,string>, status: number }}
 */
export const parseApiError = (error) => {
  // No response means a network / CORS / server-down failure
  if (!error.response) {
    return {
      message: 'Cannot connect to server. Please check your connection or try again.',
      errors: {},
      status: 0,
    };
  }

  const { status, data } = error.response;

  // data is the ApiResponse envelope from the backend
  const backendMessage = data?.message || 'An unexpected error occurred.';
  const fieldErrors   = data?.errors   || {};   // { email: "...", phone: "..." }

  // Provide extra-friendly messages for auth-related statuses
  const statusOverrides = {
    401: 'Your session has expired. Please sign in again.',
    403: 'You do not have permission to perform this action.',
    503: 'Service temporarily unavailable. Please try again in a moment.',
    500: 'Internal server error. Please contact IT support if this persists.',
  };

  return {
    message: statusOverrides[status] ?? backendMessage,
    errors:  fieldErrors,   // pass to form so fields can highlight themselves
    status,
  };
};

/**
 * Returns true when the error contains field-level validation messages
 * (i.e., backend returned HTTP 400 with the `errors` map populated).
 *
 * @param {{ errors: Object }} parsedError
 * @returns {boolean}
 */
export const hasFieldErrors = (parsedError) =>
  !!parsedError?.errors && Object.keys(parsedError.errors).length > 0;

/**
 * Extract the error string for a specific form field from a parsed error.
 * Returns null when the field has no backend error.
 *
 * Usage:
 *   const emailErr = getFieldError(apiError, 'email');
 *
 * @param {{ errors: Object.<string,string> }} parsedError
 * @param {string} fieldName  - Exactly as the backend key (e.g. 'email', 'phoneNumber')
 * @returns {string | null}
 */
export const getFieldError = (parsedError, fieldName) =>
  parsedError?.errors?.[fieldName] ?? null;
