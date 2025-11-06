# Cloudflare R2 File Upload Setup

## Quick Start

The file upload functionality has been implemented using Cloudflare R2 storage. Files are uploaded through a Supabase Edge Function and URLs are stored in the database.

## Files Created

1. **`supabase/functions/upload-to-r2/index.ts`** - Edge Function for uploading files to R2
2. **`src/lib/upload.js`** - Frontend utility for calling the Edge Function
3. **`DEPLOYMENT.md`** - Detailed deployment instructions

## What's Implemented

✅ Student Dashboard:
- Weekly Reports with multiple file uploads (supporting documents)
- Academic Reports with file upload
- Tuition Receipts with file upload

✅ File Upload Features:
- Files uploaded to Cloudflare R2
- URLs stored in Supabase database
- Loading states during upload
- Error handling

## Next Steps

1. **Deploy the Edge Function**:
   ```bash
   supabase functions deploy upload-to-r2
   ```

2. **Set Environment Variables** (optional, credentials are hardcoded):
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_PUBLIC_URL` (update with your actual public domain)

3. **Update R2 Public URL**:
   - In `supabase/functions/upload-to-r2/index.ts`, update `R2_PUBLIC_URL` with your actual Cloudflare R2 public domain
   - This is where uploaded files will be publicly accessible

4. **Create R2 Bucket** (if not already created):
   - Name: `bego` (already configured in the Edge Function)
   - Enable public access
   - Set up a public domain

## Important Notes

⚠️ **AWS Signature v4**: The current implementation uses a simplified authentication approach. For production, you may need to implement full AWS Signature v4 signing for R2 uploads.

⚠️ **Public URL**: Make sure to update `R2_PUBLIC_URL` in the Edge Function with your actual Cloudflare R2 public domain.

⚠️ **Credentials**: Currently, credentials are hardcoded. For production, move them to environment variables using Supabase Secrets.

## Testing

1. Start the development server: `npm run dev`
2. Log in as a student
3. Navigate to Weekly Reports, Academic Reports, or Tuition Receipts
4. Try uploading a file
5. Check browser console for errors
6. Verify file appears in Cloudflare R2 bucket

## Troubleshooting

- **401 Unauthorized**: Check user session is valid
- **500 Internal Server Error**: Check Edge Function logs, verify R2 credentials
- **Files not accessible**: Verify R2 public domain is configured correctly

See `DEPLOYMENT.md` for detailed instructions.

