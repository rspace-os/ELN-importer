# Netlify Build Fix - Missing Files

**Issue:** Build failed because new P1 improvement files weren't in the repository.

**Error:** `Could not resolve "../utils/RetryManager" from "src/services/rspace-api.ts"`

---

## Files That Were Missing

These two new files from the P1 improvements need to be committed:

1. ✅ `src/utils/RetryManager.ts` - Retry logic with exponential backoff (NOW CREATED)
2. ✅ `src/utils/SourceDetector.ts` - ELN source detection (ALREADY EXISTS)

---

## Quick Fix - Commit and Push

Run these commands in your terminal:

```bash
cd /path/to/ELN-importer

# Check status
git status

# Add the missing files
git add src/utils/RetryManager.ts
git add src/utils/SourceDetector.ts

# Also add any other modified files from P1 improvements
git add src/utils/CustomFieldExtractor.ts
git add src/utils/ValidationEngine.ts
git add src/services/rspace-api.ts
git add src/services/rspace-mapper.ts
git add src/services/rspace-importer.ts
git add src/utils/eln-parser.ts

# Commit
git commit -m "P1 improvements: Generic RO-Crate, Retry logic, Validation

- P1-1: Generic RO-Crate extraction (multi-ELN support)
- P1-3: File upload retry logic with exponential backoff
- P1-4: Enhanced pre-import validation
- Add RetryManager and SourceDetector utilities
- Update field names to be generic (not eLabFTW-specific)
- Add comprehensive validation checks"

# Push to trigger Netlify rebuild
git push
```

---

## Verify Files Are Committed

After committing, verify with:

```bash
git ls-files | grep -E "(RetryManager|SourceDetector)"
```

Expected output:
```
src/utils/RetryManager.ts
src/utils/SourceDetector.ts
```

---

## Alternative: Build Without New Features

If you want to deploy quickly WITHOUT the P1 improvements, you can revert:

```bash
# Create a new branch for P1 work
git checkout -b p1-improvements

# Switch back to main
git checkout main

# The P1 changes will be saved in the p1-improvements branch
```

Then deploy from `main` branch which has only P0 fixes.

---

## Files Changed in P1 Improvements

### NEW Files (Must be committed)
- `src/utils/RetryManager.ts`
- `src/utils/SourceDetector.ts`

### Modified Files
- `src/utils/CustomFieldExtractor.ts`
- `src/utils/ValidationEngine.ts`
- `src/services/rspace-api.ts`
- `src/services/rspace-mapper.ts`
- `src/services/rspace-importer.ts`
- `src/utils/eln-parser.ts`

### Documentation Files (Optional to commit)
- `P1_IMPLEMENTATION_PLAN.md`
- `P1_1_GENERIC_ROCRATE_COMPLETE.md`
- `P1_3_RETRY_LOGIC_COMPLETE.md`
- `P1_4_VALIDATION_COMPLETE.md`
- `P1_PROGRESS_SUMMARY.md`

---

## After Pushing

1. Netlify will automatically detect the push
2. It will start a new build
3. Build should succeed (all files now present)
4. Your site will be deployed with P1 improvements

---

## Check Netlify Build Logs

After pushing, check Netlify:
- Should see: "Build succeeded"
- Look for: "npm run build" completing without errors
- Verify: Site deploys successfully

---

## If Build Still Fails

Check that TypeScript compilation works locally:

```bash
npm run build
```

If that succeeds locally but fails on Netlify:
1. Check `package.json` - ensure all dependencies are listed
2. Check `tsconfig.json` - verify paths are correct
3. Check Netlify build settings match local build command
