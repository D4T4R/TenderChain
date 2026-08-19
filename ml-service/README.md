# Artefact screening service

Screens tender documents and milestone evidence before they are pinned to IPFS,
and returns an explainable risk assessment.

## What this does not do

It does **not** decide whether a document is genuine or forged. Document forgery
detection is not a solved problem, and a wrong answer is harmful in both
directions: a false "genuine" launders a forged completion certificate into a
permanent record, and a false "fake" blocks a legitimate contractor's payment.

It also never blocks anything. The caller uploads regardless and routes anything
notable to a human verifier.

**The strongest integrity control in TenderChain is not here.** It is the IPFS
CID anchored on chain, which makes any change after upload detectable with
certainty. This service only screens for manipulation that happened *before* the
file arrived.

## What it does

Returns a 0–100 risk score with named, explainable signals.

| Check | Applies to | Strength |
| --- | --- | --- |
| Editing/generator software in metadata | images | **Good** — editors announce themselves |
| Missing camera, capture time, GPS | images | Weak individually; useful together |
| Perceptual hash (reuse of earlier evidence) | images | **Good** — see below |
| Incremental updates (edited after signing) | PDFs | **Good** — structural, hard to fake |
| Embedded JavaScript / attachments | PDFs | **Good** — no legitimate reason in a tender |
| Graphics-editor or scanner producer | PDFs | Moderate |
| Error Level Analysis | JPEGs | **Reported, not scored** — see below |

### Perceptual hashing is the most useful check here

Reuse is the fraud that actually occurs with milestone evidence: resubmitting an
older photograph as proof of new work. A perceptual hash survives re-encoding and
resizing, so this is caught even though the bytes differ. Measured on structured
fixtures: distance **0** for the same image resized and recompressed, **24** for
an unrelated scene.

### Error Level Analysis is deliberately not scored

ELA is computed and surfaced, but contributes nothing to the risk score. On every
fixture available during development it failed to separate a spliced image from a
clean one — a full-quality resave raised the error floor everywhere, and a
same-quality splice produced a robust z-score of 3.8 against 3.7 for the
untouched original. That is noise.

ELA needs high-frequency texture and is defeated by a single resave. Scoring it
would manufacture confidence the measurement does not support. The numbers are
there for a forensic analyst; they must be validated against real photographs
before being trusted. A test asserts it stays informational.

### Video is not screened

Only its hash is recorded. Frame-level forensics needs decoding infrastructure
this service does not carry, and half-analysing it would imply assurance that is
not there. The chain anchor still applies.

## Running it

```bash
cd ml-service
virtualenv -p python3.10 .venv        # python3-venv is not installed on the dev box
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000
```

Requires Python 3.10+. Tests: `.venv/bin/python -m pytest tests/ -q`

## API

- `GET  /health`
- `POST /screen`  — multipart `file`, optional `declared_type`
- `POST /compare` — form `a`, `b` (perceptual hashes) → distance and verdict

The backend calls this from `backend/services/screeningService.js`, which **fails
open**: if this service is slow or down, the upload proceeds and the artefact is
recorded as unscreened and queued for review. Unscreened is not treated as clean.
