# ELN-importer
This repository contains a tool for importing data in the .ELN format into RSpace. For further details and limitations (currently, only .ELN exports from elabFTW are supported), please refer to the documentation provided below.

## Installation instructions

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

## Documentation
Documentation and instructions on how to use this tool can be found [here](https://documentation.researchspace.com/l/en/article/ryb3p9k6td-e-lab-ftw-importer).
