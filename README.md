ELN-importer

You need to have node.js installed. See https://nodejs.org/en/download

(first time setup: `npm install`)

RUN the code: `npm run dev`

test : `npm run test`

-- To generate expected output for integration tests:
`npx vite-node src/scripts/generate-expected-output.ts`

integration-test : `npm run integration-test` (when these tests run, they will write conten to the 'actual-output' folder. Json will be compared with the json in the 'expected-output' folder. Nothing is actually sent to RSpace).

run scripts:
-- to run the importer headless with the test data defined in the import-crate.ts script:
`npx vite-node src/scripts/import-crate.ts`git 

