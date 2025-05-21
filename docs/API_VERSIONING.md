# API Versioning Strategy

This document outlines the versioning strategy for the Orchestrator AI API.

## Version Structure

- **v1**: Stable production API (tagged as v1.0.0)
  - Path: `/v1/*`
  - Source: `apps/api-v1/`
  - Status: Production-ready

- **v2**: Next major version (under active development)
  - Path: `/v2/*`
  - Source: `apps/api-v2/`
  - Status: Development

## Branching Strategy

- `main`: Points to the latest stable release (currently v1)
- `api-v1`: Maintenance branch for v1
- `api-v2`: Development branch for v2

## Development Workflow

### Working on v1 (bug fixes only)
```bash
git checkout api-v1
# Make your changes
# Test thoroughly
# Create PR to main
```

### Working on v2 (new features)
```bash
git checkout api-v2
# Make your changes
# Test thoroughly
# Create PR to api-v2
```

## Running Locally

### v1
```bash
cd apps/api-v1
uvicorn main:app --reload
```

### v2
```bash
cd apps/api-v2
uvicorn main:app --reload
```

## Version Migration

When v2 is ready for production:
1. Merge `api-v2` into `main`
2. Tag the release as `v2.0.0`
3. Create a maintenance branch for v1 if needed
4. Update documentation to reflect the new version

## Best Practices

1. Keep API versions independent
2. Document breaking changes between versions
3. Maintain backward compatibility where possible
4. Use feature flags for gradual rollouts
5. Monitor API usage by version
