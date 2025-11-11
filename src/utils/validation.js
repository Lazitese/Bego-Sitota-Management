/**
 * Input validation utilities for security
 */

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Phone validation regex (allows various formats)
const PHONE_REGEX = /^[\d\s\-\+\(\)]+$/

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false
  return EMAIL_REGEX.test(email.trim())
}

/**
 * Validates phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid
 */
export const isValidPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false
  const cleaned = phone.replace(/\s/g, '')
  return cleaned.length >= 10 && cleaned.length <= 15 && PHONE_REGEX.test(phone)
}

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {object} - { valid: boolean, message: string }
 */
export const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' }
  }
  if (password.length > 128) {
    return { valid: false, message: 'Password must be less than 128 characters' }
  }
  return { valid: true, message: '' }
}

/**
 * Sanitizes string input to prevent XSS
 * @param {string} input - Input to sanitize
 * @returns {string} - Sanitized string
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers (onclick, onerror, etc.)
    .replace(/&#/g, '') // Remove HTML entities
    .trim()
    .slice(0, 1000) // Limit length
}

/**
 * Validates role
 * @param {string} role - Role to validate
 * @returns {boolean} - True if valid role
 */
export const isValidRole = (role) => {
  const validRoles = ['admin', 'donor', 'mentor', 'student']
  return validRoles.includes(role)
}

/**
 * Validates full name
 * @param {string} name - Name to validate
 * @returns {boolean} - True if valid
 */
export const isValidName = (name) => {
  if (!name || typeof name !== 'string') return false
  const trimmed = name.trim()
  return trimmed.length >= 2 && trimmed.length <= 100
}

/**
 * Validates numeric amount
 * @param {string|number} amount - Amount to validate
 * @returns {boolean} - True if valid
 */
export const isValidAmount = (amount) => {
  if (amount === null || amount === undefined || amount === '') return true // Optional field
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return !isNaN(num) && num >= 0 && num <= 1000000
}

