#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const axios_1 = require("axios");
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:7100';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
async function seedAgent(payloadPath) {
    const payload = JSON.parse((0, fs_1.readFileSync)(payloadPath, 'utf8'));
    console.log(`\n📦 Seeding agent: ${payload.display_name}`);
    console.log(`   Type: ${payload.agent_type}`);
    console.log(`   Slug: ${payload.slug}`);
    try {
        console.log('   ✓ Validating...');
        const validateResponse = await axios_1.default.post(`${API_BASE_URL}/api/admin/agents/validate?dryRun=true`, payload, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${ADMIN_TOKEN}`,
            },
        });
        if (!validateResponse.data.success) {
            console.log('   ✗ Validation failed:');
            validateResponse.data.issues?.forEach((issue) => {
                console.log(`     - ${issue.message}`);
            });
            return false;
        }
        console.log('   ✓ Validation passed');
        if (validateResponse.data.dryRun) {
            console.log(`   ✓ Dry-run: ${validateResponse.data.dryRun.ok ? 'PASS' : 'FAIL'}`);
        }
        console.log('   ✓ Creating...');
        const createResponse = await axios_1.default.post(`${API_BASE_URL}/api/admin/agents`, payload, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${ADMIN_TOKEN}`,
            },
        });
        if (!createResponse.data.success) {
            console.log('   ✗ Creation failed:');
            createResponse.data.issues?.forEach((issue) => {
                console.log(`     - ${issue.message}`);
            });
            return false;
        }
        console.log(`   ✓ Created successfully! ID: ${createResponse.data.data.id}`);
        return true;
    }
    catch (error) {
        console.log(`   ✗ Error: ${error.message}`);
        if (error.response?.data) {
            console.log(`   Response:`, JSON.stringify(error.response.data, null, 2));
        }
        return false;
    }
}
async function main() {
    console.log('🚀 Agent Seeding Script');
    console.log(`API: ${API_BASE_URL}`);
    console.log(`Auth: ${ADMIN_TOKEN ? 'Provided' : 'Missing (will fail)'}`);
    const root = (0, path_1.resolve)(__dirname, '../../..');
    const payloads = [
        (0, path_1.resolve)(root, 'docs/feature/matt/payloads/blog_post_writer.json'),
        (0, path_1.resolve)(root, 'docs/feature/matt/payloads/hr_assistant.json'),
        (0, path_1.resolve)(root, 'docs/feature/matt/payloads/agent_builder_orchestrator_v2.json'),
    ];
    let successCount = 0;
    let failCount = 0;
    for (const payloadPath of payloads) {
        const success = await seedAgent(payloadPath);
        if (success) {
            successCount++;
        }
        else {
            failCount++;
        }
    }
    console.log(`\n📊 Summary:`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Failed: ${failCount}`);
    console.log(`   Total: ${successCount + failCount}`);
    process.exit(failCount > 0 ? 1 : 0);
}
main();
//# sourceMappingURL=seed-agents.js.map