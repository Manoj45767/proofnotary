import { useState } from "react";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import "./index.css";

const CONTRACT_ADDRESS =
  "0x22a6b676Eb9580ba07f77AE8731d4920bDF84145";

const DEFAULT_CLAIM =
  "OpenAI introduced GPT-5 on August 7, 2025.";

const DEFAULT_SOURCE =
  "https://openai.com/index/introducing-gpt-5/";

function shortenAddress(address) {
  if (!address) return "";

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function App() {
  const [walletAddress, setWalletAddress] = useState("");

  const [claim, setClaim] = useState(DEFAULT_CLAIM);

  const [sourceUrl, setSourceUrl] =
    useState(DEFAULT_SOURCE);

  const [connecting, setConnecting] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [loadingSavedResult, setLoadingSavedResult] =
    useState(false);

  const [error, setError] = useState("");

  const [result, setResult] = useState(null);

  const [txHash, setTxHash] = useState("");

  const [verificationHistory, setVerificationHistory] =
    useState([]);

  async function connectWallet() {
    try {
      setError("");
      setConnecting(true);

      if (!window.ethereum) {
        throw new Error(
          "No browser wallet detected. Please install MetaMask or GenLayer Wallet."
        );
      }

      const accounts =
        await window.ethereum.request({
          method: "eth_requestAccounts",
        });

      if (
        !accounts ||
        accounts.length === 0
      ) {
        throw new Error(
          "No wallet account was selected."
        );
      }

      const address = accounts[0];

      const client = createClient({
        chain: testnetBradbury,
        account: address,
        provider: window.ethereum,
      });

      await client.connect(
        "testnetBradbury"
      );

      setWalletAddress(address);

      await loadSavedResult(client);
    } catch (err) {
      console.error(
        "Wallet connection error:",
        err
      );

      setError(
        err?.message ||
          "Wallet connection failed."
      );
    } finally {
      setConnecting(false);
    }
  }

  async function loadSavedResult(client) {
    try {
      setLoadingSavedResult(true);

      /*
       * Load every persistent Evidence ID.
       *
       * ProofNotary now stores every verification
       * as a separate durable record.
       */

      const evidenceIdsResult =
        await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_evidence_ids",
          args: [],
        });

      console.log(
        "ProofNotary evidence IDs:",
        evidenceIdsResult
      );

      const evidenceIds =
        normalizeEvidenceIds(
          evidenceIdsResult
        );

      const records = [];

      for (const evidenceId of evidenceIds) {
        try {
          const contractResult =
            await client.readContract({
              address: CONTRACT_ADDRESS,
              functionName:
                "get_result_by_evidence_id",
              args: [evidenceId],
            });

          const textResult =
            String(contractResult);

          const parsed =
            parseContractResult(
              textResult
            );

          if (parsed.claim.trim()) {
            records.push({
              raw: textResult,
              ...parsed,
            });
          }
        } catch (recordError) {
          console.error(
            "Could not load verification record:",
            evidenceId,
            recordError
          );
        }
      }

      setVerificationHistory(records);

      /*
       * Load the latest Evidence ID.
       */

      const latestEvidenceIdResult =
        await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName:
            "get_latest_evidence_id",
          args: [],
        });

      const latestEvidenceId =
        String(
          latestEvidenceIdResult || ""
        ).trim();

      /*
       * Retrieve the latest record using its
       * exact Evidence ID.
       */

      if (latestEvidenceId) {
        const latestResult =
          await client.readContract({
            address: CONTRACT_ADDRESS,
            functionName:
              "get_result_by_evidence_id",
            args: [latestEvidenceId],
          });

        const textResult =
          String(latestResult);

        const parsed =
          parseContractResult(
            textResult
          );

        if (parsed.claim.trim()) {
          setResult({
            raw: textResult,
            ...parsed,
          });

          setClaim(parsed.claim);

          if (parsed.source.trim()) {
            setSourceUrl(parsed.source);
          }
        }
      } else {
        setResult(null);
      }

      setTxHash("");
    } catch (err) {
      console.error(
        "Saved result loading error:",
        err
      );

      /*
       * Don't block wallet connection if the
       * saved result cannot be loaded.
       */

      setResult(null);
      setVerificationHistory([]);
    } finally {
      setLoadingSavedResult(false);
    }
  }

  async function loadVerificationHistory(
    client
  ) {
    try {
      const evidenceIdsResult =
        await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_evidence_ids",
          args: [],
        });

      const evidenceIds =
        normalizeEvidenceIds(
          evidenceIdsResult
        );

      const records = [];

      for (const evidenceId of evidenceIds) {
        try {
          const contractResult =
            await client.readContract({
              address: CONTRACT_ADDRESS,
              functionName:
                "get_result_by_evidence_id",
              args: [evidenceId],
            });

          const textResult =
            String(contractResult);

          const parsed =
            parseContractResult(
              textResult
            );

          if (parsed.claim.trim()) {
            records.push({
              raw: textResult,
              ...parsed,
            });
          }
        } catch (recordError) {
          console.error(
            "History record loading error:",
            evidenceId,
            recordError
          );
        }
      }

      setVerificationHistory(records);
    } catch (err) {
      console.error(
        "Verification history loading error:",
        err
      );
    }
  }

  async function verifyClaim() {
    try {
      setError("");
      setResult(null);
      setTxHash("");

      if (!window.ethereum) {
        throw new Error(
          "No browser wallet detected. Please install MetaMask or GenLayer Wallet."
        );
      }

      if (!walletAddress) {
        throw new Error(
          "Please connect your wallet first."
        );
      }

      if (!claim.trim()) {
        throw new Error(
          "Please enter a claim."
        );
      }

      if (!sourceUrl.trim()) {
        throw new Error(
          "Please enter a source URL."
        );
      }

      if (
        !sourceUrl.startsWith(
          "http://"
        ) &&
        !sourceUrl.startsWith(
          "https://"
        )
      ) {
        throw new Error(
          "Source URL must start with http:// or https://"
        );
      }

      setLoading(true);

      const client = createClient({
        chain: testnetBradbury,
        account: walletAddress,
        provider: window.ethereum,
      });

      await client.connect(
        "testnetBradbury"
      );

      const write = {
        address: CONTRACT_ADDRESS,

        functionName: "verify_claim",

        args: [
          claim.trim(),
          sourceUrl.trim(),
        ],

        value: 0n,
      };

      /*
       * Submit the GenLayer transaction.
       */

      const transactionHash =
        await client.writeContract(write);

      console.log(
        "GenLayer transaction submitted:",
        transactionHash
      );

      setTxHash(transactionHash);

      /*
       * Wait for Bradbury finalization.
       *
       * Maximum wait:
       * 720 retries x 5 seconds = 60 minutes.
       */

      const receipt =
        await client.waitForTransactionReceipt({
          hash: transactionHash,

          status: "FINALIZED",

          interval: 5000,

          retries: 720,

          fullTransaction: false,
        });

      console.log(
        "GenLayer transaction receipt:",
        receipt
      );

      /*
       * A transaction can be finalized while the
       * contract execution itself failed.
       */

      if (
        receipt?.txExecutionResultName &&
        receipt.txExecutionResultName !==
          "FINISHED_WITH_RETURN"
      ) {
        throw new Error(
          `Contract execution failed: ${receipt.txExecutionResultName}`
        );
      }

      /*
       * Get the Evidence ID created by this
       * verification.
       */

      const latestEvidenceIdResult =
        await client.readContract({
          address: CONTRACT_ADDRESS,

          functionName:
            "get_latest_evidence_id",

          args: [],
        });

      const latestEvidenceId =
        String(
          latestEvidenceIdResult || ""
        ).trim();

      if (!latestEvidenceId) {
        throw new Error(
          "The verification finalized, but no Evidence ID was returned."
        );
      }

      console.log(
        "ProofNotary Evidence ID:",
        latestEvidenceId
      );

      /*
       * Retrieve the exact persistent record
       * using the Evidence ID.
       */

      const contractResult =
        await client.readContract({
          address: CONTRACT_ADDRESS,

          functionName:
            "get_result_by_evidence_id",

          args: [latestEvidenceId],
        });

      console.log(
        "ProofNotary durable result:",
        contractResult
      );

      const textResult =
        String(contractResult);

      const parsed =
        parseContractResult(
          textResult
        );

      setResult({
        raw: textResult,

        ...parsed,
      });

      /*
       * Refresh the complete persistent history.
       */

      await loadVerificationHistory(
        client
      );
    } catch (err) {
      console.error(
        "Verification error:",
        err
      );

      setError(
        err?.message ||
          "Verification failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-badge">
          <span className="hero-dot"></span>

          GenLayer Intelligent Contract
        </div>

        <h1>
          Verify facts with
          <br />

          <span>
            evidence + AI consensus.
          </span>
        </h1>

        <p>
          Submit a claim and a source URL.
          ProofNotary evaluates the source
          using GenLayer&apos;s Intelligent
          Contract execution, independent
          validator evaluation and consensus,
          then stores a durable verification
          record on-chain.
        </p>

        <div className="hero-actions">
          {!walletAddress ? (
            <button
              className="connect-button"
              onClick={connectWallet}
              disabled={connecting}
            >
              {connecting
                ? "Connecting..."
                : "Connect Wallet"}
            </button>
          ) : (
            <div className="wallet-pill">
              <span className="wallet-dot"></span>

              {shortenAddress(
                walletAddress
              )}
            </div>
          )}
        </div>
      </header>

      <main className="main-content">
        <section className="verification-card">
          <div className="card-header">
            <div>
              <h2>
                New Verification
              </h2>

              <p>
                Provide the statement you
                want to verify and its source.
              </p>
            </div>

            <div className="network-pill">
              <span className="network-dot"></span>

              Bradbury
            </div>
          </div>

          {loadingSavedResult && (
            <div className="status-box">
              <div className="loading-spinner"></div>

              <div>
                <strong>
                  Loading saved result
                </strong>

                <p>
                  Reading ProofNotary&apos;s
                  durable verification history
                  from the blockchain.
                </p>
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="claim">
              Claim
            </label>

            <textarea
              id="claim"
              value={claim}
              onChange={(e) =>
                setClaim(e.target.value)
              }
              placeholder="Enter a factual claim..."
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="sourceUrl">
              Source URL
            </label>

            <input
              id="sourceUrl"
              type="url"
              value={sourceUrl}
              onChange={(e) =>
                setSourceUrl(e.target.value)
              }
              placeholder="https://example.com/article"
              disabled={loading}
            />
          </div>

          <button
            className="verify-button"
            onClick={verifyClaim}
            disabled={
              loading ||
              loadingSavedResult
            }
          >
            {loading
              ? "Verifying..."
              : "Verify Claim"}
          </button>

          {loading && (
            <div className="status-box">
              <div className="loading-spinner"></div>

              <div>
                <strong>
                  Verification in progress
                </strong>

                <p>
                  GenLayer is evaluating
                  the source and reaching
                  consensus. This may take
                  a little while.
                </p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="error-box">
              <strong>
                Error
              </strong>

              <p>
                {error}
              </p>
            </div>
          )}

          {result && !loading && (
            <ResultCard
              result={result}
              txHash={txHash}
            />
          )}
        </section>

        {verificationHistory.length > 0 && (
          <section className="architecture-section">
            <div className="section-heading">
              <span>
                VERIFICATION HISTORY
              </span>

              <h2>
                Durable on-chain records
              </h2>

              <p>
                Each verification is stored
                under its own Evidence ID and
                can be retrieved independently.
              </p>
            </div>

            <div className="architecture-grid">
              {verificationHistory.map(
                (record, index) => (
                  <HistoryCard
                    key={
                      record.evidenceId ||
                      index
                    }
                    record={record}
                    index={index}
                  />
                )
              )}
            </div>
          </section>
        )}

        <section className="architecture-section">
          <div className="section-heading">
            <span>
              HOW IT WORKS
            </span>

            <h2>
              From claim to consensus
            </h2>

            <p>
              ProofNotary combines web
              evidence, AI evaluation,
              independent validator
              evaluation and GenLayer
              consensus into one verifiable
              workflow.
            </p>
          </div>

          <div className="architecture-grid">
            <ArchitectureStep
              number="01"
              title="Submit"
              description="Provide a factual claim together with its source URL."
            />

            <ArchitectureStep
              number="02"
              title="Evaluate"
              description="The Intelligent Contract fetches the source and evaluates the evidence."
            />

            <ArchitectureStep
              number="03"
              title="Consensus"
              description="GenLayer validators independently evaluate the source and compare the substantive result."
            />

            <ArchitectureStep
              number="04"
              title="Record"
              description="The verdict, explanation, evidence, content hash and unique Evidence ID are stored on-chain."
            />
          </div>
        </section>

        <section className="contract-section">
          <div className="contract-info">
            <span>
              CONTRACT
            </span>

            <a
              href={`https://explorer-bradbury.genlayer.com/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
            >
              {CONTRACT_ADDRESS}
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

function normalizeEvidenceIds(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item))
      .filter(Boolean);
  }

  if (
    typeof value === "object" &&
    Array.isArray(value.items)
  ) {
    return value.items
      .map((item) => String(item))
      .filter(Boolean);
  }

  const text = String(value).trim();

  if (!text) {
    return [];
  }

  return text
    .split(",")
    .map((item) =>
      item
        .replace(
          /^['"\s]+|['"\s]+$/g,
          ""
        )
        .trim()
    )
    .filter(Boolean);
}

function parseContractResult(text) {
  const claimMatch =
    text.match(
      /Claim:\s*([\s\S]*?)(?=\nSource:|\nContent Hash:|\nEvidence ID:|$)/
    );

  const sourceMatch =
    text.match(
      /Source:\s*([\s\S]*?)(?=\nContent Hash:|\nEvidence ID:|\nSource Status:|\nVerdict:|$)/
    );

  const contentHashMatch =
    text.match(
      /Content Hash:\s*([\s\S]*?)(?=\nEvidence ID:|\nSource Status:|\nVerdict:|$)/
    );

  const evidenceIdMatch =
    text.match(
      /Evidence ID:\s*([\s\S]*?)(?=\nSource Status:|\nVerdict:|$)/
    );

  const sourceStatusMatch =
    text.match(
      /Source Status:\s*([\s\S]*?)(?=\nVerdict:|$)/
    );

  const verdictMatch =
    text.match(
      /Verdict:\s*([A-Z]+)/
    );

  const explanationMatch =
    text.match(
      /Explanation:\s*([\s\S]*?)(?=\nEvidence:|$)/
    );

  const evidenceMatch =
    text.match(
      /Evidence:\s*([\s\S]*)$/
    );

  return {
    claim:
      claimMatch
        ? claimMatch[1].trim()
        : "",

    source:
      sourceMatch
        ? sourceMatch[1].trim()
        : "",

    contentHash:
      contentHashMatch
        ? contentHashMatch[1].trim()
        : "",

    evidenceId:
      evidenceIdMatch
        ? evidenceIdMatch[1].trim()
        : "",

    sourceStatus:
      sourceStatusMatch
        ? sourceStatusMatch[1].trim()
        : "",

    verdict:
      verdictMatch
        ? verdictMatch[1].trim()
        : "UNCERTAIN",

    explanation:
      explanationMatch
        ? explanationMatch[1].trim()
        : "",

    evidence:
      evidenceMatch
        ? evidenceMatch[1].trim()
        : "",
  };
}

function ResultCard({
  result,
  txHash,
}) {
  const verdictClass =
    result.verdict === "VERIFIED"
      ? "verified"
      : result.verdict === "REFUTED"
      ? "refuted"
      : "uncertain";

  return (
    <div
      className={`result-box ${verdictClass}`}
    >
      <div className="result-top">
        <div>
          <span className="result-label">
            VERIFICATION RESULT
          </span>

          <h3>
            {result.verdict}
          </h3>
        </div>

        <div className="result-status">
          {result.verdict === "VERIFIED"
            ? "✓"
            : result.verdict === "REFUTED"
            ? "×"
            : "?"}
        </div>
      </div>

      <div className="result-content">
        <div className="result-row">
          <span>
            Claim
          </span>

          <p>
            {result.claim}
          </p>
        </div>

        <div className="result-row">
          <span>
            Source
          </span>

          <p>
            <a
              href={result.source}
              target="_blank"
              rel="noreferrer"
            >
              {result.source}
            </a>
          </p>
        </div>

        <div className="result-row">
          <span>
            Source Status
          </span>

          <p>
            {result.sourceStatus ||
              "Not available"}
          </p>
        </div>

        <div className="result-row">
          <span>
            Content Hash
          </span>

          <p className="hash-value">
            {result.contentHash ||
              "Not available"}
          </p>
        </div>

        <div className="result-row">
          <span>
            Evidence ID
          </span>

          <p className="hash-value">
            {result.evidenceId ||
              "Not available"}
          </p>
        </div>

        <div className="result-row">
          <span>
            Explanation
          </span>

          <p>
            {result.explanation}
          </p>
        </div>

        <div className="result-row">
          <span>
            Evidence
          </span>

          <p>
            {result.evidence}
          </p>
        </div>

        {txHash && (
          <div className="result-row">
            <span>
              Transaction
            </span>

            <p>
              <a
                href={`https://explorer-bradbury.genlayer.com/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                {shortenAddress(txHash)}
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryCard({
  record,
  index,
}) {
  return (
    <div className="architecture-step">
      <div className="step-number">
        {String(index + 1).padStart(
          2,
          "0"
        )}
      </div>

      <div>
        <h3>
          {record.verdict}
        </h3>

        <p>
          {record.claim}
        </p>

        <p className="history-evidence-id">
          Evidence ID:{" "}
          {record.evidenceId}
        </p>
      </div>
    </div>
  );
}

function ArchitectureStep({
  number,
  title,
  description,
}) {
  return (
    <div className="architecture-step">
      <div className="step-number">
        {number}
      </div>

      <div>
        <h3>
          {title}
        </h3>

        <p>
          {description}
        </p>
      </div>
    </div>
  );
}

export default App;