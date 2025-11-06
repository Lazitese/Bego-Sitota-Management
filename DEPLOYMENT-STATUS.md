# Deployment Status

## ✅ Edge Function Deployed Successfully

**Function Name**: `upload-to-r2`  
**Status**: ACTIVE  
**Version**: 1  
**Project ID**: qysppoichxcgticleyit

## Configuration

- **Bucket Name**: `bego`
- **R2 Endpoint**: `fbf4e26a9ecfa302766bd7ca85118373.r2.cloudflarestorage.com`
- **Public URL**: `https://pub-bego.r2.dev` (update if you have a custom domain)

## Next Steps

1. **Verify R2 Bucket Setup**:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Navigate to **R2 Object Storage**
   - Ensure bucket `bego` exists
   - Enable public access if not already enabled
   - Set up a public domain for the bucket

2. **Update Public URL** (if needed):
   - If you set up a custom domain for the R2 bucket, update the `R2_PUBLIC_URL` constant in the Edge Function
   - Currently set to: `https://pub-bego.r2.dev`

3. **Test File Upload**:
   - Start your React app: `npm run dev`
   - Log in as a student
   - Navigate to Weekly Reports, Academic Reports, or Tuition Receipts
   - Try uploading a file
   - Check browser console and Edge Function logs for any errors

## Environment Variables

The Edge Function currently uses hardcoded credentials (fallback values). For production:

1. Set environment variables in Supabase:
   ```bash
   supabase secrets set R2_ACCESS_KEY_ID=656ccb3672b95e050d6473184aa1f5a4
   supabase secrets set R2_SECRET_ACCESS_KEY=5142f19f498dab351d294bf13b8d87a32ddfc927c069e7ed2ce6d1f551672812
   ```

2. Or update them via Supabase Dashboard:
   - Go to Project Settings → Edge Functions
   - Add secrets for `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`

## Testing

Test the Edge Function with curl:

```bash
# First, get your Supabase JWT token (after logging in)
# Then test the upload:

curl -X POST https://qysppoichxcgticleyit.supabase.co/functions/v1/upload-to-r2 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@test.jpg" \
  -F "folder=test-folder"
```

## Troubleshooting

- **401 Unauthorized**: Check that the JWT token is valid
- **500 Internal Server Error**: Check Edge Function logs in Supabase dashboard
- **File upload fails**: Verify R2 credentials and bucket exists
- **Files not accessible**: Check R2 public domain configuration




