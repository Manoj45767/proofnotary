# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


class ProofNotary(gl.Contract):

    claim: str
    source_url: str
    verdict: str
    explanation: str
    evidence: str

    def __init__(self):
        self.claim = ""
        self.source_url = ""
        self.verdict = ""
        self.explanation = ""
        self.evidence = ""

    @gl.public.write
    def verify_claim(self, claim: str, source_url: str):

        if not claim.strip():
            self.claim = claim
            self.source_url = source_url
            self.verdict = "UNCERTAIN"
            self.explanation = "No claim was provided."
            self.evidence = "A claim is required."
            return

        if not source_url.startswith("http"):
            self.claim = claim
            self.source_url = source_url
            self.verdict = "UNCERTAIN"
            self.explanation = "The source URL is invalid."
            self.evidence = "The source URL must start with http or https."
            return

        def leader_fn():

            try:
                page = gl.nondet.web.render(
                    source_url,
                    mode="text"
                )
                page = page[:7000]

            except Exception:
                return {
                    "verdict": "UNCERTAIN",
                    "explanation": (
                        "The source could not be accessed "
                        "by the GenLayer web environment."
                    ),
                    "evidence": (
                        "The webpage returned an access "
                        "or loading error."
                    )
                }

            prompt = f"""
You are a careful web fact-checker.

CLAIM:
{claim}

SOURCE URL:
{source_url}

SOURCE CONTENT:
{page}

Evaluate whether the source content supports the claim.

Return ONLY a JSON object with exactly these fields:

{{
  "verdict": "VERIFIED",
  "explanation": "short explanation",
  "evidence": "short description of relevant evidence"
}}

The verdict MUST be exactly one of:

VERIFIED
REFUTED
UNCERTAIN

Rules:

VERIFIED:
The source clearly supports the claim.

REFUTED:
The source clearly contradicts the claim.

UNCERTAIN:
The source does not provide enough evidence.

Important:
- Do not invent facts.
- Only use information present in the source.
- If the source does not clearly establish the claim,
  use UNCERTAIN.
"""

            try:
                result = gl.nondet.exec_prompt(
                    prompt,
                    response_format="json"
                )

                if not isinstance(result, dict):
                    return {
                        "verdict": "UNCERTAIN",
                        "explanation": (
                            "The AI evaluation returned "
                            "an invalid response."
                        ),
                        "evidence": (
                            "No reliable structured result "
                            "was returned."
                        )
                    }

                return result

            except Exception:
                return {
                    "verdict": "UNCERTAIN",
                    "explanation": (
                        "The AI evaluation could not "
                        "be completed."
                    ),
                    "evidence": (
                        "The source evaluation returned "
                        "an execution error."
                    )
                }

        def validator_fn(leader_result):

            if not isinstance(
                leader_result,
                gl.vm.Return
            ):
                return False

            proposed = leader_result.calldata

            if not isinstance(proposed, dict):
                return False

            verdict = proposed.get("verdict")
            explanation = proposed.get("explanation")
            evidence = proposed.get("evidence")

            if verdict not in [
                "VERIFIED",
                "REFUTED",
                "UNCERTAIN"
            ]:
                return False

            if not isinstance(explanation, str):
                return False

            if not isinstance(evidence, str):
                return False

            if len(explanation.strip()) == 0:
                return False

            if len(evidence.strip()) == 0:
                return False

            return True

        result = gl.vm.run_nondet_unsafe(
            leader_fn,
            validator_fn
        )

        self.claim = claim
        self.source_url = source_url
        self.verdict = result.get(
            "verdict",
            "UNCERTAIN"
        )
        self.explanation = result.get(
            "explanation",
            ""
        )
        self.evidence = result.get(
            "evidence",
            ""
        )

    @gl.public.view
    def get_result(self) -> str:

        return (
            "Claim: " + self.claim +
            "\nSource: " + self.source_url +
            "\nVerdict: " + self.verdict +
            "\nExplanation: " + self.explanation +
            "\nEvidence: " + self.evidence
        )