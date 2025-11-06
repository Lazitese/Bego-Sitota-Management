# Cloudflare R2 File Upload Deployment Guide

This guide explains how to deploy the file upload functionality using Cloudflare R2 and Supabase Edge Functions.

## Prerequisites

1. Cloudflare R2 bucket created
2. R2 Access Key ID and Secret Access Key
3. Supabase project with Edge Functions enabled

## Step 1: Create Cloudflare R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2 Object Storage**
3. Create a new bucket named `bego` (this is already configured in the Edge Function)
4. **Important**: Set up a public domain for the bucket (in R2 settings) to enable public file access

## Step 2: Configure R2 Public Domain

1. In your R2 bucket settings, enable **Public Access**
2. Set up a custom domain or use the default R2 public URL
3. Update the `R2_PUBLIC_URL` constant in `supabase/functions/upload-to-r2/index.ts` with your actual public domain

Example:
- If your bucket is `ngo-documents` and public domain is `pub-ngo-documents.r2.dev`, the URL would be: `https://pub-ngo-documents.r2.dev`

## Step 3: Deploy Edge Function

Using Supabase CLI:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the Edge Function
supabase functions deploy upload-to-r2
```

Or using Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions**
3. Click **Create a new function**
4. Name it `upload-to-r2`
5. Copy the contents of `supabase/functions/upload-to-r2/index.ts`
6. Set environment variables:
   - `R2_ACCESS_KEY_ID`: `656ccb3672b95e050d6473184aa1f5a4`
   - `R2_SECRET_ACCESS_KEY`: `5142f19f498dab351d294bf13b8d87a32ddfc927c069e7ed2ce6d1f551672812`
   - (Optional) `R2_PUBLIC_URL`: Your R2 public domain URL

## Step 4: Update Database Schema

Make sure your database tables have the correct columns for storing file URLs:

- `weekly_volunteer_reports.supporting_documents` - Array of URLs (text[])
- `academic_reports.file_url` - Single URL (text) 
- `tuition_receipts.file_url` - Single URL (text)

**Note**: The Edge Function has been deployed successfully. The bucket name is set to `bego`.

## Step 5: Test the Upload

1. Start your React development server:
   ```bash
   npm run dev
   ```

2. Log in as a student
3. Navigate to **Weekly Reports**, **Academic Reports**, or **Tuition Receipts**
4. Try uploading a file
5. Check the browser console for any errors
6. Verify the file appears in your Cloudflare R2 bucket

## Troubleshooting

### File upload fails with 401 Unauthorized
- Check that the Authorization header is being sent correctly
- Verify the user is logged in and has a valid session

### File upload fails with 500 Internal Server Error
- Check Edge Function logs in Supabase dashboard
- Verify R2 credentials are correct
- Ensure the R2 bucket exists and is accessible

### Files uploaded but URLs are not accessible
- Verify R2 public domain is configured correctly
- Update `R2_PUBLIC_URL` in the Edge Function with the correct domain
- Check R2 bucket public access settings

### Edge Function deployment fails
- Ensure Supabase CLI is installed and authenticated
- Check that your project has Edge Functions enabled
- Verify the function code syntax is correct

## Security Notes

1. **Credentials**: The R2 credentials are currently hardcoded in the Edge Function. For production:
   - Store credentials as environment variables in Supabase
   - Use Supabase Secrets: `supabase secrets set R2_ACCESS_KEY_ID=your_key`
   - Never commit credentials to version control

2. **Authentication**: The Edge Function verifies the user's Supabase JWT token before allowing uploads

3. **File Size Limits**: Consider adding file size limits in the Edge Function (e.g., max 10MB per file)

4. **File Type Validation**: The frontend accepts specific file types, but you may want to add server-side validation in the Edge Function

## Next Steps

- Set up file deletion functionality for rejected/replaced submissions
- Implement file access controls based on user roles
- Add file preview functionality in the frontend
- Set up automatic cleanup of old/unused files

