"""
PayGuard AI - Cryptographic Agent Identity Layer

Uses standard, audited primitives from the `cryptography` library:
  - Ed25519 for agent key pairs + digital signatures
  - SHA-256 for intent/basket hashing

No custom crypto algorithms are implemented, per project security principles.
"""
import json
import base64
import hashlib
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey, Ed25519PublicKey
)
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature


def generate_keypair() -> tuple[str, str]:
    """Generate an Ed25519 keypair. Returns (public_pem, private_pem)."""
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()

    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()

    return public_pem, private_pem


def _canonical_payload(payload: dict) -> bytes:
    """Deterministic JSON serialization so signatures are reproducible."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()


def hash_object(obj: dict) -> str:
    """SHA-256 hash of a canonicalized JSON object (used for intent/basket hashes)."""
    return hashlib.sha256(_canonical_payload(obj)).hexdigest()


def sign_payload(private_key_pem: str, payload: dict) -> str:
    """Sign a canonical JSON payload with an Ed25519 private key. Returns base64 signature."""
    private_key = serialization.load_pem_private_key(private_key_pem.encode(), password=None)
    signature = private_key.sign(_canonical_payload(payload))
    return base64.b64encode(signature).decode()


def verify_signature(public_key_pem: str, payload: dict, signature_b64: str) -> bool:
    """Verify an Ed25519 signature against a canonical JSON payload."""
    try:
        public_key = serialization.load_pem_public_key(public_key_pem.encode())
        signature = base64.b64decode(signature_b64)
        public_key.verify(signature, _canonical_payload(payload))
        return True
    except (InvalidSignature, ValueError, Exception):
        return False


def fingerprint_public_key(public_key_pem: str) -> str:
    """Short human-readable fingerprint of a public key, for display in the UI."""
    digest = hashlib.sha256(public_key_pem.encode()).hexdigest()
    return ":".join(digest[i:i + 4] for i in range(0, 16, 4)).upper()
