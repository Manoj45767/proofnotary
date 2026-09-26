import { useState } from "react";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import "./index.css";

const CONTRACT_ADDRESS =
  "0xE02404444C539ba9840b62eCf410FCb7e05625e2";

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

  const [sourceUrl, setSourceUrl] = useState(DEFAULT_SOURCE);

  const [connecting, setConnecting] = useState(false);

  const [loading, setLoading] = useState(false);

  const [loadingSavedResult, setLoadingSavedResult] =
    useState(false);

  const [error, setError] = useState("");

  const [result, setResult] = useState(null);

  const [txHash, setTxHash] = useState("");

  async function connectWallet() {
    try {
      setError("");

      setConnecting(true);

      if (!window.ethereum) {
        throw new Error(
          "No browser wallet detected. Please install MetaMask or GenLayer Wallet."
        );
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
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

      await client.connect("testnetBradbury");

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

      const contractResult =
        await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_result",
          args: [],
        });

      console.log(
        "Saved ProofNotary result:",
        contractResult
      );

      const textResult =
        String(contractResult);

      const parsed =
        parseContractResult(textResult);

      /*
       * The contract starts with empty values.
       *
       * Only show a saved result when a previous
       * verification actually exists.
       */

      if (parsed.claim.trim()) {
        setResult({
          raw: textResult,
          ...parsed,
        });

        setClaim(parsed.claim);

        if (parsed.source.trim()) {
          setSourceUrl(parsed.source);
        }

        /*
         * The contract stores the verification result,
         * but not the transaction hash.
         *
         * Therefore a previously loaded result does
         * not have a transaction link here.
         */

        setTxHash("");
      } else {
        setResult(null);
      }
    } catch (err) {
      console.error(
        "Saved result loading error:",
        err
      );

      /*
       * Don't block wallet connection if the saved
       * result cannot be loaded.
       */
    } finally {
      setLoadingSavedResult(false);
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
        !sourceUrl.startsWith("http://") &&
        !sourceUrl.startsWith("https://")
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

      await client.connect("testnetBradbury");

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
       *
       * The browser wallet shows the estimated
       * GEN fee before confirmation.
       */

      const transactionHash =
        await client.writeContract(write);

      console.log(
        "GenLayer transaction submitted:",
        transactionHash
      );

      setTxHash(transactionHash);

      /*
       * Wait for the GenLayer transaction to become
       * FINALIZED.
       *
       * Bradbury consensus can take longer than a
       * normal EVM transaction, so we allow up to
       * 60 minutes here.
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
       *
       * Check the execution result before reading
       * the contract state.
       */

      if (
        receipt?.txExecutionResultName &&
        receipt.txExecutionResultName !==
          "FINISHED_WITH_RETURN"
      ) {
        throw new Error(
          `Contract execution failed: ${
            receipt.txExecutionResultName
          }`
        );
      }

      /*
       * The transaction is finalized successfully.
       *
       * Now read the result stored by ProofNotary.
       */

      const contractResult =
        await client.readContract({
          address: CONTRACT_ADDRESS,

          functionName: "get_result",

          args: [],
        });

      console.log(
        "ProofNotary result:",
        contractResult
      );

      const textResult =
        String(contractResult);

      const parsed =
        parseContractResult(textResult);

      setResult({
        raw: textResult,

        ...parsed,
      });
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
          Contract execution and records
          the resulting verdict on-chain.
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
                  Reading the latest
                  ProofNotary result from
                  the blockchain.
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
              evidence, AI evaluation and
              GenLayer consensus into one
              verifiable workflow.
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
              description="GenLayer validators reach consensus on the structured result."
            />

            <ArchitectureStep
              number="04"
              title="Record"
              description="The verdict and explanation are stored on-chain."
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

function parseContractResult(text) {
  const claimMatch =
    text.match(
      /Claim:\s*([\s\S]*?)(?=\nSource:|\nVerdict:|$)/
    );

  const sourceMatch =
    text.match(
      /Source:\s*([\s\S]*?)(?=\nVerdict:|\nExplanation:|$)/
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