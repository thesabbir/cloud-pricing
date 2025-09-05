#!/usr/bin/env node

/**
 * Test script for local development
 * Run with: npx tsx scripts/test-local.ts
 */

const API_BASE = 'http://localhost:9000';

async function testAPI() {
  console.log('🧪 Testing Cloud Pricing API...\n');
  
  // Test 1: Health check
  console.log('1. Testing health endpoint...');
  try {
    const healthRes = await fetch(`${API_BASE}/health`);
    const health = await healthRes.json();
    console.log('✅ Health check:', health);
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
  
  // Test 2: List providers
  console.log('\n2. Testing list providers...');
  try {
    const providersRes = await fetch(`${API_BASE}/api/providers`);
    const providers = await providersRes.json();
    console.log('✅ Providers:', providers);
  } catch (error) {
    console.error('❌ List providers failed:', error);
  }
  
  // Test 3: Get Vercel data (should be empty initially)
  console.log('\n3. Testing get Vercel data...');
  try {
    const vercelRes = await fetch(`${API_BASE}/api/providers/vercel`);
    if (vercelRes.status === 404) {
      console.log('ℹ️  Vercel data not found (expected for fresh setup)');
    } else {
      const vercel = await vercelRes.json();
      console.log('✅ Vercel data:', vercel);
    }
  } catch (error) {
    console.error('❌ Get Vercel failed:', error);
  }
  
  // Test 4: Trigger Vercel scraping (mock - won't actually work without API key)
  console.log('\n4. Testing trigger scraping (mock)...');
  try {
    const refreshRes = await fetch(`${API_BASE}/api/providers/vercel/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ force: true, wait: false })
    });
    const refresh = await refreshRes.json();
    console.log('✅ Refresh response:', refresh);
  } catch (error) {
    console.error('❌ Trigger scraping failed:', error);
  }
  
  console.log('\n✨ Testing complete!');
  console.log('\n📝 Note: To test actual scraping:');
  console.log('1. Add your OpenAI API key to .dev.vars');
  console.log('2. Run: pnpm run dev');
  console.log('3. POST to /api/providers/vercel/refresh with wait=true');
}

// Run tests
testAPI().catch(console.error);