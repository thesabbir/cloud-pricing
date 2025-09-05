#!/bin/bash

echo "Setting up Cloudflare resources for Cloud Pricing API..."

# Create KV namespace
echo "Creating KV namespace..."
KV_ID=$(wrangler kv namespace create "PRICING_DATA" --preview | grep -oE 'id = "[^"]*"' | cut -d'"' -f2)

if [ -n "$KV_ID" ]; then
  echo "KV namespace created with ID: $KV_ID"
  echo "Update wrangler.jsonc with this ID in the kv_namespaces section"
else
  echo "Failed to create KV namespace or it already exists"
fi

# Create R2 bucket
echo "Creating R2 bucket..."
wrangler r2 bucket create cloud-pricing-archive-dev

echo ""
echo "Setup complete! Next steps:"
echo "1. Update wrangler.jsonc with the KV namespace ID if needed"
echo "2. Ensure you have a Cloudflare Workers Paid plan for Browser Rendering"
echo "3. Run 'pnpm run dev:remote' to test with remote resources"