"""Signal vocabulary shared by every analyser.

A signal is a specific, named observation with a severity and a human-readable
explanation. The service deliberately never emits a genuine/fake verdict: it
emits signals, and the caller decides what to do with them.

This matters because the consumer is a human verifier deciding whether public
money changes hands. "Suspicious" with no reason is unactionable, and worse, it
invites the reader to treat a weak statistical hint as proof.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, List


class Severity(str, Enum):
    """How much weight a signal carries on its own."""

    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


# Contribution to the overall risk score. Deliberately gentle: no single
# heuristic here is strong enough to condemn a document by itself, and several
# have well-known benign explanations.
SEVERITY_WEIGHT: Dict[Severity, int] = {
    Severity.INFO: 0,
    Severity.LOW: 8,
    Severity.MEDIUM: 20,
    Severity.HIGH: 35,
}


@dataclass
class Signal:
    code: str
    severity: Severity
    summary: str
    """What a non-specialist should understand from this."""
    detail: str = ""
    """Supporting numbers, for someone who wants to check the reasoning."""
    data: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        out = asdict(self)
        out["severity"] = self.severity.value
        return out


def score(signals: List[Signal]) -> int:
    """Combine signals into a 0-100 risk score.

    Uses diminishing returns rather than a plain sum: three medium signals
    should raise concern without three unrelated low ones reaching the same
    place as one high one. Saturating also keeps the score meaningful when an
    analyser emits many correlated observations about the same artefact.
    """
    total = 0.0
    for weight in sorted(
        (SEVERITY_WEIGHT[s.severity] for s in signals), reverse=True
    ):
        # Each subsequent signal contributes a shrinking share of what is left.
        total += (100 - total) * (weight / 100)
    return int(round(min(total, 100)))


def band(risk: int) -> str:
    """Coarse label. The score alone invites false precision."""
    if risk >= 60:
        return "high"
    if risk >= 30:
        return "medium"
    return "low"
