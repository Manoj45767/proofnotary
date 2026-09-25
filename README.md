\# ProofNotary



ProofNotary is a decentralized AI-powered claim verification application built with GenLayer Intelligent Contracts.



Users submit a claim together with a source URL. The GenLayer Intelligent Contract retrieves the source content, evaluates whether the source supports the claim, and stores the resulting verdict and evidence on-chain.



\## Features



\- AI-assisted claim verification

\- Source URL based evidence checking

\- Three possible verdicts:

&#x20; - `VERIFIED`

&#x20; - `REFUTED`

&#x20; - `UNCERTAIN`

\- Evidence and explanation returned with each verification

\- On-chain verification result

\- GenLayer transaction tracking

\- Web interface with wallet connection

\- Built for GenLayer Studionet



\## How It Works



1\. The user enters a claim.

2\. The user provides the source URL.

3\. The frontend sends the verification request to the ProofNotary Intelligent Contract.

4\. The contract retrieves the source webpage through GenLayer's web environment.

5\. An AI evaluation determines whether the source supports the claim.

6\. GenLayer consensus validates the result.

7\. The verdict, explanation, and evidence are stored on-chain.

8\. The frontend displays the final verification result and transaction.



\## Verification Logic



\### VERIFIED



The source clearly supports the submitted claim.



\### REFUTED



The source clearly contradicts the submitted claim.



\### UNCERTAIN



The available source does not provide enough evidence, or the source could not be accessed reliably.



\## Technology



\- GenLayer Intelligent Contracts

\- Python

\- React

\- Vite

\- JavaScript

\- genlayer-js

\- GenLayer Studionet



\## Project Structure



```text

proofnotary/

├── contracts/

│   └── proof\_notary.py

├── frontend/

│   ├── src/

│   │   ├── App.jsx

│   │   ├── index.css

│   │   ├── App.css

│   │   └── main.jsx

│   ├── package.json

│   └── vite.config.js

├── .gitignore

└── README.md

