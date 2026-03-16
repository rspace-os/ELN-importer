ELN-importer

test : npm run test

integration-test : npm run integration-test

run scripts:
-- to run the importer headless with the test data defined in the import-crate.ts script:
npx vite-node src/scripts/import-crate.ts

-- To generate expected output for integration tests:
npx vite-node src/scripts/generate-expected-output.ts
