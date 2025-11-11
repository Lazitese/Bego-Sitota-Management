import { supabaseUrl, supabase } from './supabase'
import imageCompression from 'browser-image-compression'

/**
 * Upload a file to Cloudflare R2 via Edge Function with optional image compression
 * @param {File} file - The file to upload
 * @param {string} folder - Optional folder path (e.g., 'weekly-reports', 'academic-reports', 'tuition-receipts')
 * @param {Object} options - Optional compression options for images
 * @param {number} options.maxSizeMB - Maximum file size in MB (default: 1)
 * @param {number} options.maxWidthOrHeight - Maximum dimension in pixels (default: 1920)
 * @param {number} options.quality - Image quality 0-1 (default: 0.8, 0.8 = 80% quality)
 * @param {boolean} options.useWebWorker - Use web worker for compression (default: true)
 * @returns {Promise<{url: string, path: string, fileName: string, size: number}>}
 */
// Allowed file types for security
const ALLOWED_FILE_TYPES = {
  'weekly-reports': ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
  'academic-reports': ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
  'tuition-receipts': ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function uploadToR2(file, folder = null, options = {}) {
  try {
    // Validate file exists
    if (!file || !(file instanceof File)) {
      throw new Error('Invalid file provided')
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
    }

    // Validate file type if folder is specified
    if (folder && ALLOWED_FILE_TYPES[folder]) {
      if (!ALLOWED_FILE_TYPES[folder].includes(file.type)) {
        throw new Error(`File type not allowed. Allowed types: ${ALLOWED_FILE_TYPES[folder].join(', ')}`)
      }
    }

    // Get current session for authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      throw new Error('Not authenticated. Please log in.')
    }

    let fileToUpload = file
    const originalSize = file.size

    // Compress images if it's an image file
    if (file.type.startsWith('image/')) {
      const compressionOptions = {
        maxSizeMB: options.maxSizeMB || 1, // Default: 1MB
        maxWidthOrHeight: options.maxWidthOrHeight || 1920, // Default: 1920px
        quality: options.quality || 0.8, // Default: 80% quality (0.8)
        useWebWorker: options.useWebWorker !== false, // Default: true
        fileType: file.type, // Preserve original file type
      }

      try {
        // Only log in development mode
        if (import.meta.env.DEV) {
          console.log('Compressing image...', {
            originalSize: (originalSize / 1024 / 1024).toFixed(2) + ' MB',
            quality: compressionOptions.quality,
            maxSizeMB: compressionOptions.maxSizeMB,
          })
        }

        fileToUpload = await imageCompression(file, compressionOptions)

        if (import.meta.env.DEV) {
          const compressedSize = fileToUpload.size
          const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1)
          console.log('Image compressed successfully!', {
            originalSize: (originalSize / 1024 / 1024).toFixed(2) + ' MB',
            compressedSize: (compressedSize / 1024 / 1024).toFixed(2) + ' MB',
            compressionRatio: compressionRatio + '%',
            quality: compressionOptions.quality,
          })
        }
      } catch (compressionError) {
        // Only log in development mode
        if (import.meta.env.DEV) {
          console.warn('Image compression failed, uploading original file:', compressionError)
        }
        fileToUpload = file
      }
    }

    // Create FormData
    const formData = new FormData()
    formData.append('file', fileToUpload)
    if (folder) {
      formData.append('folder', folder)
    }

    // Call Edge Function
    const response = await fetch(`${supabaseUrl}/functions/v1/upload-to-r2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to upload file')
    }

    return result
  } catch (error) {
    // Only log detailed errors in development mode
    if (import.meta.env.DEV) {
      console.error('Error uploading file to R2:', error)
    }
    // Don't expose internal error details in production
    throw new Error(error.message || 'Failed to upload file. Please try again.')
  }
}

