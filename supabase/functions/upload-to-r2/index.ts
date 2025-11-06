import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Cloudflare R2 Configuration
const R2_ENDPOINT = "fbf4e26a9ecfa302766bd7ca85118373.r2.cloudflarestorage.com"
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") || "656ccb3672b95e050d6473184aa1f5a4"
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") || "5142f19f498dab351d294bf13b8d87a32ddfc927c069e7ed2ce6d1f551672812"
const R2_BUCKET = "bego"
const R2_REGION = "auto"
const R2_PUBLIC_URL = "https://pub-f5434ea165424130b4abcd94a637fba6.r2.dev"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// URL encode helper - encode each path segment separately
function encodeURIComponentStrict(str: string): string {
  return encodeURIComponent(str).replace(/%2F/g, "/").replace(/%5C/g, "\\")
}

// URL encode for AWS Signature v4 (different encoding rules)
function awsEncodeURI(str: string): string {
  return str
    .split("")
    .map(char => {
      const code = char.charCodeAt(0)
      if (
        (code >= 48 && code <= 57) || // 0-9
        (code >= 65 && code <= 90) || // A-Z
        (code >= 97 && code <= 122) || // a-z
        char === "_" ||
        char === "-" ||
        char === "~" ||
        char === "." ||
        char === "/"
      ) {
        return char
      }
      return char
        .charCodeAt(0)
        .toString(16)
        .toUpperCase()
        .padStart(2, "0")
        .replace(/./, "%")
    })
    .join("")
}

// AWS Signature v4 implementation
async function hmacSha256(key: Uint8Array | string, data: string): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const keyData = typeof key === "string" ? encoder.encode(key) : key
  const dataBytes = encoder.encode(data)
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBytes)
  return new Uint8Array(signature)
}

async function sha256(data: string | Uint8Array): Promise<string> {
  let dataBytes: Uint8Array
  if (typeof data === "string") {
    const encoder = new TextEncoder()
    dataBytes = encoder.encode(data)
  } else {
    dataBytes = data
  }
  const hash = await crypto.subtle.digest("SHA-256", dataBytes)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
}

async function getSignature(
  method: string,
  uri: string,
  query: string,
  headers: Record<string, string>,
  payload: Uint8Array
): Promise<string> {
  const now = new Date()
  const dateStamp = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").substring(0, 8)
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").substring(0, 15) + "Z"
  
  // Step 1: Create canonical request
  // Sort headers by key (lowercase)
  const sortedHeaderKeys = Object.keys(headers)
    .map(k => k.toLowerCase())
    .sort()
  
  const signedHeaders = sortedHeaderKeys.join(";")
  
  const canonicalHeaders = sortedHeaderKeys
    .map(k => {
      const value = headers[Object.keys(headers).find(orig => orig.toLowerCase() === k) || k]
      return `${k}:${value.trim()}\n`
    })
    .join("")
  
  // Hash the payload directly (as bytes)
  const payloadHash = await sha256(payload)
  
  const canonicalRequest = [
    method,
    uri,
    query || "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n")
  
  // Step 2: Create string to sign
  const algorithm = "AWS4-HMAC-SHA256"
  const credentialScope = `${dateStamp}/${R2_REGION}/s3/aws4_request`
  const canonicalRequestHash = await sha256(canonicalRequest)
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n")
  
  // Step 3: Calculate signature
  const kDate = await hmacSha256(`AWS4${R2_SECRET_ACCESS_KEY}`, dateStamp)
  const kRegion = await hmacSha256(kDate, R2_REGION)
  const kService = await hmacSha256(kRegion, "s3")
  const kSigning = await hmacSha256(kService, "aws4_request")
  const signature = await hmacSha256(kSigning, stringToSign)
  
  return bytesToHex(signature)
}

async function uploadToR2(fileBytes: Uint8Array, filePath: string, contentType: string): Promise<void> {
  const method = "PUT"
  
  // Encode the URI path properly - each segment separately
  const pathSegments = filePath.split("/").map(segment => encodeURIComponent(segment))
  const encodedPath = pathSegments.join("/")
  const uri = `/${R2_BUCKET}/${encodedPath}`
  const query = ""
  
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").substring(0, 15) + "Z"
  const dateStamp = amzDate.substring(0, 8)
  
  // Calculate payload hash for x-amz-content-sha256 header (required by R2)
  const payloadHash = await sha256(fileBytes)
  
  // Headers must be in lowercase for canonical request
  const headers: Record<string, string> = {
    "host": R2_ENDPOINT,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    "content-type": contentType,
    "content-length": fileBytes.length.toString(),
  }
  
  // Get signature
  const signature = await getSignature(method, uri, query, headers, fileBytes)
  
  // Create authorization header
  const credentialScope = `${dateStamp}/${R2_REGION}/s3/aws4_request`
  const credential = `${R2_ACCESS_KEY_ID}/${credentialScope}`
  const signedHeaders = Object.keys(headers)
    .map(k => k.toLowerCase())
    .sort()
    .join(";")
  
  const authorization = `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  
  // Make request - headers in request must match canonical request
  const url = `https://${R2_ENDPOINT}${uri}`
  const requestHeaders: Record<string, string> = {
    "Host": R2_ENDPOINT,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    "Content-Type": contentType,
    "Content-Length": fileBytes.length.toString(),
    "Authorization": authorization,
  }
  
  const response = await fetch(url, {
    method: "PUT",
    headers: requestHeaders,
    body: fileBytes,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("R2 Upload Error:", response.status, response.statusText)
    console.error("Error Details:", errorText)
    console.error("Request URL:", url)
    console.error("Request Headers:", JSON.stringify(requestHeaders, null, 2))
    throw new Error(`Failed to upload to R2: ${response.status} ${response.statusText} - ${errorText}`)
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Parse the request
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const folder = formData.get("folder") as string | null

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Generate a unique file path
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split(".").pop()
    const fileName = `${timestamp}-${randomStr}.${fileExtension}`
    const filePath = folder ? `${folder}/${fileName}` : fileName

    // Read file as bytes
    const fileBytes = new Uint8Array(await file.arrayBuffer())

    // Upload to R2
    await uploadToR2(fileBytes, filePath, file.type || "application/octet-stream")

    // Construct public URL
    const publicUrl = `${R2_PUBLIC_URL}/${filePath}`

    return new Response(
      JSON.stringify({ 
        success: true,
        url: publicUrl,
        path: filePath,
        fileName: file.name,
        size: file.size,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  } catch (error) {
    console.error("Error uploading file:", error)
    return new Response(
      JSON.stringify({ error: error.message || "Failed to upload file" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
